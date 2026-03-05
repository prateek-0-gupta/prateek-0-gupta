import { useEffect } from '../../framework.js';

let _cleanup = null;

export default function SnakePage() {
    useEffect(() => {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        _cleanup = initGothicSnake();
    }, []);

    return `
    <div id="gs-root">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=MedievalSharp&family=Cinzel:wght@400;700;900&family=Cinzel+Decorative:wght@400;700&display=swap');
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body, html {
            width: 100%;
            height: 100%;
            overflow: hidden;
            /* A deep, dark stone color as a fallback background */
            background-color: #120d10; 
        }

        canvas {
            display: block;
            image-rendering: pixelated; /* Keeps sprite art crisp if we go pixel-art style */
        }
        </style>

        <div id="gs-header">
            <div id="gs-title">Gothic Snake</div>
            <div id="gs-subtitle">A dungeon serpent's tale</div>
        </div>

       <canvas id="gameCanvas"></canvas>
    `;
}

function initGothicSnake() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Game constants
    const TILE_SIZE = 48;
    let cols, rows;

    // Handle window resizing
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        cols = Math.floor(canvas.width / TILE_SIZE);
        rows = Math.floor(canvas.height / TILE_SIZE);
    }
    window.addEventListener('resize', resize);
    resize();

    // Snake entity
    let snake = {
        x: Math.floor(cols / 2),
        y: Math.floor(rows / 2),
        dx: 0,
        dy: 0
    };

    // Game loop variables
    let lastRenderTime = 0;
    const SNAKE_SPEED = 8; // Tiles moved per second
    let animFrameId = null;

    function main(currentTime) {
        animFrameId = window.requestAnimationFrame(main);

        const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
        if (secondsSinceLastRender < 1 / SNAKE_SPEED) return;

        lastRenderTime = currentTime;
        update();
        draw();
    }

    // Input handling (WASD)
    function onKeyDown(e) {
        switch (e.key.toLowerCase()) {
            case 'w':
                if (snake.dy === 0) { snake.dx = 0; snake.dy = -1; }
                break;
            case 's':
                if (snake.dy === 0) { snake.dx = 0; snake.dy = 1; }
                break;
            case 'a':
                if (snake.dx === 0) { snake.dx = -1; snake.dy = 0; }
                break;
            case 'd':
                if (snake.dx === 0) { snake.dx = 1; snake.dy = 0; }
                break;
        }
    }
    window.addEventListener('keydown', onKeyDown);

    function update() {
        if (snake.dx === 0 && snake.dy === 0) return;

        snake.x += snake.dx;
        snake.y += snake.dy;

        // Screen wrap
        if (snake.x < 0) snake.x = cols - 1;
        if (snake.x >= cols) snake.x = 0;
        if (snake.y < 0) snake.y = rows - 1;
        if (snake.y >= rows) snake.y = 0;
    }

    function draw() {
        ctx.fillStyle = '#120d10';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#251a20';
        ctx.lineWidth = 1;
        for (let i = 0; i <= cols; i++) {
            ctx.beginPath(); ctx.moveTo(i * TILE_SIZE, 0); ctx.lineTo(i * TILE_SIZE, canvas.height); ctx.stroke();
        }
        for (let i = 0; i <= rows; i++) {
            ctx.beginPath(); ctx.moveTo(0, i * TILE_SIZE); ctx.lineTo(canvas.width, i * TILE_SIZE); ctx.stroke();
        }

        // Draw snake head placeholder
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(snake.x * TILE_SIZE, snake.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Start the game loop
    animFrameId = window.requestAnimationFrame(main);

    // Return cleanup function
    return function cleanup() {
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', onKeyDown);
        if (animFrameId !== null) {
            window.cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    };
}
