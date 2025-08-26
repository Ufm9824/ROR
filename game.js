const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 2.5,
  color: "#4af"
};

const bullets = [];
const enemies = [];

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

let lastShot = 0;
let enemySpawnTimer = 0;

function update(dt) {
  // Player movement
  if (keys["w"]) player.y -= player.speed;
  if (keys["s"]) player.y += player.speed;
  if (keys["a"]) player.x -= player.speed;
  if (keys["d"]) player.x += player.speed;

  // Aim at mouse
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
  };

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

    // Remove if out of bounds
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

    // Collision with bullets
    bullets.forEach((b, j) => {
      if (Math.abs(b.x - e.x) < e.size && Math.abs(b.y - e.y) < e.size) {
        e.hp -= 1;
        bullets.splice(j, 1);
        if (e.hp <= 0) enemies.splice(i, 1);
      }
    });
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
