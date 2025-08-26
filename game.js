const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
document.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 2.5,
  color: "#4af",
  health: 5,
  maxHealth: 5,
  angle: 0
};

const bullets = [];
const enemies = [];
const pickups = [];
let tooltip = null;

function shootBullet() {
  bullets.push({
    x: player.x,
    y: player.y,
    dx: Math.cos(player.angle) * 5,
    dy: Math.sin(player.angle) * 5,
    size: 5
  });
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = 0; y = Math.random() * canvas.height; }
  if (side === 1) { x = canvas.width; y = Math.random() * canvas.height; }
  if (side === 2) { x = Math.random() * canvas.width; y = 0; }
  if (side === 3) { x = Math.random() * canvas.width; y = canvas.height; }

  enemies.push({ x, y, size: 20, speed: 1.2, color: "#f44", hp: 3 });
}

function spawnPickup(x, y) {
  const types = [
    {
      name: "Health Pack",
      effect: "Restore 1 health",
      apply: () => { if (player.health < player.maxHealth) player.health++; },
      color: "#0f0"
    },
    {
      name: "Speed Boost",
      effect: "Increase speed",
      apply: () => { player.speed += 0.5; },
      color: "#0ff"
    },
  ];

  const type = types[Math.floor(Math.random() * types.length)];

  pickups.push({
    x,
    y,
    size: 15,
    ...type
  });
}

let lastShot = 0;
let enemySpawnTimer = 0;

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
});

function update(dt) {
  // Player movement
  if (keys["w"]) player.y -= player.speed;
  if (keys["s"]) player.y += player.speed;
  if (keys["a"]) player.x -= player.speed;
  if (keys["d"]) player.x += player.speed;

  // Shooting
  if (keys[" "]) {
    if (Date.now() - lastShot > 250) {
      shootBullet();
      lastShot = Date.now();
    }
  }

  // Update bullets
  bullets.forEach((b, i) => {
    b.x += b.dx;
    b.y += b.dy;
    if (b.x < 0 || b.y < 0 || b.x > canvas.width || b.y > canvas.height) {
      bullets.splice(i, 1);
    }
  });

  // Spawn enemies
  enemySpawnTimer += dt;
  if (enemySpawnTimer > 2000) {
    spawnEnemy();
    enemySpawnTimer = 0;
  }

  // Update enemies
  enemies.forEach((e, i) => {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    e.x += (dx / dist) * e.speed;
    e.y += (dy / dist) * e.speed;

    // Enemy hit by bullet
    bullets.forEach((b, j) => {
      if (Math.abs(b.x - e.x) < e.size && Math.abs(b.y - e.y) < e.size) {
        e.hp -= 1;
        bullets.splice(j, 1);
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          if (Math.random() < 0.5) {
            spawnPickup(e.x, e.y);
          }
        }
      }
    });

    // Enemy damages player
    if (Math.abs(player.x - e.x) < player.size && Math.abs(player.y - e.y) < player.size) {
      player.health -= 0.01 * dt;
      if (player.health <= 0) {
        alert("Game Over!");
        window.location.reload();
      }
    }
  });

  // Pickup logic
  tooltip = null;
  pickups.forEach((p, i) => {
    const dx = player.x - p.x;
    const dy = player.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < player.size + p.size) {
      tooltip = `${p.name}: ${p.effect}`;
      if (keys["e"]) {
        p.apply();
        pickups.splice(i, 1);
      }
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
  bullets.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Enemies
  enemies.forEach((e) => {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Pickups
  pickups.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Tooltip
  if (tooltip) {
    ctx.fillStyle = "#fff";
    ctx.font = "16px Arial";
    ctx.fillText(tooltip + " (Press E)", 10, canvas.height - 20);
  }

  // Health bar
  ctx.fillStyle = "red";
  ctx.fillRect(10, 10, 100, 10);
  ctx.fillStyle = "lime";
  ctx.fillRect(10, 10, (player.health / player.maxHealth) * 100, 10);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(10, 10, 100, 10);
}

let lastTime = performance.now();
function gameLoop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
