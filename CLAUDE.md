# Midnight Line

A browser-based 3D Halloween runner, in the style of Subway Surfers. The player
is a hooded lantern bearer running along the roofs of London Underground trains
on a brick railway viaduct, at night, across London: London Bridge → Waterloo →
Westminster → Tower Hill (three stages, 6.6 km), past the Shard, St Paul's, the
London Eye, Big Ben and Parliament, and Tower Bridge, crossing the Thames twice.
Three lanes: switch lanes before your train runs out, jump gaps and piles of
jack-o'-lanterns, slide under signal boards and road bridges, dodge ghosts
(some swoop into the next lane, eyes burning red), and gather glowing soul wisps.
Floating lanterns light a lantern flare that banishes ghosts and pulls souls in.
Three lives: any hit or fall costs one (you blink, slow down, and are put back on a
roof); the last one ends the run. Each station passed is a checkpoint (+500);
reaching Tower Hill wins. Score = metres + 10 per soul + station bonuses + 50 per ghost banished.

The previous game in this repo, **Pumpkin Hollow** (a free-roaming graveyard
game), is preserved on the `phase-4-flare-shrines-sound` branch; its ghost model
(`src/entities/ghostModel.ts`) was brought back for the ghosts here.

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
    GameState.ts          distance, speed, souls, lives, flare, score, stations reached, status, best score
    route.ts              stations/stages helpers: stageAt, stageEnds, speedCapAt, nearStation, overRiver
    contacts.ts           per step: obstacle/ghost hits (skipped while blinking), souls, lantern pickups
    RunFeedback.ts        per-step sound + HUD feedback: clacks, soul chime, wails, hurt, flare, stations
    ChaseCamera.ts        camera behind the runner; eases sideways/up, locked along the track, FOV widens with pace
    Input.ts              keyboard only; actions() = this frame's left/right/jump/slide presses
    Loop.ts, renderer.ts  rAF loop with clamped delta; WebGLRenderer setup (no shadow maps)
    config.ts             ALL tuning: LANES, RUN, TRAIN, OBSTACLE, COURSE, ROUTE, SOUL, CAMERA, ATMOSPHERE
  world/
    course.ts             block-by-block course generator + queries (hasRoof, obstaclesNear, blocksNear)
    lanes.ts              laneX / nearestLane
    souls.ts              soul trails per block + gatherSouls (with the flare's magnet)
    hazards.ts            ghost + lantern placement and queries (ghostX, swoops, banish, touch, pickups)
    CourseView.ts         instanced carriages, gap pieces, pumpkin hurdles, signal boards, bridges
    SoulsView.ts          instanced soul wisps + halos, animated every frame
    GhostsView.ts         instanced ghosts (bodies, faces, halos); red eyes while swooping, fade when gone
    PickupsView.ts        floating lantern pickups
    World.ts              owns sky, lights, viaduct, course + souls views, skyline, river, landmarks, stations
    viaduct.ts            ballast/rails/parapets/arches/street, shifted in 2-block steps
    skyline.ts            recycled London buildings (terraces, offices, towers) both sides
    river.ts              Thames water + embankment lamps at each crossing
    atmosphere.ts         FogExp2, gradient sky dome, moon, stars
    lighting.ts           moonlight + hemisphere fill (no shadows)
    rng.ts                seeded PRNG + value noise
    props/                sites.ts (landmark positions + landmarkClear), landmarks (Shard, Eye),
                          stPauls, westminster (Big Ben, Parliament), towerBridge, station,
                          train, obstacles, pumpkins, glow texture,
                          geometry helpers (box, solid, paint, mergeParts, instance)
  entities/
    Runner.ts             lanes, jump, slam, slide, landing, falling, blink, recover, knock-out
    runnerPose.ts         lean / stride / lantern swing / blob shadow animation
    playerModel.ts        hooded figure + blob shadow; Lantern.ts the lantern and its light
    ghostModel.ts         bedsheet ghost geometry + translucent materials
  ui/
    Hud.ts                score, souls, time; current stage as an Underground line; speed, lives,
                          flare bar; toasts
    Screens.ts            title / pause / end overlays (picked each frame from status + paused)
    icons.ts              inline SVG icons (decorative, aria-hidden)
    FpsMeter.ts           dev frame-rate / draw-call meter (backquote toggles)
  audio/
    Sound.ts              whistle, clickety-clack, jump/land/slide/lane, soul chime, station chime,
                          crash, arrival; mute
    hazardSounds.ts       ghost wail, hurt, flare, banish recipes
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
  the first blocks and the track around every station are hazard-free; no road
  bridges over the river.
- **Route and stages:** `ROUTE.stations` (distance of each stop) defines the stages;
  `ROUTE.stageSpeeds` caps speed per stage; `ROUTE.rivers` are the Thames crossings.
  Use the helpers in `game/route.ts` rather than reading `ROUTE` directly. Every
  station after the first gets a shed (`createStation`), open at both ends so you
  run through; `GameState.advance()` returns the station reached that step.
- **Souls:** each block may carry one trail (`souls.ts`), shaped by its lane's
  obstacle. They are gathered when the runner's lane, feet-to-head span and
  distance overlap them (`course.collectSouls`). Gathered souls are flagged
  `taken`; `SoulsView` stops drawing them.
- **Lives:** obstacle hits, ghost touches and falls all cost a life via `Game.loseLife()`.
  With lives left you blink for `LIVES.invulnerability` (obstacles and ghosts pass
  through), slow to `LIVES.stumbleSpeed`, and after a fall `Runner.recover()` lifts you
  onto the nearest roofed lane. The last life calls `Runner.knockOut()` and ends the run.
- **Ghosts** (`hazards.ts`): at most one per block, placed in a clear roofed lane only
  once the next block exists, and only if another lane is roofed before, through and
  after it (always a lane to hold). Swoopers glide from `lane` to `toLane` based on the
  runner's distance (`ghostX`), starting `GHOST.swoopLead` m ahead. Too tall to jump,
  too low to slide: dodge them. A ghost that touches you disperses (`goneAt`).
- **Lantern flare:** a lantern pickup roughly every `FLARE.spacing` m; collecting one
  burns the flare for `FLARE.duration` s: ghosts within `FLARE.reach` ahead are
  banished (+50 each) and souls within `FLARE.magnet` m in any lane fly to you.
- **Landmarks** are placed from `props/sites.ts` (`at` along the line, `x` sideways,
  within ~75 m of the track so they come into view ahead). `landmarkClear()` keeps
  the skyline off landmarks, stations, Parliament's frontage and the river.
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
  ~50-60 draw calls and ~30-50k triangles. Pixel ratio capped at 1.5.
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
- Bot runs save a best score in localStorage (`midnight-line-best-score`); clear it afterwards.
- A bot gets the whole 6.6 km only some of the time; stage 3 (26 m/s) is hard on purpose.
  Re-check with the bot whenever `ROUTE.stageSpeeds` or `COURSE` change. A bot that
  treats a lane as blocked when a live ghost will be in it (`toLane`) dodges nearly all
  ghosts; most of its lost lives are falls from its own late lane changes.
- The user may be playing in the browser pane between your calls, and the game keeps
  running while the pane has focus. To stage a screenshot, set `game.paused = true`
  first, then hide `.screen`; afterwards restore `.screen` and call `game.restart()`.
- After each phase: run `npm run typecheck`, start the dev server, and check the browser console.

## Build phases

1. **Done:** core runner: viaduct, trains in 3 lanes, run/switch/jump/slide, obstacles + crash,
   chase camera, London skyline, the Shard, London Eye, Waterloo finish, HUD, screens, sound
2. **Done:** soul pickups and score; three stages London Bridge → Waterloo → Westminster →
   Tower Hill with checkpoint bonuses and rising speed caps; St Paul's, Big Ben and
   Parliament, Tower Bridge, two Thames crossings; HUD and screens for score and stages
3. **Done:** ghosts (hovering and swooping, with wails), three lives with stumbles and
   roof recovery, lantern pickups and the flare (banish ghosts, soul magnet), HUD lives
   and flare bar
4. Polish: particles, screen shake, touch-swipe controls, difficulty tuning
