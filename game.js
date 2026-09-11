'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#64b5f6', // J - blue
      '#ffb74d', // L - orange
      '#9e9e9e', // N - tuerca (gris metálico)
    ],
    boardBg: null,
  },
  neon: {
    colors: [
      null,
      '#00ffff', // I
      '#ffff00', // O
      '#ff00ff', // T
      '#00ff66', // S
      '#ff2255', // Z
      '#3388ff', // J
      '#ff9900', // L
      '#cccccc', // N
    ],
    boardBg: '#000000',
    gridColor: '#1a3d3d',
    glow: true,
  },
  pastel: {
    colors: [
      null,
      '#a8d8ea', // I
      '#ffe5b4', // O
      '#d9b8f0', // T
      '#b8e6c1', // S
      '#f4b8c1', // Z
      '#b8cdf0', // J
      '#f7cba4', // L
      '#d6d6e0', // N
    ],
    boardBg: null,
  },
  pixel: {
    colors: [
      null,
      '#4dd0e1', // I
      '#ffd54f', // O
      '#ba68c8', // T
      '#81c784', // S
      '#e57373', // Z
      '#64b5f6', // J
      '#ffb74d', // L
      '#9e9e9e', // N
    ],
    boardBg: null,
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (nut)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GRID_COLORS = { dark: '#22222e', light: '#d8d9ea' };

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');
const controlsListPanel = document.getElementById('controls-list-panel');
const startLevelSelect = document.getElementById('start-level');
const skinSelect = document.getElementById('skin-select');
const nameEntry = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayScores = document.getElementById('overlay-scores');
const startScreen = document.getElementById('start-screen');
const startScoresEl = document.getElementById('start-scores');
const startMaxLinesEl = document.getElementById('start-max-lines');
const playBtn = document.getElementById('play-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');

const MAX_START_LEVEL = 15;

// Single source of truth for the keybinding list, rendered into both
// the side panel and the pause menu.
const CONTROLS = [
  '<kbd>←</kbd><kbd>→</kbd> mover',
  '<kbd>↑</kbd> rotar',
  '<kbd>↓</kbd> bajar',
  '<kbd>Space</kbd> caída',
  '<kbd>P</kbd> pausa',
  '<kbd>Esc</kbd> pausa',
];

function renderControls(listEl) {
  listEl.innerHTML = CONTROLS.map(item => `<li>${item}</li>`).join('');
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
let startLevel = clampStartLevel(parseInt(localStorage.getItem('tetris.startLevel'), 10));
let skin = localStorage.getItem('tetris.skin');
if (!SKINS[skin]) skin = 'retro';

function clampStartLevel(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_START_LEVEL, Math.max(1, value));
}

function populateStartLevelOptions() {
  for (let lvl = 1; lvl <= MAX_START_LEVEL; lvl++) {
    const option = document.createElement('option');
    option.value = lvl;
    option.textContent = lvl;
    startLevelSelect.appendChild(option);
  }
}

const SCORES_KEY = 'tetris.highscores';
const STATS_KEY = 'tetris.stats';

function loadScores() {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveScores(list) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors (e.g. quota exceeded, private mode)
  }
}

function qualifies(scoreValue) {
  const list = loadScores();
  return list.length < 5 || scoreValue > list[list.length - 1].score;
}

function addScore(name, scoreValue, linesValue, levelValue) {
  const list = loadScores();
  const entry = { name, score: scoreValue, lines: linesValue, level: levelValue, date: new Date().toISOString() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.splice(5);
  const index = list.indexOf(entry);
  saveScores(list);
  return index;
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const stats = raw ? JSON.parse(raw) : {};
    return { maxLines: Number(stats.maxLines) || 0 };
  } catch {
    return { maxLines: 0 };
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage errors
  }
}

function resetScores() {
  try {
    localStorage.removeItem(SCORES_KEY);
    localStorage.removeItem(STATS_KEY);
  } catch {
    // ignore storage errors
  }
  renderScoreTable(startScoresEl);
  renderScoreTable(overlayScores);
  updateMaxLinesDisplay();
}

function renderScoreTable(containerEl, highlightIndex) {
  const list = loadScores();
  if (!list.length) {
    containerEl.innerHTML = '<p class="score-empty">Sin records todavia</p>';
    return;
  }
  const rows = list.map((entry, i) => {
    const cls = i === highlightIndex ? 'score-row highlight' : 'score-row';
    return `<div class="${cls}"><span class="score-rank">${i + 1}</span><span class="score-name">${escapeHtml(entry.name)}</span><span class="score-value">${entry.score.toLocaleString()}</span></div>`;
  }).join('');
  containerEl.innerHTML = rows;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateMaxLinesDisplay() {
  const stats = loadStats();
  startMaxLinesEl.textContent = `Maximo de lineas: ${stats.maxLines}`;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + startLevel;
    dropInterval = computeDropInterval(level);
    updateHUD();
  }
}

function computeDropInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKINS[skin].colors[colorIndex];
  const bx = x * size + 1;
  const by = y * size + 1;
  const bs = size - 2;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;

  if (SKINS[skin].glow) {
    context.shadowBlur = 12;
    context.shadowColor = color;
    context.fillRect(bx, by, bs, bs);
    context.shadowBlur = 0;
  } else if (skin === 'pastel') {
    if (typeof context.roundRect === 'function') {
      context.beginPath();
      context.roundRect(bx, by, bs, bs, 4);
      context.fill();
    } else {
      context.fillRect(bx, by, bs, bs);
    }
  } else if (skin === 'pixel') {
    context.fillRect(bx, by, bs, bs);
    const patch = Math.max(2, Math.floor(bs / 3));
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(bx, by, patch, patch);
    context.fillRect(bx + bs - patch, by + bs - patch, patch, patch);
    context.fillStyle = 'rgba(0,0,0,0.15)';
    context.fillRect(bx + bs - patch, by, patch, patch);
    context.fillRect(bx, by + bs - patch, patch, patch);
  } else {
    context.fillRect(bx, by, bs, bs);
    // highlight
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(bx, by, bs, 4);
  }

  context.globalAlpha = 1;
  context.shadowBlur = 0;
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].gridColor || GRID_COLORS[theme];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const boardBg = SKINS[skin].boardBg;
  if (boardBg) {
    ctx.fillStyle = boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawGrid();

  if (!board) return; // game not started yet (start screen visible)

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (gameOver) return; // current piece collides at spawn; don't draw it over the stack

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const boardBg = SKINS[skin].boardBg;
  if (boardBg) {
    nextCtx.fillStyle = boardBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  if (!next) return; // game not started yet (start screen visible)
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw(); // paint the final frame with the locked stack before the loop stops
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const stats = loadStats();
  if (lines > stats.maxLines) {
    stats.maxLines = lines;
    saveStats(stats);
  }

  const qualified = qualifies(score);
  nameEntry.classList.toggle('hidden', !qualified);
  if (qualified) playerNameInput.value = '';
  renderScoreTable(overlayScores);
  overlay.classList.remove('hidden');
  if (qualified) playerNameInput.focus();
}

function submitScore() {
  const name = playerNameInput.value.trim() || 'Anónimo';
  const index = addScore(name, score, lines, level);
  nameEntry.classList.add('hidden');
  renderScoreTable(overlayScores, index);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    startLevelSelect.value = startLevel;
    nameEntry.classList.add('hidden'); // clear any leftover game-over state
    overlayScores.innerHTML = '';
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return; // endGame() already painted the final frame and stopped the loop
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = computeDropInterval(startLevel);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  nameEntry.classList.add('hidden'); // reset leftover state from a previous game over
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!current) return; // game not started yet
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (e.repeat) return;
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function applyTheme() {
  document.body.dataset.theme = theme;
  themeToggle.checked = theme === 'light';
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
  applyTheme();
  draw();
  drawNext();
}

function applySkin() {
  document.body.dataset.skin = skin;
  skinSelect.value = skin;
  draw();
  drawNext();
}

function changeSkin() {
  skin = skinSelect.value;
  localStorage.setItem('tetris.skin', skin);
  applySkin();
}

restartBtn.addEventListener('click', init);
themeToggle.addEventListener('change', toggleTheme);
skinSelect.addEventListener('change', changeSkin);
saveScoreBtn.addEventListener('click', submitScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') submitScore();
});
playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});
resetScoresBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres borrar los records?')) {
    resetScores();
  }
});

resumeBtn.addEventListener('click', () => {
  togglePause();
  resumeBtn.blur();
});
pauseRestartBtn.addEventListener('click', () => {
  init();
  pauseRestartBtn.blur();
});
controlsBtn.addEventListener('click', () => {
  controlsList.classList.toggle('hidden');
  controlsBtn.blur();
});
startLevelSelect.addEventListener('change', () => {
  startLevel = clampStartLevel(parseInt(startLevelSelect.value, 10));
  localStorage.setItem('tetris.startLevel', String(startLevel));
});

populateStartLevelOptions();
startLevelSelect.value = startLevel;
renderControls(controlsListPanel);
renderControls(controlsList);
applyTheme();
applySkin();
renderScoreTable(startScoresEl);
updateMaxLinesDisplay();
