// === Fullscreen Canvas Setup ===
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("load", resizeCanvas);
window.addEventListener("resize", resizeCanvas);

// === Input Handling ===
const keys = {};
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// === Mouse Handling ===
let mouseX = 0;
let mouseY = 0;

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

// === Player ===
const player = {
  x: 300, y: 300, size: 20,
  speed: 2.5, dashSpeed: 6,
  dashCooldown: 0, dashCooldownMax: 2000,
  dashTime: 0, dashDuration: 150,
  isDashing: false,
  angle: 0,
  health: 5, maxHealth: 5,
  healthRegen: 0,
  damage: 1, shootCooldown: 300, lastShot: 0,
  bulletLife: 40, gold: 0,
  poison: false, exploding: false
};

// === Game State ===
let bullets = [], enemies = [], pickups = [], chests = [];
let portal = null;
let wave = 1, enemiesToSpawn = 5, spawnTimer = 0;
let chestCost = 25, bossWave = false;
let tooltip = null;
let gameOver = false, showEndScreen = false;
let stats = { kills: 0, damage: 0, coinsEarned: 0 };
const biomes = ["desert", "forest", "snow"];
let currentBiome = biomes[Math.floor(Math.random() * biomes.length)];
let portalRotation = 0;

// === Utility Functions ===

function spawnEnemy(type = "normal") {
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (side === 0) x = 0, y = Math.random() * canvas.height;
  else if (side === 1) x = canvas.width, y = Math.random() * canvas.height;
  else if (side === 2) x = Math.random() * canvas.width, y = 0;
  else y = canvas.height, x = Math.random() * canvas.width;

  const enemy = {
    x, y, size: 20, speed: 1.5, health: 3, maxHealth: 3,
    type, damage: 1, attackCooldown: 1000, lastAttack: 0
  };

  if (type === "fast") enemy.speed = 3, enemy.health = 2;
  if (type === "tank") enemy.speed = 0.7, enemy.health = 10, enemy.damage = 0.5;
  if (type === "ranged") enemy.health = 4, enemy.shoots = true;
  if (type === "boss") enemy.health = 30, enemy.speed = 1, enemy.size = 40;

  enemies.push(enemy);
}

function spawnPickup(x, y, type) {
  pickups.push({ x, y, size: 10, type, delay: 500, timer: 0 });
}

function spawnChest(x, y) {
  chests.push({ x, y, size: 25, opened: false });
}

function spawnPortal(x, y) {
  portal = { x, y, w: 40, h: 40 };
}

// === Shooting ===
function shootBullet() {
  const now = performance.now();
  if (now - player.lastShot < player.shootCooldown) return;
  player.lastShot = now;

  const bullet = {
    x: player.x, y: player.y,
    dx: Math.cos(player.angle) * 5,
    dy: Math.sin(player.angle) * 5,
    life: player.bulletLife
  };
  bullets.push(bullet);
}

function update(delta) {
  if (gameOver) return;

  // Calculate angle towards mouse cursor
  player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
  
  // Dash Logic
  if (player.dashCooldown > 0) player.dashCooldown -= delta;
  if (keys["shift"] && player.dashCooldown <= 0) {
    player.isDashing = true;
    player.dashTime = player.dashDuration;
    player.dashCooldown = player.dashCooldownMax;
  }

  // Movement
  let dx = 0, dy = 0;
  if (keys["w"]) dy -= 1;
  if (keys["s"]) dy += 1;
  if (keys["a"]) dx -= 1;
  if (keys["d"]) dx += 1;

  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len; dy /= len;
    const speed = player.isDashing ? player.dashSpeed : player.speed;
    player.x += dx * speed;
    player.y += dy * speed;
    player.angle = Math.atan2(dy, dx);
  }

  if (player.isDashing) {
    player.dashTime -= delta;
    if (player.dashTime <= 0) player.isDashing = false;
  }

  // Health Regen
  player.health = Math.min(player.maxHealth, player.health + player.healthRegen * delta);

  // Shooting
  if (keys[" "]) shootBullet();

  // Bullets
  bullets.forEach((b, i) => {
    b.x += b.dx;
    b.y += b.dy;
    b.life--;
    if (b.life <= 0) bullets.splice(i, 1);
  });

  // Enemy Movement + Attacking
  enemies.forEach((e, ei) => {
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    if (!e.shoots || e.type === "boss") {
      e.x += Math.cos(angle) * e.speed;
      e.y += Math.sin(angle) * e.speed;
    }

    // Collision with player
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist < player.size + e.size) {
      const now = performance.now();
      if (now - e.lastAttack > e.attackCooldown) {
        player.health -= e.damage;
        e.lastAttack = now;
        if (player.health <= 0) gameOver = true, showEndScreen = true;
      }
    }
  });

  // Bullet Hits
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      const dist = Math.hypot(b.x - e.x, b.y - e.y);
      if (dist < e.size) {
        e.health -= player.damage;
        stats.damage += player.damage;
        if (player.poison) e.poisoned = true, e.poisonTime = 3000;
        if (player.exploding) { /* spawn small AoE */ }
        bullets.splice(bi, 1);
        if (e.health <= 0) {
          player.gold += Math.floor(Math.random() * 6) + 5;
          stats.kills++; stats.coinsEarned += player.gold;
          enemies.splice(ei, 1);
        }
      }
    });
  });

  // Poison Damage
  enemies.forEach(e => {
    if (e.poisoned) {
      e.poisonTime -= delta;
      if (e.poisonTime > 0) e.health -= 0.01;
      else e.poisoned = false;
    }
  });

  // Pickup Delay
  pickups.forEach((p, i) => {
    p.timer += delta;
    const dist = Math.hypot(player.x - p.x, player.y - p.y);
    if (dist < player.size + p.size && p.timer > p.delay) {
      switch (p.type) {
        case "damage": player.damage += 0.2; break;
        case "speed": player.shootCooldown *= 0.9; break;
        case "maxHealth": player.maxHealth += 1; break;
        case "regen": player.healthRegen += 0.01; break;
        case "lifespan": player.bulletLife += 5; break;
        case "poison": player.poison = true; break;
        case "explode": player.exploding = true; break;
      }
      pickups.splice(i, 1);
    }
  });

  // Chest Opening
  chests.forEach((c, i) => {
    const dist = Math.hypot(player.x - c.x, player.y - c.y);
    if (!c.opened && dist < player.size + c.size && keys["e"] && player.gold >= chestCost) {
      player.gold -= chestCost;
      c.opened = true;
      chestCost += 10;

      const roll = Math.floor(Math.random() * 27);
      if (roll < 5) spawnPickup(c.x, c.y, "damage");
      else if (roll < 10) spawnPickup(c.x, c.y, "speed");
      else if (roll < 15) spawnPickup(c.x, c.y, "maxHealth");
      else if (roll < 20) spawnPickup(c.x, c.y, "regen");
      else if (roll < 25) spawnPickup(c.x, c.y, "lifespan");
      else if (roll === 26) spawnPickup(c.x, c.y, "poison");
      else if (roll === 27) spawnPickup(c.x, c.y, "explode");
    }
  });

  // Waves
  if (enemies.length === 0) {
    wave++;
    enemiesToSpawn += 2;
    chestCost += 5;
    if (wave % 10 === 0) {
      spawnEnemy("boss");
      spawnPortal(Math.random() * canvas.width, Math.random() * canvas.height);
    } else {
      for (let i = 0; i < enemiesToSpawn; i++) {
        const type = ["normal", "fast", "tank", "ranged"][Math.floor(Math.random() * 4)];
        spawnEnemy(type);
      }
      // Limit chests
      if (Math.random() < 0.4) {
        for (let c = 0; c < 3; c++) {
          spawnChest(Math.random() * canvas.width, Math.random() * canvas.height);
        }
      }
    }
  }

  // Portal Handling
  if (portal) {
    const dist = Math.hypot(player.x - portal.x, player.y - portal.y);
    if (dist < 40) {
      player.gold = 0;
      currentBiome = biomes[Math.floor(Math.random() * biomes.length)];
      portal = null;
      wave = 1;
      enemiesToSpawn = 5;
      chestCost = 25;
      bullets = []; enemies = []; pickups = []; chests = [];
    }
  }
}

// === Drawing Functions ===

function drawBiome() {
  ctx.fillStyle = currentBiome === "desert" ? "#f2d7b5"
                  : currentBiome === "forest" ? "#2c4b2a"
                  : "#ddeeff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = currentBiome === "desert" ? "#e0b775"
                  : currentBiome === "forest" ? "#336633"
                  : "#cce0ff";

  const size = 80;
  if (currentBiome === "desert") {
    for (let x = 0; x < canvas.width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.quadraticCurveTo(x + size / 2, canvas.height - size, x + size, canvas.height);
      ctx.fill();
    }
  } else if (currentBiome === "forest") {
    for (let i = 0; i < 20; i++) {
      const x = i * (canvas.width / 20);
      ctx.fillRect(x, canvas.height - 200, 20, 200);
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const x = i * (canvas.width / 10);
      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x + size / 2, canvas.height - size);
      ctx.lineTo(x + size, canvas.height);
      ctx.fill();
    }
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = "#00f";
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(e => {
    ctx.fillStyle = e.poisoned ? "purple" : (e.type === "boss" ? "red" : "green");
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBullets() {
  ctx.fillStyle = "yellow";
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPickups() {
  pickups.forEach(p => {
    ctx.fillStyle = {
      damage: "orange", speed: "cyan", maxHealth: "pink",
      regen: "lightgreen", lifespan: "blue",
      poison: "purple", explode: "red"
    }[p.type];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawChests() {
  chests.forEach(c => {
    ctx.fillStyle = c.opened ? "gray" : "blue";
    ctx.fillRect(c.x - c.size / 2, c.y - c.size / 2, c.size, c.size);
    if (!c.opened) {
      ctx.fillStyle = "#fff";
      ctx.font = "10px sans-serif";
      ctx.fillText("E to open", c.x - 20, c.y - 20);
    }
  });
}

function drawPortal(x, y, w, h) {
  portalRotation += 0.03;
  const cx = x + w / 2, cy = y + h / 2;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(portalRotation + i * 2);
    ctx.strokeStyle = `rgba(180,200,255,${0.6 - i * 0.2})`;
    ctx.lineWidth = 5 - i * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2 - i * 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHUD() {
  const pad = 20;
  // Health Bar
  ctx.fillStyle = "#550";
  ctx.fillRect(pad, pad, 200, 16);
  ctx.fillStyle = "#f44";
  ctx.fillRect(pad, pad, 200 * (player.health / player.maxHealth), 16);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(pad, pad, 200, 16);

  // Dash Cooldown
  ctx.fillStyle = "#333";
  ctx.fillRect(pad, pad + 24, 200, 8);
  ctx.fillStyle = "#0af";
  ctx.fillRect(pad, pad + 24, 200 * (1 - player.dashCooldown / player.dashCooldownMax), 8);
  ctx.strokeRect(pad, pad + 24, 200, 8);

  // Stats
  ctx.fillStyle = "#fff";
  ctx.font = "16px sans-serif";
  ctx.fillText(`Wave: ${wave}`, pad, pad + 60);
  ctx.fillText(`Gold: ${player.gold}`, pad, pad + 80);
  ctx.fillText(`Chest: ${chestCost}g`, pad, pad + 100);
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.font = "36px sans-serif";
  ctx.fillText("Game Over", canvas.width / 2 - 100, canvas.height / 2 - 100);

  ctx.font = "20px sans-serif";
  ctx.fillText(`Kills: ${stats.kills}`, canvas.width / 2 - 60, canvas.height / 2 - 40);
  ctx.fillText(`Damage Dealt: ${Math.floor(stats.damage)}`, canvas.width / 2 - 60, canvas.height / 2 - 10);
  ctx.fillText(`Gold Earned: ${stats.coinsEarned}`, canvas.width / 2 - 60, canvas.height / 2 + 20);

  // Restart Button
  const btnW = 140, btnH = 40;
  const btnX = canvas.width / 2 - btnW / 2;
  const btnY = canvas.height / 2 + 60;

  ctx.fillStyle = "#08f";
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.fillStyle = "#fff";
  ctx.fillText("Restart", btnX + 35, btnY + 26);

  canvas.addEventListener("click", function onClick(e) {
    if (e.offsetX > btnX && e.offsetX < btnX + btnW &&
        e.offsetY > btnY && e.offsetY < btnY + btnH) {
      canvas.removeEventListener("click", onClick);
      location.reload(); // reload to reset the game
    }
  });
}

// === Game Loop ===
let lastTime = 0;
function gameLoop(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  drawBiome();
  if (!gameOver) {
    update(delta);
    drawPlayer();
    drawEnemies();
    drawBullets();
    drawPickups();
    drawChests();
    if (portal) drawPortal(portal.x, portal.y, portal.w, portal.h);
    drawHUD();
  } else if (showEndScreen) {
    drawGameOverScreen();
  }

  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
