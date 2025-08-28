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
  size: 20,
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

// === Chest upgrades collected, for display ===
const collectedUpgrades = {};

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

    // Enemy bullets do not hit enemies, player bullets do not hit player
    if (!b.fromEnemy) {
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
            // 50% chance drop 0-5 gold
            if (Math.random() < 0.5) {
              const goldDrop = Math.floor(Math.random() * 6);
              if (goldDrop > 0) {
                stats.coinsEarned += goldDrop;
                player.gold += goldDrop;
                spawnPickup(e.x, e.y, "gold", goldDrop);
              }
            }

            if (e.type === "boss") {
              bossKilledThisWave = true;
            }
            enemies.splice(ei, 1);
          }
        }
      });
    } else {
      // Enemy bullet hits player
      if (distance(b.x, b.y, player.x, player.y) < player.size + b.size) {
        player.health -= 10; // fixed damage for enemy bullets
        bullets.splice(i, 1);
        if (player.health <= 0) {
          gameOver = true;
          showEndScreen = true;
        }
      }
    }

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

      // Melee attack if close
      if (
        distance(e.x, e.y, player.x, player.y) < e.size + player.size + 10 &&
        e.attackCooldown <= 0
      ) {
        player.health -= e.damage;
        e.attackCooldown = e.attackCooldownMax || 1000;

        if (player.health <= 0) {
          gameOver = true;
          showEndScreen = true;
        }
      }
      if (e.attackCooldown > 0) e.attackCooldown -= delta;
    }
  });
}

function shootEnemyBullet(enemy) {
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const speed = 5;
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

// == Player shooting on Spacebar ==
function playerShoot() {
  if (player.attackCooldown <= 0 && !timeStopActive && keys[" "]) {
    const angle = player.angle;
    const speed = 10;
    bullets.push({
      x: player.x + Math.cos(angle) * player.size,
      y: player.y + Math.sin(angle) * player.size,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5,
      lifespan: 3000 + (player.bulletRangeBonus || 0),
      exploding: player.hasExplosiveBullets || false,
      poison: player.hasPoisonBullets || false,
      fromEnemy: false,
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
    if (distance(p.x, p.y, player.x, player.y) < p.size + player.size) {
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
      keys["e"] &&
      player.gold >= chestCost
    ) {
      player.gold -= chestCost;
      chest.opened = true;

      // Apply and record upgrade
      const upgrade = applyRandomUpgrade();

      if (collectedUpgrades[upgrade]) {
        collectedUpgrades[upgrade]++;
      } else {
        collectedUpgrades[upgrade] = 1;
      }
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
  let available = [
    "attackSpeed",
    "attackDamage",
    "maxHealth",
    "healthRegen",
    "bulletRange",
  ];
  if (timeStopUnlocked) {
    available.push("focus");
  }
  let rare = ["explosiveBullets", "poisonBullets", "timeStop"];

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
      timeStopDurationExtension += 5000;
      timeStopCooldownMax = Math.max(10000, timeStopCooldownMax - 1000);
      break;
  }

  return upgrade;
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
    attackCooldownMax: 1000,
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
      enemy.attackCooldownMax = 1200;
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

    // Player can move and do things during pause, but enemies and bullets stop moving
    updatePlayer(delta);

    if (waveWaitTimer <= 0) {
      waitingForNextWave = false;
      wave++;
      spawnWave();
    }

    // Remove opened chests during wave delay
    for (let i = chests.length - 1; i >= 0; i--) {
      if (chests[i].opened) chests.splice(i, 1);
    }

    // Still update pickups so player can pick gold dropped
    updatePickups(delta);

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

  if (bossKilledThisWave && !portal) {
    spawnPortal();
  }
}

// == Drawing functions ==

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-15, 10);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-15, -10);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawEnemies() {
  enemies.forEach((e) => {
    ctx.fillStyle = e.poisoned ? "purple" : "red";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();

    // Health bar
    ctx.fillStyle = "black";
    ctx.fillRect(e.x - e.size, e.y - e.size - 8, e.size * 2, 5);
    ctx.fillStyle = "lime";
    ctx.fillRect(
      e.x - e.size,
      e.y - e.size - 8,
      (e.health / e.maxHealth) * e.size * 2,
      5
    );
  });
}

function drawBullets() {
  bullets.forEach((b) => {
    ctx.fillStyle = b.poison ? "purple" : b.fromEnemy ? "orange" : "white";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPickups() {
  pickups.forEach((p) => {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawChests() {
  chests.forEach((chest) => {
    ctx.fillStyle = chest.opened ? "gray" : "gold";
    ctx.fillRect(chest.x - chest.size, chest.y - chest.size, chest.size * 2, chest.size * 2);
    ctx.strokeStyle = "black";
    ctx.strokeRect(chest.x - chest.size, chest.y - chest.size, chest.size * 2, chest.size * 2);

    if (!chest.opened) {
      ctx.fillStyle = "black";
      ctx.font = "16px Arial";
      ctx.fillText("E", chest.x - 6, chest.y + 6);
    }
  });
}

function drawUI() {
  // Health bar top-left
  const barWidth = 200;
  const barHeight = 20;
  const padding = 10;
  ctx.fillStyle = "black";
  ctx.fillRect(padding, padding, barWidth, barHeight);
  ctx.fillStyle = "red";
  ctx.fillRect(padding, padding, (player.health / player.maxHealth) * barWidth, barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(padding, padding, barWidth, barHeight);
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.fillText(`Health: ${Math.floor(player.health)}/${player.maxHealth}`, padding + 5, padding + 16);

  // Dash cooldown bar below health
  const dashBarY = padding + barHeight + 10;
  ctx.fillStyle = "black";
  ctx.fillRect(padding, dashBarY, barWidth, barHeight);
  ctx.fillStyle = "blue";
  const dashPercent = Math.min(player.dashCooldown / player.dashCooldownMax, 1);
  ctx.fillRect(padding, dashBarY, barWidth * (1 - dashPercent), barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(padding, dashBarY, barWidth, barHeight);
  ctx.fillStyle = "white";
  ctx.fillText("Dash Cooldown", padding + 5, dashBarY + 16);

  // TimeStop cooldown bar below dash cooldown
  const timeStopBarY = dashBarY + barHeight + 10;
  ctx.fillStyle = "black";
  ctx.fillRect(padding, timeStopBarY, barWidth, barHeight);
  ctx.fillStyle = "cyan";
  const timeStopPercent = timeStopActive
    ? 1 - timeStopTimer / (timeStopDurationBase + timeStopDurationExtension)
    : Math.min(timeStopCooldown / timeStopCooldownMax, 1);
  ctx.fillRect(padding, timeStopBarY, barWidth * (1 - timeStopPercent), barHeight);
  ctx.strokeStyle = "white";
  ctx.strokeRect(padding, timeStopBarY, barWidth, barHeight);
  ctx.fillStyle = "white";
  ctx.fillText("TimeStop", padding + 5, timeStopBarY + 16);

  // Gold count below bars
  ctx.fillStyle = "yellow";
  ctx.font = "18px Arial";
  ctx.fillText(`Gold: ${player.gold}`, padding, timeStopBarY + barHeight + 30);

  // Draw collected upgrades at top center
  const iconSize = 32;
  const spacing = 10;
  let startX = width / 2 - ((iconSize + spacing) * Object.keys(collectedUpgrades).length) / 2;
  const startY = 10;

  Object.entries(collectedUpgrades).forEach(([key, count], index) => {
    const x = startX + index * (iconSize + spacing);
    drawUpgradeIcon(x, startY, iconSize, key, count);
  });
}

// Draw upgrade icons and tooltip
function drawUpgradeIcon(x, y, size, key, count) {
  ctx.fillStyle = "white";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText(key[0].toUpperCase(), x + size / 4, y + (size * 3) / 4);

  // Count in corner
  ctx.fillStyle = "yellow";
  ctx.font = "16px Arial";
  ctx.fillText(count, x + size - 12, y + size - 6);

  // Tooltip if mouse hovers over icon
  if (
    mouseX >= x &&
    mouseX <= x + size &&
    mouseY >= y &&
    mouseY <= y + size
  ) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(mouseX + 10, mouseY + 10, 140, 30);
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.fillText(upgradeTooltipText(key), mouseX + 15, mouseY + 30);
  }
}

function upgradeTooltipText(key) {
  switch (key) {
    case "attackSpeed":
      return "Attack Speed: Faster shooting";
    case "attackDamage":
      return "Attack Damage: More damage";
    case "maxHealth":
      return "Max Health: More health";
    case "healthRegen":
      return "Health Regen: Gradual healing";
    case "bulletRange":
      return "Bullet Range: Bullets last longer";
    case "explosiveBullets":
      return "Explosive Bullets: Splash damage";
    case "poisonBullets":
      return "Poison Bullets: Damage over time";
    case "timeStop":
      return "Time Stop: Stop time for 10s";
    case "focus":
      return "Focus: +5s Time Stop, -1s cooldown";
    default:
      return "Unknown upgrade";
  }
}

// == Main loop ==
function gameLoop(timestamp = 0) {
  if (!lastTime) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  ctx.clearRect(0, 0, width, height);

  update(delta);

  drawChests();
  drawPickups();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawUI();

  if (showEndScreen) {
    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.fillText("Game Over", width / 2 - 100, height / 2);
  } else {
    requestAnimationFrame(gameLoop);
  }
}

// == Start game ==
spawnWave();
gameLoop();
