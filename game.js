const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 2.5,
  dashSpeed: 7,
  color: "#4af",
  health: 5,
  maxHealth: 5,
  healthRegen: 0,
  regenPerSecond: 0.5,
  angle: 0,
  isDashing: false,
  dashTime: 0,
  dashCooldown: 0,
  dashDuration: 150,
  dashCooldownMax: 2000,
  damage: 1,
  shootCooldown: 250,
  bulletLife: 60,
  gold: 0,
  exploding: false,
  poison: false
};

const bullets = [];
const enemies = [];
const pickups = [];
const chests = [];
let wave = 1, spawnTimer = 0, enemiesToSpawn = 5, bossWave = false, chestCost = 25;
let tooltip = null, lastShot = 0;

canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  player.angle = Math.atan2(e.clientY - rect.top - player.y, e.clientX - rect.left - player.x);
});

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const x = [0, canvas.width, Math.random() * canvas.width, Math.random() * canvas.width][side];
  const y = [Math.random() * canvas.height, Math.random() * canvas.height, 0, canvas.height][side];

  const baseHp = bossWave ? 20 : 3 + wave;
  const types = ["normal", "fast", "tanky", "ranged"];
  const type = bossWave ? "boss" : types[Math.floor(Math.random() * 4)];

  let enemy;
  switch(type) {
    case "fast":
      enemy = { x, y, size: 15, speed: 2 + wave * 0.1, color: "#ff0", hp: 1 + wave, type };
      break;
    case "tanky":
      enemy = { x, y, size: 25, speed: 0.7, color: "#800", hp: baseHp * 3, type };
      break;
    case "ranged":
      enemy = { x, y, size: 18, speed: 1 + wave * 0.05, color: "#0f0", hp: 3 + wave, type, shootTimer: 0 };
      break;
    default:
      enemy = { x, y, size: 20, speed: 1.2 + wave * 0.05, color: "#f44", hp: baseHp, type };
  }
  enemies.push(enemy);
}

function spawnChest() {
  if (chests.length < 3 && Math.random() < 0.3 / wave) {
    chests.push({ x: Math.random() * (canvas.width - 30), y: Math.random() * (canvas.height - 20), w: 30, h: 20 });
  }
}

function spawnPickup(x, y) {
  const types = [
    { name: "Max Health +", effect: "+1 max health & heal 1", apply: () => { player.maxHealth++; player.health = Math.min(player.health + 1, player.maxHealth); }, color: "#ff4444" },
    { name: "Bullet Lifespan +", effect: "+10 bullet lifespan", apply: () => { player.bulletLife += 10; }, color: "#44f" },
    { name: "Health Regen", effect: "Enable regeneration", apply: () => { player.healthRegen = player.regenPerSecond; }, color: "#0f0" },
    { name: "Exploding Bullets", effect: "Bullets explode on hit", apply: () => { player.exploding = true; }, color: "#f0f" },
    { name: "Poison Bullets", effect: "Bullets poison enemies", apply: () => { player.poison = true; }, color: "#0ff" },
    { name: "Damage Buff", effect: "+0.5 damage", apply: () => { player.damage += 0.5; }, color: "#f80" },
    { name: "Attack Speed Buff", effect: "-15ms cooldown", apply: () => { player.shootCooldown = Math.max(50, player.shootCooldown - 15); }, color: "#80f" }
  ];
  const type = types[Math.floor(Math.random() * types.length)];
  pickups.push({ x, y, size: 15, ...type });
}

function update(dt) {
  let dx = (keys["d"] ? 1 : 0) + (keys["a"] ? -1 : 0);
  let dy = (keys["s"] ? 1 : 0) + (keys["w"] ? -1 : 0);
  const mag = Math.hypot(dx, dy) || 1;

  if (keys["shift"] && !player.isDashing && player.dashCooldown <= 0 && (dx || dy)) {
    player.isDashing = true;
    player.dashTime = player.dashDuration;
    player.dashCooldown = player.dashCooldownMax;
  }

  if (player.isDashing) {
    player.x += dx / mag * player.dashSpeed;
    player.y += dy / mag * player.dashSpeed;
    player.dashTime -= dt;
    if (player.dashTime <= 0) player.isDashing = false;
  } else {
    player.x += dx / mag * player.speed;
    player.y += dy / mag * player.speed;
  }

  if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);

  if (player.healthRegen > 0) {
    player.health = Math.min(player.maxHealth, player.health + player.healthRegen * dt / 1000);
  }

  if (keys[" "] && Date.now() - lastShot > player.shootCooldown) {
    bullets.push({
      x: player.x, y: player.y,
      dx: Math.cos(player.angle), dy: Math.sin(player.angle),
      speed: 5, size: 5,
      life: player.bulletLife,
      explode: player.exploding,
      poison: player.poison
    });
    lastShot = Date.now();
  }

  bullets.forEach((b, i) => {
    b.x += b.dx * b.speed;
    b.y += b.dy * b.speed;
    b.life--;
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > canvas.width || b.y > canvas.height) {
      bullets.splice(i, 1);
    }
  });

  spawnTimer += dt;
  if (spawnTimer > 1000 && enemiesToSpawn > 0) {
    spawnEnemy();
    enemiesToSpawn--;
    spawnTimer = 0;
  }
  if (enemiesToSpawn === 0 && enemies.length === 0) {
    wave++;
    enemiesToSpawn = 5 + wave * 2;
    chestCost += 5;
    bossWave = wave % 10 === 0;
    spawnChest();
  }

  enemies.forEach((e, ei) => {
    const ex = player.x - e.x, ey = player.y - e.y;
    const dist = Math.hypot(ex, ey);
    e.x += ex / dist * e.speed;
    e.y += ey / dist * e.speed;

    if (e.type === "ranged") {
      e.shootTimer = (e.shootTimer || 0) + dt;
      if (e.shootTimer > 1200) {
        bullets.push({ x: e.x, y: e.y, dx: ex/dist, dy: ey/dist, speed: 3, size: 5, life: 200, explode: false, poison: false });
        e.shootTimer = 0;
      }
    }

    bullets.forEach((b, bi) => {
      if (Math.abs(b.x - e.x) < e.size && Math.abs(b.y - e.y) < e.size) {
        e.hp -= player.damage;
        if (b.explode) {
          enemies.forEach(ee => {
            if (Math.hypot(b.x - ee.x, b.y - ee.y) < 50) {
              ee.hp -= player.damage;
              ee.color = "#a0f";
              setTimeout(() => ee.color = ee.type === 'tanky' ? "#800" : "#f44", 200);
            }
          });
        }
        if (b.poison && e.hp > 0) {
          e.poisoned = true;
          e.poisonTimer = 2000;
        }
        bullets.splice(bi, 1);
        if (e.hp <= 0) {
          player.gold += 15 + Math.floor(Math.random() * 6);
          enemies.splice(ei, 1);
          if (Math.random() < 0.5) spawnChest();
        }
      }
    });

    if (e.poisoned) {
      e.poisonTimer -= dt;
      e.hp -= dt * 0.01;
      e.color = "#a0f";
      if (e.poisonTimer <= 0) {
        e.poisoned = false;
        e.color = e.type === 'tanky' ? "#800" : "#f44";
      }
    }

    if (!player.isDashing && Math.abs(player.x - e.x) < player.size && Math.abs(player.y - e.y) < player.size) {
      player.health -= dt * 0.01;
      if (player.health <= 0) { alert("Game Over!"); window.location.reload(); }
    }
  });

  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), minD = a.size;
      if (dist < minD && dist) {
        const overlap = (minD - dist) / 2;
        a.x -= dx / dist * overlap; a.y -= dy / dist * overlap;
        b.x += dx / dist * overlap; b.y += dy / dist * overlap;
      }
    }
  }

  chests.forEach((c, ci) => {
    if (player.x > c.x && player.x < c.x + c.w && player.y > c.y && player.y < c.y + c.h && keys["e"] && player.gold >= chestCost) {
      player.gold -= chestCost;
      spawnPickup(c.x + c.w/2, c.y + c.h/2);
      chests.splice(ci, 1);
    }
  });

  pickups.forEach((p, pi) => {
    if (Math.hypot(player.x - p.x, player.y - p.y) < player.size + p.size) {
      tooltip = `${p.name}: ${p.effect}`;
      if (keys["e"]) {
        p.apply();
        pickups.splice(pi, 1);
      }
    }
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.fillRect(-player.size/2, -player.size/2, player.size, player.size);
  ctx.restore();

  bullets.forEach(b => {
    ctx.fillStyle = b.explode ? "cyan" : b.poison ? "purple" : "#ff0";
    ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, 2 * Math.PI); ctx.fill();
  });

  enemies.forEach(e => {
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, 2 * Math.PI); ctx.fill();
  });

  chests.forEach(c => {
    ctx.fillStyle = "blue";
    ctx.fillRect(c.x, c.y, c.w, c.h);
  });

  pickups.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI); ctx.fill();
  });

  if (tooltip) {
    ctx.fillStyle = "#fff"; ctx.font = "16px Arial";
    ctx.fillText(tooltip + " (E)", 10, canvas.height - 20);
  }

  ctx.fillStyle = "red"; ctx.fillRect(10, 10, 100, 10);
  ctx.fillStyle = "lime"; ctx.fillRect(10, 10, (player.health / player.maxHealth) * 100, 10);
  ctx.strokeStyle = "#000"; ctx.strokeRect(10, 10, 100, 10);

  ctx.fillStyle = "#555"; ctx.fillRect(10, 25, 100, 5);
  ctx.fillStyle = "#0af"; ctx.fillRect(10, 25, (1 - player.dashCooldown / player.dashCooldownMax) * 100, 5);
  ctx.strokeStyle = "#000"; ctx.strokeRect(10, 25, 100, 5);

  ctx.fillStyle = "#fff"; ctx.font = "14px Arial";
  ctx.fillText(`Wave: ${wave}`, 10, 45);
  ctx.fillText(`Gold: ${player.gold}`, 10, 60);
  ctx.fillText(`Chest Cost: ${chestCost}`, 10, 75);

  if (bossWave) {
    ctx.fillStyle = "yellow";
    ctx.fillText("Boss Wave!", canvas.width - 100, 30);
  }
}

let lastTime = performance.now();
function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  tooltip = null;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
