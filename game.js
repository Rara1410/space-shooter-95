// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('spaceShooterHighScore') || 0;
let asteroidSpawnTimer = 0;
let starfield = [];

// Display Elements
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const highScoreElement = document.getElementById('highScore');
const gameStatusElement = document.getElementById('gameStatus');

// Update high score display
highScoreElement.textContent = highScore;

// Player Ship
const player = {
    x: canvas.width / 2,
    y: canvas.height - 100,
    width: 30,
    height: 40,
    speed: 5,
    dx: 0,
    dy: 0,
    canShoot: true,
    shootCooldown: 0
};

// Game Objects Arrays
let bullets = [];
let asteroids = [];
let particles = [];

// Controls
const keys = {};

// Initialize starfield
function createStarfield() {
    for (let i = 0; i < 100; i++) {
        starfield.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
}

// Sound Effects using Web Audio API
class RetroSound {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    playShoot() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    playExplosion() {
        const noise = this.audioContext.createBufferSource();
        const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.2, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        noise.buffer = buffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.2);
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        noise.start();
    }

    playHit() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }
}

const sound = new RetroSound();

// Bullet Class
class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 3;
        this.height = 10;
        this.speed = 10;
        this.active = true;
    }

    update() {
        this.y -= this.speed;
        if (this.y < -this.height) {
            this.active = false;
        }
    }

    draw() {
        ctx.fillStyle = '#0ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0ff';
        ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

// Asteroid Class
class Asteroid {
    constructor() {
        this.size = Math.random() * 30 + 20;
        this.x = Math.random() * (canvas.width - this.size);
        this.y = -this.size;
        this.speed = Math.random() * 3 + 1;
        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        this.active = true;
        this.vertices = this.generateVertices();
    }

    generateVertices() {
        const vertices = [];
        const sides = 8;
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const variance = 0.8 + Math.random() * 0.4;
            vertices.push({
                x: Math.cos(angle) * this.size * variance,
                y: Math.sin(angle) * this.size * variance
            });
        }
        return vertices;
    }

    update() {
        this.y += this.speed;
        this.rotation += this.rotationSpeed;
        
        if (this.y > canvas.height + this.size) {
            this.active = false;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.strokeStyle = '#f0f';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f0f';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// Particle Class for explosions
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1;
        this.color = color;
        this.size = Math.random() * 3 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.restore();
    }
}

// Create explosion effect
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Draw player ship
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Ship body
    ctx.fillStyle = '#0ff';
    ctx.strokeStyle = '#0ff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#0ff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(0, -player.height/2);
    ctx.lineTo(-player.width/2, player.height/2);
    ctx.lineTo(0, player.height/3);
    ctx.lineTo(player.width/2, player.height/2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    
    // Engine glow
    if (gameState === 'PLAYING') {
        ctx.fillStyle = '#ff0';
        ctx.shadowColor = '#ff0';
        ctx.beginPath();
        ctx.moveTo(-player.width/4, player.height/2);
        ctx.lineTo(0, player.height/2 + Math.random() * 10 + 5);
        ctx.lineTo(player.width/4, player.height/2);
        ctx.closePath();
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

// Update game objects
function updateGame() {
    if (gameState !== 'PLAYING') return;
    
    // Update starfield
    starfield.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
    
    // Update player
    player.x += player.dx;
    player.y += player.dy;
    
    // Keep player in bounds
    player.x = Math.max(player.width/2, Math.min(canvas.width - player.width/2, player.x));
    player.y = Math.max(player.height/2, Math.min(canvas.height - player.height/2, player.y));
    
    // Update shoot cooldown
    if (player.shootCooldown > 0) {
        player.shootCooldown--;
    }
    
    // Update bullets
    bullets = bullets.filter(bullet => {
        bullet.update();
        return bullet.active;
    });
    
    // Update asteroids
    asteroids = asteroids.filter(asteroid => {
        asteroid.update();
        return asteroid.active;
    });
    
    // Update particles
    particles = particles.filter(particle => {
        particle.update();
        return particle.life > 0;
    });
    
    // Spawn asteroids
    asteroidSpawnTimer++;
    if (asteroidSpawnTimer > 60 - Math.min(score / 100, 40)) {
        asteroids.push(new Asteroid());
        asteroidSpawnTimer = 0;
    }
    
    // Check collisions
    checkCollisions();
}

// Collision detection
function checkCollisions() {
    // Bullet-Asteroid collisions
    bullets.forEach(bullet => {
        asteroids.forEach(asteroid => {
            if (bullet.active && asteroid.active) {
                const dist = Math.sqrt(
                    Math.pow(bullet.x - asteroid.x, 2) + 
                    Math.pow(bullet.y - asteroid.y, 2)
                );
                
                if (dist < asteroid.size) {
                    bullet.active = false;
                    asteroid.active = false;
                    score += Math.floor(50 / asteroid.size * 10);
                    updateScore();
                    createExplosion(asteroid.x, asteroid.y, '#f0f');
                    sound.playExplosion();
                }
            }
        });
    });
    
    // Player-Asteroid collisions
    asteroids.forEach(asteroid => {
        if (asteroid.active) {
            const dist = Math.sqrt(
                Math.pow(player.x - asteroid.x, 2) + 
                Math.pow(player.y - asteroid.y, 2)
            );
            
            if (dist < asteroid.size + player.width/2) {
                asteroid.active = false;
                lives--;
                updateLives();
                createExplosion(player.x, player.y, '#ff0');
                sound.playHit();
                
                if (lives <= 0) {
                    gameOver();
                }
            }
        }
    });
}

// Update score display
function updateScore() {
    scoreElement.textContent = score;
}

// Update lives display
function updateLives() {
    livesElement.textContent = lives;
}

// Game over
function gameOver() {
    gameState = 'GAMEOVER';
    gameStatusElement.textContent = 'GAME OVER - PRESS ENTER TO RESTART';
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('spaceShooterHighScore', highScore);
        highScoreElement.textContent = highScore;
    }
}

// Reset game
function resetGame() {
    score = 0;
    lives = 3;
    bullets = [];
    asteroids = [];
    particles = [];
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.dx = 0;
    player.dy = 0;
    asteroidSpawnTimer = 0;
    updateScore();
    updateLives();
    gameState = 'PLAYING';
    gameStatusElement.textContent = '';
}

// Draw everything
function draw() {
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw starfield
    ctx.fillStyle = '#fff';
    starfield.forEach(star => {
        ctx.globalAlpha = star.size / 2;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.globalAlpha = 1;
    
    // Draw game objects
    if (gameState === 'PLAYING' || gameState === 'GAMEOVER') {
        drawPlayer();
        bullets.forEach(bullet => bullet.draw());
        asteroids.forEach(asteroid => asteroid.draw());
        particles.forEach(particle => particle.draw());
    }
    
    // Draw start screen
    if (gameState === 'START') {
        ctx.fillStyle = '#0ff';
        ctx.font = '24px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#0ff';
        ctx.fillText('PRESS ENTER TO START', canvas.width/2, canvas.height/2);
        ctx.font = '16px Orbitron';
        ctx.fillText('ARROW KEYS TO MOVE • SPACE TO FIRE', canvas.width/2, canvas.height/2 + 40);
        ctx.shadowBlur = 0;
    }
}

// Game loop
function gameLoop() {
    updateGame();
    draw();
    requestAnimationFrame(gameLoop);
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === 'Enter') {
        if (gameState === 'START' || gameState === 'GAMEOVER') {
            resetGame();
        }
    }
    
    if (gameState === 'PLAYING') {
        // Movement
        if (e.key === 'ArrowLeft') player.dx = -player.speed;
        if (e.key === 'ArrowRight') player.dx = player.speed;
        if (e.key === 'ArrowUp') player.dy = -player.speed;
        if (e.key === 'ArrowDown') player.dy = player.speed;
        
        // Shooting
        if (e.key === ' ' && player.shootCooldown === 0) {
            bullets.push(new Bullet(player.x, player.y - player.height/2));
            player.shootCooldown = 10;
            sound.playShoot();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    
    if (gameState === 'PLAYING') {
        if (e.key === 'ArrowLeft' && player.dx < 0) player.dx = 0;
        if (e.key === 'ArrowRight' && player.dx > 0) player.dx = 0;
        if (e.key === 'ArrowUp' && player.dy < 0) player.dy = 0;
        if (e.key === 'ArrowDown' && player.dy > 0) player.dy = 0;
    }
});

// Initialize and start game
createStarfield();
gameLoop(); 