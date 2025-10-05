// ---- Config ----
const LOGO_SRC = "https://qorgenius-os.xyz/qor-logo.png"; // QorGenius logo (PNG)
const W = 360,
  H = 640;
const PIPE_GAP = 150;
const PIPE_WIDTH = 64;
const PIPE_SPEED = 2.4; // world speed
const GRAVITY = 0.35;
const FLAP = -6.2;
const MAX_DROP = 8.5;
const PIPE_SPACING_MIN = 260; // px between pipes
const PIPE_SPACING_MAX = 330;
const BIRD_SCALE = 0.38; // scale logo
const BIRD_SHRINK_HITBOX = 0.85; // slightly smaller hitbox for fairness

// ---- Setup ----
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const startUI = document.getElementById("start");
const overUI = document.getElementById("over");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const finalScore = document.getElementById("finalScore");
const finalBest = document.getElementById("finalBest");
const playBtn = document.getElementById("playBtn");
const againBtn = document.getElementById("againBtn");
const shareBtn = document.getElementById("shareBtn");
const muteBtn = document.getElementById("muteBtn");

// SOUND (tiny blip via WebAudio)
let audioOn = false;
let actx, osc;
function beep(freq = 880, dur = 0.06) {
  if (!audioOn) return;
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.connect(g);
  g.connect(actx.destination);
  o.frequency.value = freq;
  o.type = "square";
  g.gain.setValueAtTime(0.05, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  o.start();
  o.stop(actx.currentTime + dur);
}

// Load logo
const logo = new Image();
logo.crossOrigin = "anonymous";
logo.src = LOGO_SRC;

// Game state
let state = "start";
let score = 0;
let best = +localStorage.getItem("flappyqor_best") || 0;

let bird = {
  x: 70,
  y: H / 2,
  vy: 0,
  w: 80,
  h: 80,
};

let pipes = [];
let nextPipeX = W + 60;

function reset() {
  score = 0;
  bird.x = 70;
  bird.y = H / 2;
  bird.vy = 0;
  pipes = [];
  nextPipeX = W + 60;
  spawnPipe();
  spawnPipe();
  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

function spawnPipe() {
  const gapY = 110 + Math.random() * (H - 220 - PIPE_GAP);
  const x =
    (pipes.length ? pipes[pipes.length - 1].x : W) +
    (PIPE_SPACING_MIN + Math.random() * (PIPE_SPACING_MAX - PIPE_SPACING_MIN));
  pipes.push({ x, gapY, passed: false });
}

// Input
function flap() {
  if (state === "start") {
    startGame();
    return;
  }
  if (state !== "play") return;
  bird.vy = FLAP;
  beep(1200, 0.05);
}
canvas.addEventListener("pointerdown", flap);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    flap();
  }
  if (e.key === "p" && state === "play") paused = !paused;
});

playBtn.onclick = () => startGame();
againBtn.onclick = () => {
  overUI.style.display = "none";
  startUI.style.display = "grid";
  state = "start";
};
shareBtn.onclick = () => {
  const text = `I scored ${score} in Flappy QorGenius! Can you beat it?`;
  const url = location.href;
  const share = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text
  )}&url=${encodeURIComponent(url)}&via=QorGeniusOS`;
  window.open(share, "_blank");
};
muteBtn.onclick = () => {
  audioOn = !audioOn;
  muteBtn.textContent = `SOUND: ${audioOn ? "ON" : "OFF"}`;
  if (audioOn) beep(660, 0.05);
};

function startGame() {
  startUI.style.display = "none";
  overUI.style.display = "none";
  reset();
  state = "play";
}

// World helpers
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function birdHitbox() {
  const w = (logo.width || 80) * BIRD_SCALE * BIRD_SHRINK_HITBOX;
  const h = (logo.height || 80) * BIRD_SCALE * BIRD_SHRINK_HITBOX;
  return { x: bird.x + 4, y: bird.y + 4, w, h };
}

// Game loop
let last = 0,
  paused = false;
function tick(t) {
  requestAnimationFrame(tick);
  const dt = Math.min(32, t - last);
  last = t;
  if (state !== "play" || paused) {
    draw();
    return;
  }

  // Bird physics
  bird.vy = Math.min(MAX_DROP, bird.vy + GRAVITY);
  bird.y += bird.vy;

  // Pipes move
  for (const p of pipes) {
    p.x -= PIPE_SPEED;
  }
  if (pipes.length && pipes[0].x + PIPE_WIDTH < -40) pipes.shift();
  // Ensure next pipe exists ahead
  if (pipes[pipes.length - 1].x < W - PIPE_SPACING_MIN * 0.6) spawnPipe();

  // Scoring
  for (const p of pipes) {
    if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
      p.passed = true;
      score++;
      beep(700, 0.05);
      updateHUD();
    }
  }

  // Collisions
  const hit = birdHitbox();
  const ground = bird.y + (logo.height || 80) * BIRD_SCALE >= H - 16;
  const ceiling = bird.y <= 0;
  if (ground || ceiling) {
    gameOver();
    return;
  }

  for (const p of pipes) {
    const topRect = { x: p.x, y: 0, w: PIPE_WIDTH, h: p.gapY };
    const botRect = {
      x: p.x,
      y: p.gapY + PIPE_GAP,
      w: PIPE_WIDTH,
      h: H - (p.gapY + PIPE_GAP),
    };
    if (rectsOverlap(hit, topRect) || rectsOverlap(hit, botRect)) {
      gameOver();
      return;
    }
  }

  draw();
}
requestAnimationFrame(tick);

function gameOver() {
  beep(220, 0.12);
  state = "over";
  best = Math.max(best, score);
  localStorage.setItem("flappyqor_best", String(best));
  finalScore.textContent = score;
  finalBest.textContent = best;
  setTimeout(() => {
    overUI.style.display = "grid";
  }, 150);
}

// Draw
function draw() {
  // Sky gradient already via CSS; here we add parallax hills/grid
  ctx.clearRect(0, 0, W, H);

  // Distant stars grid (retro)
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let y = 0; y < H; y += 16) {
    ctx.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 16) {
    ctx.fillRect(x, 0, 1, H);
  }

  // Ground stripe
  ctx.fillStyle = "#19314f";
  ctx.fillRect(0, H - 16, W, 16);
  ctx.fillStyle = "#0f1e32";
  for (let x = 0; x < W; x += 8) {
    ctx.fillRect(x, H - 16, 4, 16);
  }

  // Pipes
  for (const p of pipes) {
    // Top
    ctx.fillStyle = "#46ff86";
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.gapY);
    // Cap
    ctx.fillStyle = "#2fbf5e";
    ctx.fillRect(p.x - 2, p.gapY - 12, PIPE_WIDTH + 4, 12);
    // Bottom
    ctx.fillStyle = "#46ff86";
    ctx.fillRect(p.x, p.gapY + PIPE_GAP, PIPE_WIDTH, H - (p.gapY + PIPE_GAP));
    // Cap
    ctx.fillStyle = "#2fbf5e";
    ctx.fillRect(p.x - 2, p.gapY + PIPE_GAP, PIPE_WIDTH + 4, 12);
  }

  // Bird (logo)
  const lw = (logo.width || 80) * BIRD_SCALE;
  const lh = (logo.height || 80) * BIRD_SCALE;
  const angle = Math.max(-0.35, Math.min(0.5, bird.vy / 10));
  ctx.save();
  ctx.translate(bird.x + lw / 2, bird.y + lh / 2);
  ctx.rotate(angle);
  if (logo.complete) ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
  else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(-lw / 2, -lh / 2, lw, lh);
  }
  ctx.restore();
}

// Show start screen initially
updateHUD();
