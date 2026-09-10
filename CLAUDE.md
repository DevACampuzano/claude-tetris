# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vanilla-JS Tetris rendered on HTML5 Canvas. No dependencies, no `package.json`, no build/lint/test tooling. Three source files: `index.html`, `style.css`, `game.js`.

## Running

Open `index.html` directly, or serve statically to avoid `file://` quirks:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

There is no test suite. Verify changes by playing in the browser (hard refresh to bust cache).

## Architecture (`game.js`)

Single-file, single global scope (`'use strict'`, no modules). All mutable game state lives in the `let board, current, next, score, ... , animId` declaration near the top; `init()` (re)initializes every one of them and is the reset path, wired to the restart button and called once at load.

- **Board model**: `board` is a `ROWS × COLS` array of ints. `0` = empty; `1–7` = a color/piece index into `COLORS` and `PIECES` (both are 1-indexed with a leading `null`).
- **Pieces**: square matrices in `PIECES`. `current`/`next` are `{ type, shape, x, y }`. Rotation = `rotateCW` (transpose + reverse) with wall kicks tried in `tryRotate` (offsets `[0,-1,1,-2,2]`).
- **`collide(shape, x, y)`** is the single source of truth for legality — bounds + overlap. Every move, rotation, drop, ghost projection, and the game-over check calls it.
- **Game loop**: `loop(ts)` on `requestAnimationFrame` accumulates `dropAccum` and steps the piece down once it exceeds `dropInterval`. Locking flows `lockPiece → merge → clearLines → spawn`; `spawn` triggers `endGame()` when the fresh piece already collides.
- **Scoring/leveling**: `clearLines` uses `LINE_SCORES` × `level`; level rises every 10 lines and recomputes `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` clears and repaints grid → locked board → ghost (alpha 0.2, position from `ghostY()`) → current piece, all via `drawBlock`. `drawNext()` paints the side canvas.
- **Input**: one `keydown` listener; `P` toggles pause always, all other keys are ignored while `paused`/`gameOver`.
- **Pause**: `togglePause` cancels/restarts the RAF loop and must reset `lastTime` on resume so `dt` doesn't spike.

## Constraint when changing dimensions

`COLS`, `ROWS`, `BLOCK` in `game.js` must stay in sync with the hardcoded `width`/`height` of `<canvas id="board">` in `index.html` (currently `300 × 600` = `COLS*BLOCK × ROWS*BLOCK`). Changing one without the other breaks rendering.

## Conventions

UI strings and the README are in Spanish; code identifiers and comments are English. Match that.

Todas las respuestas al usuario deben ser en español.
