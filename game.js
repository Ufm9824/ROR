// Full-Screen Canvas Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("load", resizeCanvas);
window.addEventListener("resize", resizeCanvas);

// Game State
let gameOver = false, showEndScreen = false;
let stats = { kills: 0, damage: 0, coinsEarned: 0 };

const player = { /* same as before */ };

const bullets = [], enemies = [], pickups = [], chests = [];
let wave = 1, enemiesToSpawn = 5, spawnTimer = 0, bossWave = false, chestCost = 25;
let tooltip = null, lastShot = 0;
const biomes = ["desert", "forest", "snow"];
let currentBiome = biomes[Math.floor(Math.random()*biomes.length)];
let portal = null;
let portalRotation = 0;

// Utility Functions (spawnEnemy, spawnChest, spawnPickup) same as before...

// Portal Animation Loop (rotate rings)
function drawPortal(x, y, w, h) {
  portalRotation += 0.03;
  const cx = x + w/2, cy = y + h/2;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(portalRotation + i * 2);
    ctx.strokeStyle = `rgba(180,200,255,${0.6 - i*0.2})`;
    ctx.lineWidth = 5 - i*1.5;
    ctx.beginPath();
    ctx.arc(0, 0, w/2 - i*10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Biome Background Decorations
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
      ctx.quadraticCurveTo(x + size/2, canvas.height - size, x + size, canvas.height);
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
      ctx.lineTo(x + size/2, canvas.height - size);
      ctx.lineTo(x + size, canvas.height);
      ctx.fill();
    }
  }
}

// Draw UI
function drawHUD() {
  const pad = 20;
  // Health Bar
  ctx.fillStyle = "#550";
  ctx.fillRect(pad, pad, 200, 16);
  ctx.fillStyle = "#a0f";
  ctx.fillRect(pad, pad, 200 * (player.health / player.maxHealth), 16);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(pad, pad, 200, 16);

  // Dash Cooldown
  ctx.fillStyle = "#555";
  ctx.fillRect(pad, pad+24, 200, 8);
  ctx.fillStyle = "#0af";
  ctx.fillRect(pad, pad+24, 200 * (1 - player.dashCooldown / player.dashCooldownMax), 8);
  ctx.strokeRect(pad, pad+24, 200, 8);

  ctx.fillStyle = "#fff";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Wave: ${wave}`, pad, pad + 60);
  ctx.fillText(`Gold: ${player.gold}`, pad, pad + 90);
  ctx.fillText(`Chest Cost: ${chestCost}`, pad, pad + 120);
}

// End Screen
function drawEndScreen() {
  ctx.fillStyle = "rgba(0, 0, 50, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "36px sans-serif";
  ctx.textAlign = "center";
  const cx = canvas.width / 2, cy = canvas.height / 2;
  ctx.fillText("Game Over", cx, cy - 60);
  ctx.font = "24px sans-serif";
  ctx.fillText(`Kills: ${stats.kills}`, cx, cy - 10);
  ctx.fillText(`Damage: ${stats.damage}`, cx, cy + 30);
  ctx.fillText(`Coins: ${stats.coinsEarned}`, cx, cy + 70);
}

// Restart button handler
document.getElementById("restartBtn").onclick = () => {
  showEndScreen = false;
  document.getElementById("restartBtn").style.display = "none";
  Object.assign(stats, {kills:0, damage:0, coinsEarned:0});
  Object.assign(player, {health:5, maxHealth:5, gold:0, exploding:false, poison:false});
  bullets.length = enemies.length = pickups.length = chests.length = 0;
  wave = 1; enemiesToSpawn = 5; chestCost = 25; bossWave = false;
  currentBiome = biomes[Math.floor(Math.random()*biomes.length)];
  portal = null; gameOver = false;
};

// Main Loop
let lastTime = performance.now();
function gameLoop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;

  if (!showEndScreen) update(dt);
  drawBiome();
  if (portal) drawPortal(portal.x, portal.y, portal.w, portal.h);
  // Draw other entities here (player, bullets, enemies, etc)...

  drawHUD();
  if (showEndScreen) drawEndScreen();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
