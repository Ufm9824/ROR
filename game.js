// Wait until the DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let width = window.innerWidth;
  let height = window.innerHeight;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  window.addEventListener("resize", resize);
  resize();

  // Game state example: draw a circle to verify functionality
  function drawTest() {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'lime';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 30, 0, 2 * Math.PI);
    ctx.fill();
    ctx.font = '20px Arial';
    ctx.fillText('Canvas is working!', width / 2 - 80, height / 2 + 50);
  }

  drawTest();
  // Then start your actual game loop here (requestAnimationFrame etc.)
});
