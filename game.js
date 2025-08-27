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

  if (e.key === "q" && timeStopUnlocked && !timeStopActive) {
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

// Checks if position is inside "walls" or map bounds
function isInsideWall(x, y) {
  if (x < 50 || x > width - 50 || y < 50 || y > height - 50) return true;
  // Add biome specific wall checks here if needed
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

  // Always aim toward mouse cursor
  player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);

  // Health regen (if any)
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

    // Check collisions with enemies
    enemies.forEach((e, ei) => {
      if (distance(b.x, b.y, e.x, e.y) < e.size + b.size) {
        e.health -= player.attackDamage;
        stats.damage += player.attackDamage;
        if (b.exploding) {
          e.poisoned = false; // No poison if exploding
          // Damage nearby enemies too
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
          const goldDrop = Math.floor(Math.random() * 16); // 0-15 gold
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
    if (timeStopActive) return; // frozen enemies

    if (e.poisoned) {
      e.poisonTimer -= delta;
      if (e.poisonTimer <= 0) e.poisoned = false;
    }

    if (e.type === "ranged") {
      if (!e.state) e.state = "move"; // "move" or "shoot"
      if (!e.stateTime) e.stateTime = 1000; // 1 sec move/shoot duration
      e.stateTime -= delta;
      if (e.state === "move") {
        // Move toward player
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;

        // Avoid walls
        if (isInsideWall(e.x, e.y)) {
          e.x -= Math.cos(angle) * e.speed * 2;
          e.y -= Math.sin(angle) * e.speed * 2;
        }

        if (e.stateTime <= 0) {
          e.state = "shoot";
          e.stateTime = 500; // short shoot delay
          e.shootCooldown = 0;
        }
      } else if (e.state === "shoot") {
        // Shoot once when cooldown is zero
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
      // Normal enemy behavior: move toward player
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      e.x += Math.cos(angle) * e.speed;
      e.y += Math.sin(angle) * e.speed;

      if (isInsideWall(e.x, e.y)) {
        e.x -= Math.cos(angle) * e.speed * 2;
        e.y -= Math.sin(angle) * e.speed * 2;
      }
    }

    // Attack player if close
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
    lifespan: 3000,
    poison: false,
    exploding: false,
    fromEnemy: true,
  });
}

// == Pickup update ==
function updatePickups(delta) {
  pickups.forEach((p, i) => {
    if (distance(player.x, player.y, p.x, p.y) < player.size + p.size) {
      applyPickup(p.type);
      pickups.splice(i, 1);
    }
  });
}

// == Chest update ==
function updateChests(delta) {
  chests.forEach((c) => {
    if (distance(player.x, player.y, c.x, c.y) < 50 && keys["e"]) {
      if (!c.opened && player.gold >= chestCost) {
        openChest(c);
      }
    }
  });
}

// == Spawn functions ==
function spawnEnemy(type = "normal") {
  let x, y;
  let attempts = 0;
  do {
    x = 50 + Math.random() * (width - 100);
    y = 50 + Math.random() * (height - 100);
    attempts++;
  } while (isInsideWall(x, y) && attempts < 50);

  const enemy = {
    x,
    y,
    size: 20,
    speed: 1.5,
    health: 30,
    maxHealth: 30,
    damage: 5,
    attackCooldown: 1000,
    lastAttack: 0,
    type,
    poisoned: false,
    poisonTimer: 0,
  };

  if (type === "tank") {
    enemy.health = 100;
    enemy.maxHealth = 100;
    enemy.damage = 2;
    enemy.attackCooldown = 2000;
    enemy.speed = 0.8;
  }

  if (type === "fast") {
    enemy.speed = 3.5;
    enemy.health = 15;
    enemy.maxHealth = 15;
    enemy.damage = 3;
    enemy.attackCooldown = 700;
  }

  if (type === "ranged") {
    enemy.speed = 1;
    enemy.health = 20;
    enemy.maxHealth = 20;
    enemy.damage = 4;
    enemy.attackCooldown = 1500;
    enemy.shootCooldown = 0;
    enemy.state = "move";
    enemy.stateTime = 1000;
  }

  if (type === "boss") {
    enemy.size = 50;
    enemy.speed = 1;
    enemy.health = 300;
    enemy.maxHealth = 300;
    enemy.damage = 15;
    enemy.attackCooldown = 1500;
  }

  enemies.push(enemy);
}

function spawnPickup(x, y, type) {
  pickups.push({
    x,
    y,
    size: 12,
    type,
  });
}

function spawnChest() {
  if (chests.length >= 3) return;
  const x = 60 + Math.random() * (width - 120);
  const y = 60 + Math.random() * (height - 120);
  if (isInsideWall(x, y)) return;
  chests.push({
    x,
    y,
    size: 30,
    opened: false,
  });
}

function openChest(chest) {
  if (chest.opened) return;
  if (player.gold < chestCost) return;
  player.gold -= chestCost;
  chest.opened = true;
  chestCost += 10;

  const roll = Math.floor(Math.random() * 75);
  let pickupType = null;

  if (roll < 20) pickupType = "damage";
  else if (roll < 30) pickupType = "speed";
  else if (roll < 40) pickupType = "maxHealth";
  else if (roll < 50) pickupType = "regen";
  else if (roll < 60) pickupType = "lifespan";
  else if (roll === 73) pickupType = "poison";
  else if (roll === 74) pickupType = "explode";
  else if (roll === 72 && !timeStopUnlocked) pickupType = "timeStopUnlock";
  else if (roll === 71 && timeStopUnlocked) pickupType = "timeStopExtend";

  if (pickupType) {
    spawnPickup(chest.x, chest.y, pickupType);
  }
}

// == Portal spawn ==
function spawnPortal(x, y) {
  portal = { x, y, w: 80, h: 120 };
}

// == Update function ==
let lastSpawnTime = 0;
function update(delta) {
  if (gameOver) return;

  if (timeStopActive) {
    timeStopTimer -= delta;
    if (timeStopTimer <= 0) {
      timeStopActive = false;
    }
  }

  updatePlayer(delta);

  if (!timeStopActive) {
    updateEnemies(delta);
    updateBullets(delta);
  }
  updatePickups(delta);
  updateChests(delta);

  lastSpawnTime += delta;
  if (
    lastSpawnTime > 1500 &&
    enemies.length < enemiesToSpawn
  ) {
    const enemyTypeRoll = Math.random();
    if (
      wave % 10 === 0 &&
      enemies.filter((e) => e.type === "boss").length === 0 &&
      !bossKilledThisWave
    ) {
      spawnEnemy("boss");
    } else if (enemyTypeRoll < 0.3) spawnEnemy("fast");
    else if (enemyTypeRoll < 0.6) spawnEnemy("tank");
    else spawnEnemy("ranged");
    lastSpawnTime = 0;
  }

  // Spawn portal only after boss killed this wave
  if (bossKilledThisWave && !portal) {
    spawnPortal(width / 2, height / 2);
  }
}

// == Pickup effect ==
function applyPickup(type) {
  switch (type) {
    case "damage":
      player.attackDamage += 3;
      break;
    case "speed":
      player.speed += 0.3;
      break;
    case "maxHealth":
      player.maxHealth += 20;
      player.health += 20;
      break;
    case "regen":
      player.healthRegen += 0.1;
      break;
    case "lifespan":
      // Could apply to bullet lifespan or something else
      break;
    case "poison":
      // Future poison effect
      break;
    case "explode":
      // Future explode effect
      break;
    case "timeStopUnlock":
      timeStopUnlocked = true;
      break;
    case "timeStopExtend":
      timeStopDurationExtension += 5000;
      break;
  }
}

// == Render functions, game loop, etc. ==
// ... (Keep the rest of your existing code unchanged)
