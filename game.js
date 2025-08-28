// == Setup ==
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let width, height;
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}
resize();
window.addEventListener("resize", resize);

// == Globals ==
const player = {
  x: width / 2,
  y: height / 2,
  size: 30,
  speed: 3.5,
  health: 100,
  maxHealth: 100,
  attackDamage: 10,
  attackSpeed: 400, // ms between shots
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

// Time Stop upgrade variables
let timeStopUnlocked = false;
let timeStopActive = false;
let timeStopDurationBase = 5000; // 5 seconds base
let timeStopDurationExtension = 0;
let timeStopTimer = 0;

// == Input handling ==
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

  // Activate time stop with Q
  if (e.key.toLowerCase() === "q" && timeStopUnlocked && !timeStopActive) {
    timeStopActive = true;
    timeStopTimer = timeStopDurationBase + timeStopDurationExtension;
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

// == Utility functions ==
function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isInsideWall(x, y) {
  return x < 50 || x > width - 50 || y < 50 || y > height - 50;
}

// == Player update ==
function updatePlayer(delta) {
  let moveX = 0,
    moveY = 0;
  if (keys["w"]) moveY -= 1;
  if (keys["s"]) moveY += 1;
  if (keys["a"]) moveX -= 1;
  if (keys["d"]) moveX += 1;

  const length = Math.hypot(moveX, moveY);
  if (length > 0) {
    moveX /= length;
    moveY /= length;
  }

  if (player.isDashing) {
    player.x += Math.cos(player.angle) * player.dashSpeed;
    player.y += Math.sin(player.angle) * player.dashSpeed;
    player.dashTime -= delta;
    if (player.dashTime <= 0) {
      player.isDashing = false;
      player.dashCooldown = player.dashCooldownMax;
    }
  } else {
    player.x += moveX * player.speed;
    player.y += moveY * player.speed;
    if (keys["shift"] && player.dashCooldown <= 0) {
      player.isDashing = true;
      player.dashTime = 150;
      player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    }
  }

  player.x = clamp(player.x, 20, width - 20);
  player.y = clamp(player.y, 20, height - 20);

  if (player.dashCooldown > 0) {
    player.dashCooldown -= delta;
  }

  // Update aiming angle
  player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);

  // Health regen (if no time stop)
  if (
    player.health < player.maxHealth &&
    player.healthRegen > 0 &&
    !timeStopActive
  ) {
    player.health += player.healthRegen * (delta / 1000);
    if (player.health > player.maxHealth) player.health = player.maxHealth;
  }
}

// == Bullet class ==
class Bullet {
  constructor(x, y, angle, speed, damage, isPlayerBullet = true) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.damage = damage;
    this.radius = 5;
    this.isPlayerBullet = isPlayerBullet;
    this.isDead = false;
  }

  update(delta) {
    if (timeStopActive && !this.isPlayerBullet) return;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Remove if outside canvas
    if (
      this.x < 0 ||
      this.x > width ||
      this.y < 0 ||
      this.y > height
    ) {
      this.isDead = true;
    }
  }

  draw() {
    ctx.fillStyle = this.isPlayerBullet ? "#0ff" : "#f00";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// == Enemy class ==
class Enemy {
  constructor(x, y, size, speed, health, damage) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = speed;
    this.health = health;
    this.maxHealth = health;
    this.damage = damage;
    this.isDead = false;
  }

  update(delta) {
    if (timeStopActive) return;

    // Move towards player
    const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
    this.x += Math.cos(angleToPlayer) * this.speed;
    this.y += Math.sin(angleToPlayer) * this.speed;

    // Collide with player
    if (distance(this.x, this.y, player.x, player.y) < this.size + player.size) {
      player.health -= this.damage;
      this.isDead = true;
      if (player.health <= 0) {
        gameOver = true;
        showEndScreen = true;
      }
    }
  }

  draw() {
    ctx.fillStyle = "#f33";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Draw health bar
    ctx.fillStyle = "#0f0";
    ctx.fillRect(this.x - this.size, this.y - this.size - 10, (this.health / this.maxHealth) * this.size * 2, 5);
  }
}

// == Pickups class ==
class Pickup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // e.g., "health", "gold"
    this.radius = 10;
    this.isCollected = false;
  }

  update() {
    if (distance(this.x, this.y, player.x, player.y) < player.size + this.radius) {
      this.isCollected = true;
      if (this.type === "health") {
        player.health = Math.min(player.maxHealth, player.health + 20);
      } else if (this.type === "gold") {
        player.gold += 10;
      }
    }
  }

  draw() {
    ctx.fillStyle = this.type === "health" ? "#0f0" : "#ff0";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// == Chest class (simplified) ==
class Chest {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 25;
    this.isOpened = false;
  }

  update() {
    if (!this.isOpened && distance(this.x, this.y, player.x, player.y) < player.size + this.size) {
      if (player.gold >= chestCost) {
        player.gold -= chestCost;
        this.isOpened = true;
        // Give random pickup as reward
        pickups.push(new Pickup(this.x, this.y, Math.random() < 0.5 ? "health" : "gold"));
      }
    }
  }

  draw() {
    ctx.fillStyle = this.isOpened ? "#888" : "#aa6600";
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}

// == Portal class (simplified) ==
class Portal {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 40;
  }

  update() {
    if (distance(this.x, this.y, player.x, player.y) < player.size + this.radius) {
      wave++;
      spawnWave(wave);
      portal = null;
    }
  }

  draw() {
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// == Spawn wave ==
function spawnWave(waveNumber) {
  enemiesToSpawn = 5 + waveNumber * 3;
  enemiesKilledThisWave = 0;
  bossKilledThisWave = false;

  for (let i = 0; i < enemiesToSpawn; i++) {
    let x = Math.random() * width;
    let y = Math.random() * height;
    // Spawn enemies at edges only
    if (x > 100 && x < width - 100 && y > 100 && y < height - 100) {
      // push to edge
      if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 50 : width - 50;
      } else {
        y = Math.random() < 0.5 ? 50 : height - 50;
      }
    }
    enemies.push(new Enemy(x, y, 20, 2 + waveNumber * 0.1, 30 + waveNumber * 5, 10));
  }
}


// == Shooting bullets ==
function shootBullet() {
  if (player.attackCooldown <= 0) {
    bullets.push(new Bullet(
      player.x + Math.cos(player.angle) * player.size,
      player.y + Math.sin(player.angle) * player.size,
      player.angle,
      10,
      player.attackDamage,
      true
    ));
    player.attackCooldown = player.attackSpeed;
  }
}

// == Update bullets ==
function updateBullets(delta) {
  bullets.forEach((bullet) => bullet.update(delta));
  // Remove dead bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].isDead) bullets.splice(i, 1);
  }
}

// == Update enemies ==
function updateEnemies(delta) {
  enemies.forEach((enemy) => enemy.update(delta));
  // Remove dead enemies and count kills
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].isDead) {
      stats.kills++;
      stats.coinsEarned += 5;
      player.gold += 5;
      enemies.splice(i, 1);
      enemiesKilledThisWave++;
    }
  }
  // Spawn portal if wave cleared
  if (enemiesKilledThisWave >= enemiesToSpawn && !portal) {
    portal = new Portal(width / 2, height / 2);
  }
}

// == Update pickups ==
function updatePickups() {
  pickups.forEach((pickup) => pickup.update());
  // Remove collected pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    if (pickups[i].isCollected) pickups.splice(i, 1);
  }
}

// == Update chests ==
function updateChests() {
  chests.forEach((chest) => chest.update());
}

// == Draw all entities ==
function drawPlayer() {
  ctx.fillStyle = "#00ffcc";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  ctx.fill();

  // Draw health bar
  ctx.fillStyle = "#0f0";
  ctx.fillRect(player.x - player.size, player.y - player.size - 15, (player.health / player.maxHealth) * player.size * 2, 7);
}

function drawEnemies() {
  enemies.forEach((enemy) => enemy.draw());
}

function drawBullets() {
  bullets.forEach((bullet) => bullet.draw());
}

function drawPickups() {
  pickups.forEach((pickup) => pickup.draw());
}

function drawChests() {
  chests.forEach((chest) => chest.draw());
}

function drawPortal() {
  if (portal) portal.draw();
}

function drawUI() {
  ctx.fillStyle = "#fff";
  ctx.font = "16px sans-serif";
  ctx.fillText(`Health: ${Math.floor(player.health)}`, 20, 30);
  ctx.fillText(`Gold: ${player.gold}`, 20, 50);
  ctx.fillText(`Wave: ${wave}`, 20, 70);
  ctx.fillText(`Kills: ${stats.kills}`, 20, 90);

  if (player.dashCooldown > 0) {
    ctx.fillText(`Dash Cooldown: ${(player.dashCooldown / 1000).toFixed(1)}s`, 20, 110);
  } else {
    ctx.fillText("Dash Ready (Shift)", 20, 110);
  }

  if (timeStopUnlocked) {
    ctx.fillText(`Time Stop (Q): ${timeStopActive ? "Active" : "Ready"}`, 20, 130);
  }
}

// == Clear screen ==
function clearScreen() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, width, height);
}

// == Main game loop ==
let lastTime = 0;

function gameLoop(timestamp = 0) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  clearScreen();

  if (!gameOver) {
    if (!timeStopActive) {
      updatePlayer(delta);
      updateEnemies(delta);
      updateBullets(delta);
      updatePickups();
      updateChests();

      if (player.attackCooldown > 0) {
        player.attackCooldown -= delta;
      }
    } else {
      // Time stop active
      timeStopTimer -= delta;
      if (timeStopTimer <= 0) {
        timeStopActive = false;
      }
    }

    if (portal) {
      portal.update();
      drawPortal();
    }

    drawPlayer();
    drawEnemies();
    drawBullets();
    drawPickups();
    drawChests();
    drawUI();
  } else if (showEndScreen) {
    ctx.fillStyle = "#f00";
    ctx.font = "48px sans-serif";
    ctx.fillText("Game Over", width / 2 - 100, height / 2);
  }

  requestAnimationFrame(gameLoop);
}

canvas.addEventListener("mousedown", (e) => {
  if (!gameOver) {
    shootBullet();
  }
});

// Start game
spawnWave(wave);
requestAnimationFrame(gameLoop);
