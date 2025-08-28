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
  size: 20, // smaller because arrow shape
  speed: 3.5, // equal to fast enemy speed
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
  healthRegen: 0, // no regen at start
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
let chestSpawnedThisWave = false;

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
let timeStopDurationBase = 10000; // 10 seconds base
let timeStopDurationExtension = 0;
let timeStopTimer = 0;
let timeStopCooldown = 0;
let timeStopCooldownMax = 60000; // 60 sec cooldown

// Wave delay variables
let waitingForNextWave = false;
let waveWaitTimer = 0;

// == Input handling ==
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === "q" && timeStopUnlocked && !timeStopActive && timeStopCooldown <= 0) {
    timeStopActive = true;
    timeStopTimer = timeStopDurationBase + timeStopDurationExtension;
    timeStopCooldown = timeStopCooldownMax - (focusUpgrades * 1000);
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

function isInsideWall(x, y) {
  if (x < 50 || x > width - 50 || y < 50 || y > height - 50) return true;
  return false;
}

// == Player movement and dash ==
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
    }
  }

  player.x = Math.min(width - 20, Math.max(20, player.x));
  player.y = Math.min(height - 20, Math.max(20, player.y));

  if (player.dashCooldown > 0) {
    player.dashCooldown -= delta;
  }

  player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);

  // Health regen
  if (
    player.health < player.maxHealth &&
    player.healthRegen > 0 &&
    !timeStopActive
  ) {
    player.health += player.healthRegen * (delta / 1000);
    if (player.health > player.maxHealth) player.health = player.maxHealth;
  }
}

// == Bullet logic ==
function updateBullets(delta) {
  bullets.forEach((b, i) => {
    b.x += b.vx;
    b.y += b.vy;
    b.lifespan -= delta;

    if (b.lifespan <= 0) {
      bullets.splice(i, 1);
      return;
    }

    enemies.forEach((e, ei) => {
      if (distance(b.x, b.y, e.x, e.y) < e.size + b.size) {
        e.health -= player.attackDamage;
        stats.damage += player.attackDamage;

        if (b.exploding) {
          e.poisoned = false;
          enemies.forEach((e2) => {
            if (e2 !== e && distance(b.x, b.y, e2.x, e2.y) < 50) {
              e2.health -= player.attackDamage / 2;
            }
          });
        } else if (b.poison) {
          e.poisoned = true;
          e.poisonTimer = 3000;
        }

        bullets.splice(i, 1);
        if (e.health <= 0) {
          enemiesKilledThisWave++;
          stats.kills++;
          const goldDrop = Math.floor(Math.random() * 16);
          stats.coinsEarned += goldDrop;
          player.gold += goldDrop;

          if (e.type === "boss") {
            bossKilledThisWave = true;
          }
          enemies.splice(ei, 1);
        }
      }
    });

    if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
      bullets.splice(i, 1);
    }
  });
}

// == Enemy update ==
function updateEnemies(delta) {
  enemies.forEach((e) => {
    if (timeStopActive) return;

    if (e.poisoned) {
      e.poisonTimer -= delta;
      if (e.poisonTimer <= 0) e.poisoned = false;
    }

    if (e.type === "ranged") {
      if (!e.state) e.state = "move";
      if (!e.stateTime) e.stateTime = 1000;
      e.stateTime -= delta;
      if (e.state === "move") {
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;

        if (isInsideWall(e.x, e.y)) {
          e.x -= Math.cos(angle) * e.speed * 2;
          e.y -= Math.sin(angle) * e.speed * 2;
        }

        if (e.stateTime <= 0) {
          e.state = "shoot";
          e.stateTime = 500;
          e.shootCooldown = 0;
        }
      } else if (e.state === "shoot") {
        if (e.shootCooldown <= 0) {
          shootEnemyBullet(e);
          e.shootCooldown = e.attackCooldown;
        } else {
          e.shootCooldown -= delta;
        }
        if (e.stateTime <= 0) {
          e.state = "move";
          e.stateTime = 1000;
        }
      }
    } else {
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      e.x += Math.cos(angle) * e.speed;
      e.y += Math.sin(angle) * e.speed;

      if (isInsideWall(e.x, e.y)) {
        e.x -= Math.cos(angle) * e.speed * 2;
        e.y -= Math.sin(angle) * e.speed * 2;
      }
    }

    if (distance(e.x, e.y, player.x, player.y) < e.size + player.size) {
      const now = Date.now();
      if (!e.lastAttack || now - e.lastAttack > e.attackCooldown) {
        player.health -= e.damage;
        e.lastAttack = now;
        if (player.health <= 0) {
          gameOver = true;
          showEndScreen = true;
        }
      }
    }
  });
}

function shootEnemyBullet(enemy) {
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const speed = 6;
  bullets.push({
    x: enemy.x + Math.cos(angle) * enemy.size,
    y: enemy.y + Math.sin(angle) * enemy.size,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 5,
    lifespan: 4000,
    fromEnemy: true,
  });
}

// == Player shooting ==
function playerShoot() {
  if (player.attackCooldown <= 0 && !timeStopActive) {
    const angle = player.angle;
    const speed = 10;
    bullets.push({
      x: player.x + Math.cos(angle) * player.size,
      y: player.y + Math.sin(angle) * player.size,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5,
      lifespan: 3000,
      exploding: player.hasExplosiveBullets || false,
      poison: player.hasPoisonBullets || false,
    });
    player.attackCooldown = player.attackSpeed;
  }
}

// == Pickups and chests ==
function spawnPickup(x, y, type, value) {
  pickups.push({ x, y, size: 10, type, value });
}

function updatePickups(delta) {
  pickups.forEach((p, i) => {
    if (
      distance(p.x, p.y, player.x, player.y) < p.size + player.size
    ) {
      if (p.type === "gold") {
        player.gold += p.value;
        stats.coinsEarned += p.value;
      }
      pickups.splice(i, 1);
    }
  });
}

function spawnChest() {
  const x = 100 + Math.random() * (width - 200);
  const y = 100 + Math.random() * (height - 200);
  chests.push({ x, y, size: 30, opened: false });
  chestSpawnedThisWave = true;
}

function updateChests(delta) {
  chests.forEach((chest, i) => {
    if (
      !chest.opened &&
      distance(chest.x, chest.y, player.x, player.y) < chest.size + player.size &&
      keys["e"] && player.gold >= chestCost
    ) {
      player.gold -= chestCost;
      chest.opened = true;
      applyRandomUpgrade();
    }
  });
}

const upgrades = [
  "attackSpeed",
  "attackDamage",
  "maxHealth",
  "healthRegen",
  "bulletRange",
  "explosiveBullets",
  "poisonBullets",
  "timeStop",
  "focus",
];

let focusUpgrades = 0;

function applyRandomUpgrade() {
  let available = ["attackSpeed", "attackDamage", "maxHealth", "healthRegen", "bulletRange"];
  if (timeStopUnlocked) {
    available.push("focus");
  }
  let rare = ["explosiveBullets", "poisonBullets", "timeStop"];

  // Chance for rare upgrades: 10%
  let upgrade;
  if (Math.random() < 0.1) {
    upgrade = rare[Math.floor(Math.random() * rare.length)];
  } else {
    upgrade = available[Math.floor(Math.random() * available.length)];
  }

  switch (upgrade) {
    case "attackSpeed":
      player.attackSpeed = Math.max(100, player.attackSpeed - 50);
      break;
    case "attackDamage":
      player.attackDamage += 2;
      break;
    case "maxHealth":
      player.maxHealth += 10;
      player.health += 10;
      break;
    case "healthRegen":
      player.healthRegen += 0.5;
      break;
    case "bulletRange":
      // This can be implemented by lifespan of bullets, default 3000
      // We will add 500ms per upgrade
      // We'll track bullet lifespan elsewhere
      player.bulletRangeBonus = (player.bulletRangeBonus || 0) + 500;
      break;
    case "explosiveBullets":
      player.hasExplosiveBullets = true;
      break;
    case "poisonBullets":
      player.hasPoisonBullets = true;
      break;
    case "timeStop":
      timeStopUnlocked = true;
      break;
    case "focus":
      focusUpgrades++;
      timeStopDurationExtension += 5000; // +5 sec per focus upgrade
      timeStopCooldownMax = Math.max(10000, timeStopCooldownMax - 1000); // cooldown lowered by 1 sec per focus upgrade (min 10s)
      break;
  }
}

// == Wave spawning ==
function spawnWave() {
  enemiesToSpawn = 5 + wave * 2;
  enemiesKilledThisWave = 0;
  bossKilledThisWave = false;
  chestSpawnedThisWave = false;

  for (let i = 0; i < enemiesToSpawn; i++) {
    enemies.push(spawnEnemy());
  }
}

function spawnEnemy() {
  const x = Math.random() < 0.5 ? 50 : width - 50;
  const y = 50 + Math.random() * (height - 100);

  // 4 enemy types: ranged, tank, fast, regular
  const types = ["regular", "ranged", "tank", "fast"];
  const type = types[Math.floor(Math.random() * types.length)];

  let enemy = {
    x,
    y,
    size: 20,
    speed: 2,
    health: 30,
    maxHealth: 30,
    damage: 10,
    attackCooldown: 1000,
    type,
    lastAttack: 0,
    poisoned: false,
    poisonTimer: 0,
  };

  switch (type) {
    case "ranged":
      enemy.speed = 2;
      enemy.health = 25;
      enemy.damage = 5;
      enemy.attackCooldown = 1200;
      break;
    case "tank":
      enemy.speed = 1;
      enemy.health = 80;
      enemy.damage = 15;
      break;
    case "fast":
      enemy.speed = 4;
      enemy.health = 15;
      enemy.damage = 8;
      break;
    case "regular":
    default:
      break;
  }

  enemy.maxHealth = enemy.health;
  return enemy;
}

// == Portal drawing and spawning ==
function drawPortal(x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function spawnPortal() {
  portal = {
    x: width / 2,
    y: height / 2,
    w: 80,
    h: 80,
  };
}

// == Update and game loop ==
let lastTime = 0;

function update(delta) {
  if (gameOver) return;

  if (timeStopActive) {
    timeStopTimer -= delta;
    if (timeStopTimer <= 0) {
      timeStopActive = false;
    }
  }

  if (timeStopCooldown > 0) {
    timeStopCooldown -= delta;
  }

  if (waitingForNextWave) {
    waveWaitTimer -= delta;
    if (waveWaitTimer <= 0) {
      waitingForNextWave = false;
      wave++;
      spawnWave();
    }
    return;
  }

  updatePlayer(delta);
  updateEnemies(delta);
  updateBullets(delta);
  updatePickups(delta);
  updateChests(delta);

  if (player.attackCooldown > 0 && !timeStopActive) {
    player.attackCooldown -= delta;
  }

  if (enemiesKilledThisWave >= enemiesToSpawn) {
    if (!chestSpawnedThisWave && Math.random() < 0.5) {
      spawnChest();
    }
    waitingForNextWave = true;
    waveWaitTimer = 3000; // 3 seconds wait
  }

  // If boss killed and portal not spawned, spawn portal
  if (bossKilledThisWave && !portal) {
    spawnPortal();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  // Arrow shape (triangle)
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(20, 0);       // Tip of the arrow (pointing forward)
  ctx.lineTo(-15, 10);     // Bottom left corner
  ctx.lineTo(-10, 0);      // Notch (middle left)
  ctx.lineTo(-15, -10);    // Top left corner
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Health bar above player
  const barWidth = 40;
  const barHeight = 6;
  const healthRatio = player.health / player.maxHealth;
  ctx.fillStyle = "red";
  ctx.fillRect(player.x - barWidth / 2, player.y - 40, barWidth, barHeight);
  ctx.fillStyle = "limegreen";
  ctx.fillRect(player.x - barWidth / 2, player.y - 40, barWidth * healthRatio, barHeight);
  ctx.strokeStyle = "black";
  ctx.strokeRect(player.x - barWidth / 2, player.y - 40, barWidth, barHeight);
}

function drawEnemies() {
  enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.poisoned ? "purple" : "red";
    ctx.beginPath();
    ctx.arc(0, 0, e.size, 0, Math.PI * 2);
    ctx.fill();

    // Enemy health bar
    const barWidth = e.size * 2;
    const barHeight = 4;
    const healthRatio = e.health / e.maxHealth;
    ctx.fillStyle = "black";
    ctx.fillRect(-e.size, -e.size - 10, barWidth, barHeight);
    ctx.fillStyle = "limegreen";
    ctx.fillRect(-e.size, -e.size - 10, barWidth * healthRatio, barHeight);
    ctx.restore();
  });
}

function drawBullets() {
  bullets.forEach((b) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = b.fromEnemy ? "orange" : "white";
    ctx.beginPath();
    ctx.arc(0, 0, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPickups() {
  pickups.forEach((p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "gold";
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawChests() {
  chests.forEach((chest) => {
    ctx.save();
    ctx.translate(chest.x, chest.y);
    ctx.fillStyle = chest.opened ? "gray" : "yellow";
    ctx.fillRect(-chest.size / 2, -chest.size / 2, chest.size, chest.size);
    ctx.restore();
  });
}

function drawHUD() {
  // Gold count
  ctx.fillStyle = "gold";
  ctx.font = "20px Arial";
  ctx.fillText("Gold: " + player.gold, 20, 30);

  // Dash cooldown bar
  const dashBarWidth = 150;
  const dashBarHeight = 15;
  ctx.fillStyle = "black";
  ctx.fillRect(20, 40, dashBarWidth, dashBarHeight);
  const dashRatio = Math.max(0, player.dashCooldown) / player.dashCooldownMax;
  ctx.fillStyle = "cyan";
  ctx.fillRect(20, 40, dashBarWidth * (1 - dashRatio), dashBarHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(20, 40, dashBarWidth, dashBarHeight);
  ctx.fillStyle = "white";
  ctx.fillText("Dash Cooldown", 20, 38);

  // TimeStop cooldown bar (if unlocked)
  if (timeStopUnlocked) {
    const tsBarWidth = 150;
    const tsBarHeight = 15;
    ctx.fillStyle = "black";
    ctx.fillRect(20, 65, tsBarWidth, tsBarHeight);
    const tsRatio = Math.max(0, timeStopCooldown) / timeStopCooldownMax;
    ctx.fillStyle = timeStopActive ? "yellow" : "purple";
    ctx.fillRect(20, 65, tsBarWidth * (1 - tsRatio), tsBarHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(20, 65, tsBarWidth, tsBarHeight);
    ctx.fillStyle = "white";
    ctx.fillText("Time Stop Cooldown", 20, 63);
  }
}

// == Main loop ==
function gameLoop(timestamp = 0) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  ctx.clearRect(0, 0, width, height);

  if (!gameOver) {
    update(delta);

    drawPlayer();
    drawEnemies();
    drawBullets();
    drawPickups();
    drawChests();
    if (portal) drawPortal(portal.x, portal.y, portal.w, portal.h);
    drawHUD();

    playerShoot();
  } else if (showEndScreen) {
    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", width / 2, height / 2);
  }

  requestAnimationFrame(gameLoop);
}

// Start first wave
spawnWave();
requestAnimationFrame(gameLoop);
