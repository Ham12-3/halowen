# Midnight Line

A browser-based 3D Halloween endless-runner, in the style of Subway Surfers. The
player is a hooded lantern bearer running along the roofs of London Underground
trains on a brick railway viaduct, at night, from London Bridge (under the
Shard) to Waterloo (past the London Eye). Three lanes: switch lanes before your
train runs out, jump gaps and piles of jack-o'-lanterns, slide under signal
boards and road bridges. Reaching Waterloo clears the stage; one crash ends the run.

The previous game in this repo, **Pumpkin Hollow** (a free-roaming graveyard
game), is preserved on the `phase-4-flare-shrines-sound` branch. Its ghost model
(`src/entities/ghostModel.ts`) can be restored from there for Phase 3.

## Tech stack

- Three.js (r187) + Vite 8 + TypeScript 7 in strict mode (`noUncheckedIndexedAccess` on)
- No game engine, no physics library, no external models or audio files
- Every asset is built from Three.js primitives and canvas textures; repeated props use `InstancedMesh`
- Sound uses the Web Audio API, synthesised in code
- UI is plain DOM + CSS over the canvas (fonts: Creepster logo, Fredoka, Nunito)

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## Folder structure

```
src/
  main.ts                 entry point; exposes `window.game` in dev only
  style.css               design tokens, screens, HUD (all colours/spacing are CSS variables)
  game/
    Game.ts               wires everything; frame() handles menu keys + renders, simulate() advances a run
    GameState.ts          distance, speed, time, status (ready / playing / crashed / arrived), best run
    ChaseCamera.ts        camera behind the runner; eases sideways/up, locked along the track, FOV widens with pace
    Input.ts              keyboard only; actions() = this frame's left/right/jump/slide presses
    Loop.ts, renderer.ts  rAF loop with clamped delta; WebGLRenderer setup (no shadow maps)
    config.ts             ALL tuning: LANES, RUN, TRAIN, OBSTACLE, COURSE, ROUTE, CAMERA, ATMOSPHERE
  world/
    course.ts             block-by-block course generator + queries (hasRoof, obstaclesNear, laneX)
    CourseView.ts         instanced carriages, gap pieces, pumpkin hurdles, signal boards, bridges
    World.ts              owns sky, lights, viaduct, course view, skyline, landmarks, station
    viaduct.ts            ballast/rails/parapets/arches/street, shifted in 2-block steps
    skyline.ts            recycled London buildings (terraces, offices, towers) both sides
    atmosphere.ts         FogExp2, gradient sky dome, moon, stars
    lighting.ts           moonlight + hemisphere fill (no shadows)
    rng.ts                seeded PRNG + value noise
    props/                train, obstacles, landmarks (Shard, London Eye), station (Waterloo),
                          pumpkins, glow texture, geometry helpers (instance, mergeParts, paint)
  entities/
    Runner.ts             lanes, jump, slam, slide, landing, falling, obstacle hits, poses
    playerModel.ts        hooded figure + blob shadow; Lantern.ts the lantern and its light
  ui/
    Hud.ts                timer, Underground-style route line, distance to go, speed + pace bar, toasts
    Screens.ts            title / pause / end overlays (picked each frame from status + paused)
    icons.ts              inline SVG icons (decorative, aria-hidden)
    FpsMeter.ts           dev frame-rate / draw-call meter (backquote toggles)
  audio/
    Sound.ts              whistle, clickety-clack, jump/land/slide/lane, crash, arrival; mute
    synth.ts, ambience.ts tone/noise/bell building blocks; wind, drone and owl
```

## Conventions

- **Coordinates:** Y is up. The line runs towards **-Z**: world `z = -distance`.
  Lane 0 is left (x = -2.8), lane 1 the middle, lane 2 right (`laneX()`). Rails
  sit at y = 0, carriage roofs at `TRAIN.roofHeight` (3.2), the street at y = -9.
- **Course:** generated in 14 m blocks (`TRAIN.blockLength`). Each lane of a block
  is either a carriage (a roof to run on) or empty track. Roofed blocks may hold
  one obstacle: `hurdle` (jump), `bar` (slide under; jumping hits it) or `gap` (a
  hole mid-carriage; jump). Bridges are a `bar` in every lane. Fairness rules in
  `Course.generate()`: some lane is roofed in both this block and the last; no
  lane gets obstacles in back-to-back blocks; early on one roofed lane stays clear;
  the first blocks and the run-in to Waterloo are hazard-free.
- **Collision** is lane-based, not geometric: support = `course.hasRoof(nearestLane(x), distance)`;
  obstacle hits compare feet/head height against `OBSTACLE` heights. Models in
  `props/obstacles.ts` are built from the same `OBSTACLE` constants, so change them
  there, not in the geometry.
- **Runner rules:** slide in mid-air slams down only after a real jump (not while
  hopping across an empty lane); falling below `roofHeight - fallLimit` = crash;
  landing up to `OBSTACLE.stepUp` below a roof still counts (forgiving late jumps).
- **Everything in the world is static**; the runner moves. Recycled things
  (skyline, viaduct, course instances) are only rebuilt when they change.
- **Flow:** `restart()` = title (`ready`). Space/Enter/click begins (`play()`
  swallows that key press so it doesn't also jump). Esc/P pauses; blurring the
  window pauses. Crash/arrival shows the end screen; Space/Enter/R/click runs again.
- **No pointer lock / mouse look:** the game is keyboard-only; the cursor hides while running.
- **Lights are fixed** (hemisphere, moon, lantern): never add or remove lights at
  runtime. Glows (pumpkin faces, windows, signals, Eye pods) are unlit materials.
- **UI:** all styling goes through the CSS tokens in `style.css` (`--c-*`, `--space-*`,
  `--radius-*`, `--dur-*`). Buttons are real `<button>`s with `data-action`
  (`play`, `restart`, `sound`); screens focus their main button; animations
  respect `prefers-reduced-motion`. HUD bars/markers move with transforms only.
- **Performance target:** 60 fps on a mid-range laptop (Iris Xe class). Currently
  ~45 draw calls and ~25k triangles. Pixel ratio capped at 1.5.
- Keep files focused and under ~200 lines; split builders out when they grow.

## Testing notes

- In dev, `window.game` exposes the running game. Drive it by stepping, mirroring the frame loop:
  `game.restart(); game.play();` then `game.simulate(1 / 60, t); game.input.endFrame();`.
  Press keys with `game.input.pressed.add('Space' | 'KeyA' | 'KeyD' | 'KeyS')` before a step.
- To view a spot on the line: set `game.state.distance`, `game.course.update(d)`,
  `game.runner.position.z = -d`, then `game.simulate(...)` while the status is `ready`
  (the runner idles there) and hide `.screen` with `style.display = 'none'`.
- A bot that reads `course.hasRoof` / `course.obstaclesNear` ahead and presses keys can
  play hundreds of runs in seconds; use it to check fairness after changing `COURSE`.
  Most bot crashes come from late lane decisions; trace the last second before
  blaming the generator.
- The browser pane throttles rAF (often ~1 fps) and CSS animations, so screenshots can
  show stale frames: wait and retake. Its fps meter is meaningless; measure GPU time with
  `EXT_disjoint_timer_query_webgl2` around a warm burst of ~8 renders.
- The pane can't play audio: render effects offline with an `OfflineAudioContext` via
  `Sound.prototype.x.call({ play: (make) => make(ctx, out) })` and check peak/RMS.
- Bot runs save a best distance in localStorage (`midnight-line-best`); clear it afterwards.
- After each phase: run `npm run typecheck`, start the dev server, and check the browser console.

## Build phases

1. **Done:** core runner: viaduct, trains in 3 lanes, run/switch/jump/slide, obstacles + crash,
   chase camera, London skyline, the Shard, London Eye, Waterloo finish, HUD, screens, sound
2. Soul coins / pickups and score; station-to-station stages (Waterloo → Westminster…) with
   more landmarks (St Paul's, Tate Modern, Big Ben)
3. Halloween hazards: ghosts swooping into lanes, lantern-flare power-up, lives/stumbles
4. Polish: particles, screen shake, touch-swipe controls, difficulty tuning
