const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
document.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup",   (e) => keys[e.key.toLowerCase()] = false);

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 2.5,
  dashSpeed: 7,
  color: "#4af",
  health: 5,
  maxHealth: 5,
  angle: 0,
  isDashing: false,
  dashTime: 0,
  dashCooldown: 0,
  dashDuration: 150,     // ms
  dashCooldownMax: 2000, // ms
  damage: 1,
  shootCooldown: 250
};

const bullets      = [];
const enemies      = [];
const enemyShots   = []; // for ranged enemies
const pickups      = [];
let tooltip = null;

let lastShot = 0;
let enemySpawnTimer = 0;

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  player.angle = Math.atan2(my - player.y, mx - player.x);
});

// Spawn pickups with five types
function spawnPickup(x, y) {
  const types = [
    { name: "Health Pack", effect: "Restore 1 health", apply: () => { if (player.health < player.maxHealth) player.health++; }, color: "#0f0" },
    { name: "Speed Boost", effect: "Increase movement speed", apply: () => { player.speed += 0.5; }, color: "#0ff" },
    { name: "Attack Damage Buff", effect: "Bullets deal +1 damage", apply: () => { player.damage += 1; }, color: "#f0f" },
    { name: "Attack Speed Buff", effect: "Faster shooting", apply: () => { player.shootCooldown = Math.max(50, player.shootCooldown - 30); }, color: "#ffa500" },
    { name: "Max Health Buff", effect: "+1 Max Health (and heal 1)", apply: () => { player.maxHealth += 1; player.health = Math.min(player.health + 1, player.maxHealth); }, color: "#ff4444" }
  ];
  const type = types[Math.floor(Math.random() * types.length)];
  pickups.push({ x, y, size: 15, ...type });
}

// Spawn enemies of 4 types
function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = [0, canvas.width, Math.random() * canvas.width, Math.random() * canvas.width][side];
  let y = [Math.random() * canvas.height, Math.random() * canvas.height, 0, canvas.height][side];

  const kind = Math.floor(Math.random() * 4);
  let enemy;

  switch(kind) {
    case 0: // Normal
      enemy = { x, y, size: 20, speed: 1.2, color: "#f44", hp: 3, type: "normal" }; break;
    case 1: // Fast
      enemy = { x, y, size: 15, speed: 2.5, color: "#ff0", hp: 1, type: "fast" }; break;
    case 2: // Tanky
      enemy = { x, y, size: 25, speed: 0.7, color: "#800", hp: 8, type: "tanky" }; break;
    case 3: // Ranged
      enemy = { x, y, size: 18, speed: 1, color: "#0f0", hp: 3, type: "ranged", shootTimer: 0 }; break;
  }

  enemies.push(enemy);
}

function shootBullet(fromX, fromY, dx, dy, speed = 5, size = 5, isEnemy = false) {
  (isEnemy ? enemyShots : bullets).push({ x: fromX, y: fromY, dx, dy, speed, size });
}

function update(dt) {
  const mx = (keys["a"] ? -1 : 0) + (keys["d"] ? 1 : 0);
  const my = (keys["w"] ? -1 : 0) + (keys["s"] ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;

  // Dash
  if (keys["shift"] && player.dashCooldown <= 0 && !player.isDashing && (mx || my)) {
    player.isDashing = true; player.dashTime = player.dashDuration;
    player.dashCooldown = player.dashCooldownMax;
  }
  if (player.isDashing) {
    player.x += (mx / len) * player.dashSpeed;
    player.y += (my / len) * player.dashSpeed;
    player.dashTime -= dt;
    if (player.dashTime <= 0) player.isDashing = false;
  } else {
    player.x += (mx / len) * player.speed;
    player.y += (my / len) * player.speed;
  }
  if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);

  // Shooting
  if (keys[" "] && Date.now() - lastShot > player.shootCooldown) {
    shootBullet(player.x, player.y, Math.cos(player.angle), Math.sin(player.angle));
    lastShot = Date.now();
  }

  bullets.forEach((b, i) => {
    b.x += b.dx * b.speed; b.y += b.dy * b.speed;
    if (b.x < 0 || b.y < 0 || b.x > canvas.width || b.y > canvas.height) bullets.splice(i, 1);
  });

  // Enemy spawning
  enemySpawnTimer += dt;
  if (enemySpawnTimer > 2000) { spawnEnemy(); enemySpawnTimer = 0; }

  // Enemy behavior
  enemies.forEach((e, ei) => {
    const dx = player.x - e.x, dy = player.y - e.y, dist = Math.hypot(dx, dy);
    e.x += (dx / dist) * e.speed; e.y += (dy / dist) * e.speed;

    if (e.type === "ranged") {
      e.shootTimer = (e.shootTimer || 0) + dt;
      if (e.shootTimer > 1200) {
        shootBullet(e.x, e.y, dx / dist, dy / dist, 3, 5, true);
        e.shootTimer = 0;
      }
    }

    bullets.forEach((b, bi) => {
      if (Math.abs(b.x - e.x) < e.size && Math.abs(b.y - e.y) < e.size) {
        e.hp -= player.damage; bullets.splice(bi, 1);
        if (e.hp <= 0) { enemies.splice(ei, 1); if (Math.random() < 0.5) spawnPickup(e.x, e.y); }
      }
    });

    if (!player.isDashing && Math.abs(player.x - e.x) < player.size && Math.abs(player.y - e.y) < player.size) {
      player.health -= 0.01 * dt; if (player.health <= 0) { alert("Game Over!"); window.location.reload(); }
    }
  });

  // Enemy-enemy collision
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
      const minD = a.size;
      if (dist < minD && dist) {
        const overlap = (minD - dist) / 2;
        a.x -= (dx / dist) * overlap; a.y -= (dy / dist) * overlap;
        b.x += (dx / dist) * overlap; b.y += (dy / dist) * overlap;
      }
    }
  }

  // Enemy shots
  enemyShots.forEach((es, i) => {
    es.x += es.dx * es.speed; es.y += es.dy * es.speed;
    if (Math.abs(es.x - player.x) < player.size && Math.abs(es.y - player.y) < player.size) {
      if (!player.isDashing) player.health -= 1;
      enemyShots.splice(i, 1);
    }
  });

  // Pickups
  tooltip = null;
  pickups.forEach((p, pi) => {
    const dx = player.x - p.x, dy = player.y - p.y;
    if (Math.hypot(dx, dy) < player.size + p.size) {
      tooltip = `${p.name}: ${p.effect}`;
      if (keys["e"]) { p.apply(); pickups.splice(pi, 1); }
    }
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Player
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  ctx.restore();

  // Bullets
  ctx.fillStyle = "#ff0";
  bullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, 2 * Math.PI); ctx.fill(); });

  // Enemy shots
  ctx.fillStyle = "#f0f";
  enemyShots.forEach(es => { ctx.beginPath(); ctx.arc(es.x, es.y, es.size, 0, 2 * Math.PI); ctx.fill(); });

  // Enemies
  enemies.forEach(e => {
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, 2 * Math.PI); ctx.fill();
  });

  // Pickups
  pickups.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI); ctx.fill();
  });

  // Tooltip
  if (tooltip) {
    ctx.fillStyle = "#fff"; ctx.font = "16px Arial";
    ctx.fillText(tooltip + " (Press E)", 10, canvas.height - 20);
  }

  // Health bar
  ctx.fillStyle = "red";  ctx.fillRect(10, 10, 100, 10);
  ctx.fillStyle = "lime"; ctx.fillRect(10, 10, (player.health / player.maxHealth) * 100, 10);
  ctx.strokeStyle = "#000"; ctx.strokeRect(10, 10, 100, 10);

  // Dash cooldown bar
  ctx.fillStyle = "#555"; ctx.fillRect(10, 25, 100, 5);
  ctx.fillStyle = "#0af";
  const prog = 1 - (player.dashCooldown / player.dashCooldownMax);
  ctx.fillRect(10, 25, prog * 100, 5);
  ctx.strokeStyle = "#000"; ctx.strokeRect(10, 25, 100, 5);
}

let lastTime = performance.now();
function gameLoop(ts) {
  const dt = ts - lastTime; lastTime = ts;
  update(dt); draw();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
