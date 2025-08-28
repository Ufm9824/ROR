// == Roguelike Shooter Game ==

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  let width = window.innerWidth;
  let height = window.innerHeight;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }
  resize();
  window.addEventListener("resize", resize);

  const player = {
    x: width / 2,
    y: height / 2,
    size: 30,
    speed: 3.5,
    health: 100,
    maxHealth: 100,
    attackDamage: 10,
    attackSpeed: 400,
    attackCooldown: 0,
    dashCooldownMax: 2000,
    dashCooldown: 0,
    dashSpeed: 15,
    isDashing: false,
    dashTime: 0,
    angle: 0,
    gold: 0,
    healthRegen: 0,
  };

  let keys = {};
  let mouseX = 0;
  let mouseY = 0;
  const enemies = [];
  const bullets = [];
  const pickups = [];
  const chests = [];
  let portal = null;

  let wave = 1;
  let enemiesToSpawn = 5;
  let enemiesKilledThisWave = 0;
  let bossKilledThisWave = false;
  let chestCost = 25;
  let gameOver = false;
  let showEndScreen = false;

  const stats = {
    kills: 0,
    damage: 0,
    coinsEarned: 0,
  };

  // Part 2 of game.js

function initGame() {
  // Initialize game variables
  player = {
    x: 50,
    y: 50,
    width: 40,
    height: 40,
    speed: 5,
    dx: 0,
    dy: 0
  };

  enemies = [];
  bullets = [];
  score = 0;
  isGameOver = false;

  spawnEnemy();
}

function spawnEnemy() {
  const enemy = {
    x: Math.random() * (canvas.width - 40),
    y: 0,
    width: 40,
    height: 40,
    speed: 2 + Math.random() * 3
  };
  enemies.push(enemy);
}

// Movement handlers
function movePlayer() {
  player.x += player.dx;
  player.y += player.dy;

  // Boundaries
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
  if (player.y < 0) player.y = 0;
  if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
}


// Part 2 of game.js

function initGame() {
  // Initialize game variables
  player = {
    x: 50,
    y: 50,
    width: 40,
    height: 40,
    speed: 5,
    dx: 0,
    dy: 0
  };

  enemies = [];
  bullets = [];
  score = 0;
  isGameOver = false;

  spawnEnemy();
}

function spawnEnemy() {
  const enemy = {
    x: Math.random() * (canvas.width - 40),
    y: 0,
    width: 40,
    height: 40,
    speed: 2 + Math.random() * 3
  };
  enemies.push(enemy);
}

// Movement handlers
function movePlayer() {
  player.x += player.dx;
  player.y += player.dy;

  // Boundaries
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
  if (player.y < 0) player.y = 0;
  if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
}


// Part 3 of game.js

function updateEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].y += enemies[i].speed;

    // Remove enemies that move off screen
    if (enemies[i].y > canvas.height) {
      enemies.splice(i, 1);
      // Optionally decrease score or lives here
    }
  }

  // Spawn new enemies periodically
  if (Math.random() < 0.02) {
    spawnEnemy();
  }
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= bullets[i].speed;

    // Remove bullets that go off screen
    if (bullets[i].y < 0) {
      bullets.splice(i, 1);
    }
  }
}


// Part 4 of game.js

function checkCollisions() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    for (let j = bullets.length - 1; j >= 0; j--) {
      const bullet = bullets[j];

      // Simple circle collision detection
      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < enemy.radius + bullet.radius) {
        // Remove enemy and bullet on collision
        enemies.splice(i, 1);
        bullets.splice(j, 1);
        score += 10; // Increase score
        break;
      }
    }

    // Check collision between enemy and player
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < enemy.radius + player.radius) {
      // Game over logic here
      gameOver = true;
    }
  }
}

function draw() {
  // Clear the canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw player
  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // Draw enemies
  ctx.fillStyle = 'red';
  enemies.forEach(enemy => {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw bullets
  ctx.fillStyle = 'yellow';
  bullets.forEach(bullet => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw score
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText(`Score: ${score}`, 10, 30);
}

function gameLoop() {
  if (gameOver) {
    ctx.fillStyle = 'white';
    ctx.font = '50px Arial';
    ctx.fillText('Game Over!', canvas.width / 2 - 130, canvas.height / 2);
    ctx.font = '30px Arial';
    ctx.fillText(`Final Score: ${score}`, canvas.width / 2 - 100, canvas.height / 2 + 50);
    return;
  }

  updatePlayer();
  updateEnemies();
  updateBullets();
  checkCollisions();
  draw();

  requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();

// Part 5 of game.js

// Player properties
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 20,
  speed: 5,
  dx: 0,
  dy: 0
};

let score = 0;
let gameOver = false;

// Arrays to store enemies and bullets
const enemies = [];
const bullets = [];

// Controls state
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false
};

// Event listeners for keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.code in keys) {
    keys[e.code] = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in keys) {
    keys[e.code] = false;
  }
});

function updatePlayer() {
  player.dx = 0;
  player.dy = 0;

  if (keys.ArrowUp) player.dy = -player.speed;
  if (keys.ArrowDown) player.dy = player.speed;
  if (keys.ArrowLeft) player.dx = -player.speed;
  if (keys.ArrowRight) player.dx = player.speed;

  player.x += player.dx;
  player.y += player.dy;

  // Keep player inside the canvas boundaries
  if (player.x - player.radius < 0) player.x = player.radius;
  if (player.x + player.radius > canvas.width) player.x = canvas.width - player.radius;
  if (player.y - player.radius < 0) player.y = player.radius;
  if (player.y + player.radius > canvas.height) player.y = canvas.height - player.radius;

  // Shooting bullets when space is pressed
  if (keys.Space) {
    shootBullet();
  }
}

let lastBulletTime = 0;
const bulletCooldown = 300; // milliseconds between shots

function shootBullet() {
  const now = Date.now();
  if (now - lastBulletTime < bulletCooldown) return;

  bullets.push({
    x: player.x,
    y: player.y,
    radius: 5,
    speed: 10,
    dy: -10 // Bullets go upward
  });

  lastBulletTime = now;
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.y += bullet.dy;

    // Remove bullets that leave the screen
    if (bullet.y + bullet.radius < 0) {
      bullets.splice(i, 1);
    }
  }
}

function spawnEnemy() {
  const radius = 20;
  let x, y;

  // Spawn enemies randomly from the edges
  const edge = Math.floor(Math.random() * 4);

  if (edge === 0) { // Top edge
    x = Math.random() * canvas.width;
    y = -radius;
  } else if (edge === 1) { // Right edge
    x = canvas.width + radius;
    y = Math.random() * canvas.height;
  } else if (edge === 2) { // Bottom edge
    x = Math.random() * canvas.width;
    y = canvas.height + radius;
  } else { // Left edge
    x = -radius;
    y = Math.random() * canvas.height;
  }

  enemies.push({
    x: x,
    y: y,
    radius: radius,
    speed: 2
  });
}

function updateEnemies() {
  enemies.forEach(enemy => {
    // Move enemies towards the player
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    enemy.x += (dx / dist) * enemy.speed;
    enemy.y += (dy / dist) * enemy.speed;
  });
}

// Spawn enemies at intervals
setInterval(() => {
  if (!gameOver) {
    spawnEnemy();
  }
}, 2000);

// Part 6 (final) of game.js

function detectCollisions() {
  // Check bullet-enemy collisions
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    for (let j = bullets.length - 1; j >= 0; j--) {
      const bullet = bullets[j];

      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < enemy.radius + bullet.radius) {
        // Remove enemy and bullet on collision
        enemies.splice(i, 1);
        bullets.splice(j, 1);
        score += 10;
        break;
      }
    }
  }

  // Check enemy-player collisions
  for (let enemy of enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < enemy.radius + player.radius) {
      gameOver = true;
      break;
    }
  }
}

function drawPlayer() {
  ctx.fillStyle = 'lime';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemies() {
  ctx.fillStyle = 'red';
  enemies.forEach(enemy => {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBullets() {
  ctx.fillStyle = 'yellow';
  bullets.forEach(bullet => {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawScore() {
  ctx.fillStyle = 'white';
  ctx.font = '24px Arial';
  ctx.fillText(`Score: ${score}`, 20, 40);
}

function drawGameOver() {
  ctx.fillStyle = 'white';
  ctx.font = '48px Arial';
  ctx.fillText('Game Over!', canvas.width / 2 - 120, canvas.height / 2);
  ctx.font = '24px Arial';
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2 - 80, canvas.height / 2 + 40);
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameOver) {
    updatePlayer();
    updateBullets();
    updateEnemies();
    detectCollisions();

    drawPlayer();
    drawBullets();
    drawEnemies();
    drawScore();

    requestAnimationFrame(gameLoop);
  } else {
    drawGameOver();
  }
}

// Start the game loop
gameLoop();
