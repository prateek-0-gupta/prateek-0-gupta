import { useState, useEffect, registerHandler } from '../../../framework.js';

let room = null;
let sendMessage = null;
let sendNick = null;
let sendSystem = null;
let peers = {};
let messageLog = [];
let _rerender = null;
let connectionStatus = 'idle'; // idle | connecting | waiting | connected | error
let _currentRoomId = null;
let _currentNickname = null;
let _joinTimer = null;

const APP_ID = 'prateek-p2p-chat-v1';
const PUBLIC_ROOM = 'public-lobby';

function timestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(msg) {
    messageLog.push(msg);
    if (messageLog.length > 200) messageLog.shift();
    rerender();
}

function rerender() {
    if (_rerender) _rerender(Date.now());
}

function setStatus(s) {
    connectionStatus = s;
    rerender();
}

async function joinRoom(roomId, nickname) {
    try {
        setStatus('connecting');
        _currentRoomId = roomId;
        _currentNickname = nickname;
        console.log('[P2P] Loading trystero library...');

        const { joinRoom: trysteroJoin } = await import('https://esm.sh/trystero@0.20.0/torrent');

        console.log('[P2P] Trystero loaded OK');
        console.log('[P2P] Joining room:', JSON.stringify(roomId), 'appId:', JSON.stringify(APP_ID));

        if (room) {
            console.log('[P2P] Leaving previous room');
            room.leave();
        }
        messageLog = [];
        peers = {};

        const trackers = [
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.webtorrent.dev',
            'wss://tracker.files.fm:7073/announce',
        ];
        console.log('[P2P] Using trackers:', trackers);

        room = trysteroJoin({
            appId: APP_ID,
            trackerUrls: trackers,
            rtcConfig: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                ]
            }
        }, roomId);

        console.log('[P2P] Room object created, setting up data channels...');

        const [_sendMsg, onMsg] = room.makeAction('chat-message');
        const [_sendNick, onNick] = room.makeAction('nickname');
        const [_sendSys, onSys] = room.makeAction('system');

        sendMessage = _sendMsg;
        sendNick = _sendNick;
        sendSystem = _sendSys;

        onMsg((text, peerId) => {
            console.log('[P2P] Chat message from', peerId);
            const name = peers[peerId] || peerId.slice(0, 6);
            addMessage({ from: name, text, time: timestamp() });
        });

        onNick((nick, peerId) => {
            console.log('[P2P] Got nickname from', peerId, ':', nick);
            const oldNick = peers[peerId];
            peers[peerId] = nick;
            if (oldNick && oldNick !== nick) {
                addMessage({ text: `${oldNick} is now ${nick}`, time: timestamp(), system: true });
            }
        });

        onSys((text, _peerId) => {
            addMessage({ text, time: timestamp(), system: true });
        });

        room.onPeerJoin(peerId => {
            console.log('[P2P] ★ PEER JOINED:', peerId);
            peers[peerId] = peerId.slice(0, 6);
            if (_joinTimer) { clearTimeout(_joinTimer); _joinTimer = null; }
            setStatus('connected');
            addMessage({ text: `A new peer connected`, time: timestamp(), system: true });
            if (sendNick) sendNick(nickname);
        });

        room.onPeerLeave(peerId => {
            console.log('[P2P] Peer left:', peerId);
            const name = peers[peerId] || peerId.slice(0, 6);
            delete peers[peerId];
            addMessage({ text: `${name} disconnected`, time: timestamp(), system: true });
            if (Object.keys(peers).length === 0) setStatus('waiting');
        });

        setStatus('waiting');
        addMessage({ text: `Joined room "${roomId}" as ${nickname}. Waiting for peers…`, time: timestamp(), system: true });
        addMessage({ text: `Peer discovery via BitTorrent trackers can take 15-60 seconds.`, time: timestamp(), system: true });
        console.log('[P2P] Setup complete. Listening for peers on trackers…');

        // Nudge after 20s if still alone
        if (_joinTimer) clearTimeout(_joinTimer);
        _joinTimer = setTimeout(() => {
            if (Object.keys(peers).length === 0 && room) {
                addMessage({
                    text: `Still looking for peers… Make sure the other person joined the same room name. You can try the Reconnect button.`,
                    time: timestamp(), system: true
                });
            }
        }, 20_000);

    } catch (err) {
        console.error('[P2P] joinRoom failed:', err);
        setStatus('error');
        addMessage({ text: `Connection error: ${err.message}`, time: timestamp(), system: true });
    }
}

function leaveRoom() {
    if (_joinTimer) { clearTimeout(_joinTimer); _joinTimer = null; }
    if (room) {
        room.leave();
        room = null;
        sendMessage = null;
        sendNick = null;
        sendSystem = null;
        peers = {};
        messageLog = [];
    }
    connectionStatus = 'idle';
    _currentRoomId = null;
    _currentNickname = null;
}

export default function P2PChat() {
    const [joined, setJoined] = useState(false);
    const [nickname, setNickname] = useState('');
    const [currentRoom, setCurrentRoom] = useState('');
    const [_tick, setTick] = useState(0);

    _rerender = setTick;

    useEffect(() => {
        const el = document.getElementById('p2p-messages');
        if (el) el.scrollTop = el.scrollHeight;

        const input = document.getElementById('chat-input');
        if (input) {
            const handler = (e) => {
                if (e.key === 'Enter') {
                    document.querySelector('[data-action="chat-send"]')?.click();
                }
            };
            input.addEventListener('keydown', handler);
            input._p2pHandler = handler;
        }
    }, [_tick]);

    registerHandler('chat-join-public', () => {
        const nickInput = document.getElementById('chat-nick');
        const nick = nickInput?.value.trim() || 'Anon';
        setNickname(nick);
        setCurrentRoom(PUBLIC_ROOM);
        setJoined(true);
        joinRoom(PUBLIC_ROOM, nick);
    });

    registerHandler('chat-join-private', () => {
        const nickInput = document.getElementById('chat-nick');
        const roomInput = document.getElementById('chat-room-id');
        const nick = nickInput?.value.trim() || 'Anon';
        const roomId = roomInput?.value.trim();
        if (!roomId) { alert('Enter a room name!'); return; }
        setNickname(nick);
        setCurrentRoom(roomId);
        setJoined(true);
        joinRoom(roomId, nick);
    });

    registerHandler('chat-send', () => {
        const input = document.getElementById('chat-input');
        const text = input?.value.trim();
        if (!text || !sendMessage) return;
        sendMessage(text);
        addMessage({ from: nickname || 'You', text, time: timestamp(), self: true });
        if (input) input.value = '';
    });

    registerHandler('chat-keydown', (e) => {
        if (e.key === 'Enter') {
            const input = document.getElementById('chat-input');
            const text = input?.value.trim();
            if (!text || !sendMessage) return;
            sendMessage(text);
            addMessage({ from: nickname || 'You', text, time: timestamp(), self: true });
            if (input) input.value = '';
        }
    });

    registerHandler('chat-leave', () => {
        leaveRoom();
        setJoined(false);
        setCurrentRoom('');
        setTick(Date.now());
    });

    registerHandler('chat-reconnect', () => {
        if (_currentRoomId && _currentNickname) {
            console.log('[P2P] Manual reconnect requested');
            addMessage({ text: 'Reconnecting…', time: timestamp(), system: true });
            joinRoom(_currentRoomId, _currentNickname);
        }
    });

    const peerCount = Object.keys(peers).length;
    const peerList = Object.values(peers);

    const messagesHtml = messageLog.map(m => {
        if (m.system) {
            return `<div class="p2p-msg p2p-sys"><span class="p2p-time">${m.time}</span> ${m.text}</div>`;
        }
        const cls = m.self ? 'p2p-msg p2p-self' : 'p2p-msg';
        return `<div class="${cls}"><span class="p2p-author">${m.from}</span><span class="p2p-time">${m.time}</span><div class="p2p-text">${escapeHtml(m.text)}</div></div>`;
    }).join('');

    const peersHtml = peerList.length
        ? peerList.map(n => `<span class="p2p-peer-tag">${escapeHtml(n)}</span>`).join('')
        : '<span class="p2p-no-peers">No peers yet</span>';

    if (!joined) {
        return `
        <div class="p2p-root">
        <div class="p2p-lobby">
            <a href="/" data-link class="p2p-back">&larr; Back</a>

            <div class="p2p-logo">&#9781;</div>
            <h1 class="p2p-title">P2P Chat</h1>
            <p class="p2p-subtitle">Serverless, encrypted, peer-to-peer.<br>Powered by WebRTC &amp; BitTorrent trackers.</p>

            <div class="p2p-form">
                <label class="p2p-label">Your Nickname</label>
                <input id="chat-nick" class="p2p-input" type="text" placeholder="Choose a nickname..." maxlength="20" autocomplete="off" />

                <div class="p2p-divider"></div>

                <button data-action="chat-join-public" class="p2p-btn p2p-btn-primary">Join Public Room</button>

                <div class="p2p-or">or create / join a private room</div>

                <label class="p2p-label">Room Name</label>
                <input id="chat-room-id" class="p2p-input" type="text" placeholder="Enter a secret room name..." maxlength="40" autocomplete="off" />
                <button data-action="chat-join-private" class="p2p-btn p2p-btn-secondary">Join Private Room</button>
            </div>

            <div class="p2p-info">
                <p style="margin-top:0.6rem;">&#9881; <strong>How it works:</strong> When you join a room, your browser connects to public BitTorrent WebSocket trackers solely for peer discovery (signaling). Once peers find each other, a direct WebRTC connection is established and the tracker is no longer involved. All messages travel peer-to-peer with no middleman.</p>
                <p style="margin-top:0.6rem;">&#128218; This project is built for <strong>academic and educational purposes only</strong> — a demonstration of serverless peer-to-peer communication using WebRTC, hosted entirely on static GitHub Pages with zero backend infrastructure.</p>
            </div>
        </div>
        </div>`;
    }

    const statusLabel =
        connectionStatus === 'connecting' ? '⟳ Connecting to trackers…' :
        connectionStatus === 'waiting'    ? '⟳ Waiting for peers…' :
        connectionStatus === 'connected'  ? '● Connected' :
        connectionStatus === 'error'      ? '✕ Connection error' : '';

    const statusClass =
        connectionStatus === 'connected' ? 'p2p-status-ok' :
        connectionStatus === 'error'     ? 'p2p-status-err' : 'p2p-status-wait';

    return `
    <div class="p2p-root">
    <div class="p2p-chat-container">
        <div class="p2p-header">
            <button data-action="chat-leave" class="p2p-back-btn">&larr;</button>
            <div class="p2p-header-info">
                <span class="p2p-room-name">${escapeHtml(currentRoom === PUBLIC_ROOM ? 'Public Lobby' : currentRoom)}</span>
                <span class="p2p-peer-count">${peerCount} peer${peerCount !== 1 ? 's' : ''} connected</span>
            </div>
            <button data-action="chat-reconnect" class="p2p-reconnect-btn" title="Reconnect">⟳</button>
            <div class="p2p-my-nick">${escapeHtml(nickname)}</div>
        </div>

        <div class="p2p-status-bar ${statusClass}">${statusLabel}</div>

        <div class="p2p-peers-bar">
            ${peersHtml}
        </div>

        <div class="p2p-messages" id="p2p-messages">
            ${messagesHtml}
        </div>

        <div class="p2p-input-bar">
            <input id="chat-input" class="p2p-chat-input" type="text" placeholder="Type a message..." autocomplete="off" />
            <button data-action="chat-send" class="p2p-send-btn">&#10148;</button>
        </div>
    </div>
    </div>`;
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
