// Reverse-engineering a no-name ESP32-S3 voice board into a push-to-talk
// client for a live voice AI. Photos live in figures/ beside this file (see
// ASSETS.md). Paths resolve against <base href="/k/">.

const F = 'js/pages/articles/aitoy/figures';
const GH = 'https://github.com/prateek-0-gupta/aitoy';

function photo(file, alt, caption, cls = '') {
    return `
<figure class="art-fig ${cls}">
    <div class="art-fig-img"><img src="${F}/${file}" alt="${alt}" loading="lazy"></div>
    <figcaption>${caption}</figcaption>
</figure>`;
}

// Title and blurb live in ../articles-data.js; this is only the body.
export default `
<header class="art-header">
    <p class="art-kicker">Hardware</p>
    <h1>Reverse-Engineering a No-Name ESP32 Board</h1>
    <p class="art-subtitle">I bought the cheapest "AI voice module" on Amazon, found out which of its pins did what without a schematic, and made it hold a spoken conversation with the voice AI we build at work. Most of the afternoon went on one button.</p>
    <p class="art-meta">Prateek Gupta &middot; Sum Vivas, Manchester &middot; April 2026 &middot; <a href="${GH}" target="_blank" rel="noopener">code</a></p>
</header>

<div class="art-stats">
    <div class="art-stat"><div class="art-stat-n">£20.43</div><div class="art-stat-l">what I paid</div></div>
    <div class="art-stat"><div class="art-stat-n">0</div><div class="art-stat-l">pages of documentation</div></div>
    <div class="art-stat"><div class="art-stat-n">13</div><div class="art-stat-l">pins confirmed</div></div>
    <div class="art-stat"><div class="art-stat-n">1</div><div class="art-stat-l">button that lies</div></div>
</div>

<p>My day job at Sum Vivas is digital humans, and the bit I spend most time on is the voice. We have a service called Thalamus that holds a live spoken conversation over a WebSocket: you stream audio in, it streams audio back, and in between it tells you what it heard and what it said. So far everything that talks to it has been a browser or a phone. I wanted something with no screen at all. A box with a button. Hold the button, say something, let go, listen.</p>

<p>The quickest way to get there was to buy a board that already had a microphone, a speaker and Wi-Fi on it, and Amazon had one for £20.43. The seller was called "Aolidsive". The model name was a keyboard mash. The description had clearly been through a translator twice. I bought it anyway, because the parts list was actually good.</p>

${photo('amazon_screenshot.png', 'the Amazon listing', 'The listing, more or less. This one is a different "brand" at £14.34; mine was "Aolidsive" at £20.43. It is the same board. The word XiaoZhi in the title turns out to matter later.')}

<h2 id="board">What arrived</h2>

<p>A PCB in a plain bag, a small speaker on red wires, and a USB-C cable. On the board:</p>

<ul>
    <li>an ESP32-S3 module with Wi-Fi and Bluetooth</li>
    <li>an INMP441 I2S microphone, the tiny silver thing in the corner</li>
    <li>a MAX98357 I2S amplifier, with a JST plug for the speaker</li>
    <li>a CH340X USB-to-serial chip, so it programs over the USB-C port</li>
    <li>a TP5400 charger with a JST plug for a battery and four LEDs to show the level</li>
    <li>five buttons labelled EN, BOOT, volume&minus;, volume+ and WiFi reset, and a power switch</li>
    <li>a three-pin header on the back marked PIR, for a motion sensor</li>
</ul>

<p>No schematic. No SDK. No link to a repo. The silkscreen gives you the button names and nothing else. Flip it over and there is a part number, <b>ESP32S3-AI V2.2 (303ESP32AI2)</b>, which brings up nothing useful anywhere. That is the whole manual.</p>

<div class="art-cols">
    <div class="art-col" style="flex:1.2">${photo('board_front.jpg', 'the board, front', 'Front. Module in the middle, mic top left, the five buttons down the right edge, USB-C and the speaker and battery plugs on the left.')}</div>
    <div class="art-col" style="flex:1">${photo('board_back.jpg', 'the board, back', 'Back. The PIR header, the battery and speaker labels, and the only part number you get.')}</div>
</div>

<h2 id="home">Is anyone home</h2>

<p>First job, see if Windows can see it. The CH340X should show up as a COM port, and it did.</p>

<pre><code>Get-WmiObject Win32_PnPEntity | Where-Object { $_.Name -match 'CH340' }

Name     : USB-SERIAL CH340 (COM3)
Status   : OK</code></pre>

<p>Then esptool, which will tell you what the chip is if you ask nicely.</p>

<pre><code>esptool --port COM3 chip-id

Chip type:          ESP32-S3 (QFN56) (revision v0.2)
Features:           Wi-Fi, BT 5 (LE), Dual Core + LP Core, 240MHz, Embedded PSRAM 8MB (AP_3v3)
Crystal frequency:  40MHz</code></pre>

<p>An ESP32-S3 with 8&nbsp;MB of PSRAM. The module marking, S3-N16R8, means 16&nbsp;MB of flash and 8&nbsp;MB of PSRAM. For a device whose entire job is to move audio in two directions, that is a lot of room.</p>

<h2 id="pins">Which pin does what</h2>

<p>With no schematic there were two ways to find the pins. One was to trace the board with a multimeter. The other was to notice the word XiaoZhi in the Amazon listing and go and look.</p>

<p><a href="https://github.com/78/xiaozhi-esp32" target="_blank" rel="noopener">Xiaozhi</a> is a big open-source Chinese ESP32 voice-assistant project, tens of thousands of stars and a long list of supported boards. This board is obviously made to sell into that ecosystem, and its <code>bread-compact-wifi</code> configuration uses the same microphone and amplifier. A board built to run someone else's firmware has every reason to copy their pinout.</p>

<pre><code>// xiaozhi-esp32/main/boards/bread-compact-wifi/config.h
#define AUDIO_I2S_MIC_GPIO_WS   GPIO_NUM_4
#define AUDIO_I2S_MIC_GPIO_SCK  GPIO_NUM_5
#define AUDIO_I2S_MIC_GPIO_DIN  GPIO_NUM_6
#define AUDIO_I2S_SPK_GPIO_DOUT GPIO_NUM_7
#define AUDIO_I2S_SPK_GPIO_BCLK GPIO_NUM_15
#define AUDIO_I2S_SPK_GPIO_LRCK GPIO_NUM_16
#define BOOT_BUTTON_GPIO        GPIO_NUM_0
#define VOLUME_UP_BUTTON_GPIO   GPIO_NUM_40
#define VOLUME_DOWN_BUTTON_GPIO GPIO_NUM_39
#define BUILTIN_LED_GPIO        GPIO_NUM_48</code></pre>

<p>That is a guess, not a pin map, so I wrote a test firmware to check every line of it. A PlatformIO project, the Arduino framework, and a serial menu with four tests: watch the buttons for ten seconds, play tones through the speaker, read the mic and print a level meter, and pipe the mic straight into the speaker. A short Python script drives the menu over the serial port.</p>

<div class="art-table-cap"><b>Table 1.</b> What the test firmware found.</div>
<div class="art-table-wrap"><table class="art-table">
<thead><tr><th>Part</th><th>Result</th></tr></thead>
<tbody>
<tr><td>ESP32-S3 at 240&nbsp;MHz</td><td>fine</td></tr>
<tr><td>PSRAM, 8&nbsp;MB</td><td>8,386,279 bytes, after one fix</td></tr>
<tr><td>Speaker, MAX98357</td><td>440, 880 and 1760&nbsp;Hz, then a sweep, all clean</td></tr>
<tr><td>Microphone, INMP441</td><td>audio, but a peak of 841 out of 32,767</td></tr>
<tr><td>Loopback</td><td>my voice out of the speaker, quietly</td></tr>
<tr><td>volume&minus; on GPIO39, volume+ on GPIO40</td><td>confirmed, active low</td></tr>
<tr><td>BOOT on GPIO0</td><td>confirmed, with a catch</td></tr>
<tr><td>WiFi reset</td><td>reboots the chip. It is wired to EN, not to a GPIO at all</td></tr>
</tbody></table></div>

<p>Every borrowed pin was right. Two lines in that table come back to bite later: the mic is very quiet, and the WiFi reset button is not a button you can read.</p>

<h3>The PSRAM one</h3>

<p>First boot said this and carried on with no PSRAM at all:</p>

<pre><code>E (89) psram: PSRAM ID read error: 0x00ffffff</code></pre>

<p>The Arduino framework assumes quad-SPI PSRAM. This module has octal. One line in <code>platformio.ini</code> fixes it:</p>

<pre><code>board_build.arduino.memory_type = qio_opi</code></pre>

<p>After that, <code>PSRAM: 8386279 bytes</code>. All of it.</p>

<h2 id="thalamus">Talking to Thalamus</h2>

<p>The <code>/chat/live</code> endpoint is a WebSocket. You send raw 16-bit PCM at 16&nbsp;kHz, mono, as binary frames. It sends back raw 16-bit PCM at 24&nbsp;kHz, mono, also as binary frames, with JSON text frames in between for events: <code>session_started</code>, <code>transcript</code>, <code>turn_complete</code>, <code>interrupted</code>, <code>error</code>.</p>

<p>The ESP32-S3 has two I2S peripherals, which suits this exactly. One runs the mic at 16&nbsp;kHz, the rate the server listens at. The other runs the speaker at 24&nbsp;kHz, the rate the server talks at. No resampling either way.</p>

<p>It also has two cores, and I used both.</p>

<pre><code>Core 1, main loop
  read the push-to-talk button
  while held: read 20 ms of mic audio, apply gain, send it as a binary frame
  service the WebSocket
    binary frame  -> ring buffer in PSRAM
    text frame    -> parse the JSON, log the event

Core 0, pinned tasks
  playback: ring buffer -> volume -> I2S write, forever
  LED: a blink pattern per state (connecting, idle, recording, playing, error)</code></pre>

<p>Playback gets its own core because an I2S write blocks until the DMA buffer has room. Share that core with a TLS WebSocket client and the audio stutters every time the network does anything. The ring buffer is one second of 24&nbsp;kHz audio, 48,000 bytes, in PSRAM so the main heap is left alone for TLS.</p>

<p>Two libraries did the heavy lifting, <code>links2004/WebSockets</code> for the secure WebSocket and <code>bblanchon/ArduinoJson</code> for the events. The rest is <code>WiFi.h</code> and the I2S driver.</p>

<h2 id="bugs">Three things that went wrong</h2>

<h3>1. The button that lies</h3>

<p>BOOT on GPIO0 is the biggest button on the board, so it became push-to-talk. The firmware then acted as if it was being held down permanently. Recording started at boot and never stopped.</p>

<p>This is the CH340X. USB-serial chips on ESP32 boards use GPIO0 as a strapping pin, so a flashing tool can drop the chip into its bootloader, and they drive it from the serial port's DTR and RTS lines. Open the port with DTR asserted, which nearly every serial monitor does by default, and the chip holds GPIO0 low. Low is exactly what a pressed button looks like.</p>

<p>My first fix was to move push-to-talk to the WiFi reset button, which I had assumed was GPIO47. Pressing it rebooted the board. That button goes straight to EN, the hardware reset, and no firmware in the world can read it. So the fix that stuck is the boring one: keep GPIO0, and open the serial port properly.</p>

<pre><code># monitor.py
ser = serial.Serial("COM3", 115200, timeout=1, dsrdtr=False, rtscts=False)
ser.dtr = False          # leave GPIO0 alone
ser.rts = True           # pulse EN to reset the board
time.sleep(0.1)
ser.rts = False</code></pre>

<p>The firmware now checks GPIO0 at boot and complains if it is stuck low. I wrote that check last. It should have been first.</p>

<pre><code>[BTN] BOOT/PTT (GPIO0) = LOW (stuck!)
[BTN] WARNING: GPIO0 held LOW by USB chip — PTT may not work.
[BTN]   Try: close other serial tools, or disconnect/reconnect USB.</code></pre>

<h3>2. The whisper</h3>

<p>The INMP441 on this board is quiet. Talking straight into it gave a peak of 841 on a 16-bit scale, about 2.5% of the range. Sent as-is, the server transcribed everything as noise, which is fair, because it mostly was.</p>

<p>The fix is gain in software, with clipping, on every 20&nbsp;ms block before it goes out:</p>

<pre><code>#define MIC_GAIN 20

for (int i = 0; i &lt; numSamples; i++) {
    int32_t amplified = (int32_t)micBuf[i] * MIC_GAIN;
    if (amplified &gt; 32767) amplified = 32767;
    else if (amplified &lt; -32768) amplified = -32768;
    micBuf[i] = (int16_t)amplified;
}</code></pre>

<p>Normal speech now peaks around 16,000, which is where speech recognisers are happy. Twenty times is a lot, and it amplifies the hiss too, but the recogniser copes and the alternative was silence.</p>

<h3>3. The echo</h3>

<p>Once the assistant could hear me, it could hear itself. The mic is a few centimetres from the speaker. It would answer, the mic would pick the answer up, the server would transcribe its own voice as my next question and reply to that, and the two of them would happily carry on without me.</p>

<p>Real echo cancellation is a project on its own. Push-to-talk makes it unnecessary. The device is strictly half-duplex: audio only leaves the board while the button is held, and pressing the button flushes the playback buffer and zeroes the speaker's DMA buffer, so the assistant shuts up the moment I start.</p>

<pre><code>// on PTT press
ringFlush();
i2s_zero_dma_buffer(SPK_I2S_PORT);</code></pre>

<h2 id="first">It talks</h2>

<p>With those three sorted, boot looks like this:</p>

<pre><code>==========================================
 ESP32-S3 Push-to-Talk — Thalamus Live
 Board: ESP32S3-AI V2.2 (N16R8)
==========================================
 Chip: ESP32-S3 Rev 0
 PSRAM: 8386279 bytes
 Free Heap: 332980 bytes

[Mem] Ring buffer: 48000 bytes in PSRAM
[WiFi] Connected! IP: 192.168.0.233
[WiFi] RSSI: -38 dBm
[I2S] Mic initialized (16kHz, I2S_NUM_1)
[I2S] Speaker initialized (24kHz, I2S_NUM_0)
[WS] Connected to Thalamus!
[Session] Started: esp32-aitoy-001</code></pre>

<p>I held the button and asked it who it was. The speaker answered in the demo persona's voice, and the log showed both halves:</p>

<pre><code>[PTT] &gt;&gt; Recording started
[user] Hello, who are you?
[PTT] &lt;&lt; Recording stopped
[assistant] Hi! You're through to Summer from Sum Vivas, how may I help you?
[Turn] 1 complete</code></pre>

<p>A £20 board with no documentation, talking. It is a small thing and I was unreasonably pleased with it.</p>

<h2 id="pinmap">The pin map</h2>

<p>This is the table I wish had been in the bag. If you buy this board under any of its names, it is the same board.</p>

<div class="art-table-cap"><b>Table 2.</b> ESP32S3-AI V2.2 (303ESP32AI2), verified.</div>
<div class="art-table-wrap"><table class="art-table">
<thead><tr><th>Function</th><th>GPIO</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>INMP441 WS</td><td>4</td><td>I2S word select</td></tr>
<tr><td>INMP441 SCK</td><td>5</td><td>I2S bit clock</td></tr>
<tr><td>INMP441 SD</td><td>6</td><td>I2S data in. L/R is tied to ground, so read the left channel only</td></tr>
<tr><td>MAX98357 DIN</td><td>7</td><td>I2S data out</td></tr>
<tr><td>MAX98357 BCLK</td><td>15</td><td>I2S bit clock</td></tr>
<tr><td>MAX98357 LRCK</td><td>16</td><td>I2S word select</td></tr>
<tr><td>volume&minus;</td><td>39</td><td>active low, internal pull-up</td></tr>
<tr><td>volume+</td><td>40</td><td>active low, internal pull-up</td></tr>
<tr><td>BOOT</td><td>0</td><td>active low. Only readable if the serial port is opened with DTR deasserted</td></tr>
<tr><td>WiFi reset</td><td>&mdash;</td><td>wired to EN. It resets the chip and cannot be read</td></tr>
<tr><td>EN</td><td>&mdash;</td><td>hardware reset</td></tr>
<tr><td>LED</td><td>48</td><td>active high</td></tr>
<tr><td>PIR header</td><td>?</td><td>GND / OUT / VCC on the back. I have not mapped OUT yet</td></tr>
<tr><td>speaker, bat</td><td>&mdash;</td><td>JST plugs, labelled on the back</td></tr>
<tr><td>on-off</td><td>&mdash;</td><td>slide switch, cuts the battery</td></tr>
</tbody></table></div>

<h2 id="bom">What it cost</h2>

<div class="art-table-wrap"><table class="art-table">
<thead><tr><th>Item</th><th>Cost</th></tr></thead>
<tbody>
<tr><td>the board, speaker and cable</td><td>£20.43</td></tr>
<tr><td>PlatformIO, Arduino, two libraries</td><td>nothing</td></tr>
<tr><td><b>Total</b></td><td><b>£20.43</b></td></tr>
</tbody></table></div>

<h2 id="next">Next time</h2>

<ol>
    <li><b>Buy a board with a schematic.</b> The boards the Xiaozhi project actually recommends come with one, and with firmware that already works. Most of my afternoon was pin discovery that should have taken a minute.</li>
    <li><b>Use ESP-IDF instead of Arduino.</b> The Arduino I2S driver is the old, deprecated one. ESP-IDF 5 has a channel-based I2S API with better buffer control and less latency.</li>
    <li><b>Lose the button.</b> Espressif's ESP-SR library has an echo canceller built for the S3's two cores. With that the device could listen all the time and the button could go.</li>
    <li><b>Compress the audio.</b> Raw 16&nbsp;kHz PCM is about 32&nbsp;kB/s upstream. Opus would make that 3 to 6&nbsp;kB/s with no audible delay, which matters on office Wi-Fi.</li>
</ol>

<h2 id="lessons">Two things worth remembering</h2>

<p><b>GPIO0 on any ESP32 board with a USB-serial chip is a trap.</b> It looks like a normal button. It behaves like one in a test sketch. Then it betrays you the moment a serial monitor opens the port with DTR on, because the CH340X or CP2102 or FTDI on the board is holding it low for you. Test buttons with the cable in and the monitor open, or you are testing a different device from the one you will use.</p>

<p><b>INMP441 levels vary a lot between boards.</b> Some breakouts put gain in front of the I2S bus. Cheap integrated boards don't. Measure the raw peak first, then add gain in software with clipping.</p>

<p>For the money the board is better than it has any right to be. The I2S routing is clean, the buttons make sense once you know where they go, and the battery circuit means a 3.7&nbsp;V LiPo would make it properly portable. It just needs someone to publish the schematic. Until then there is the table above, and the firmware, the test sketch and the serial scripts are all in <a href="${GH}" target="_blank" rel="noopener">the repo</a>.</p>
`;
