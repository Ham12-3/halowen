# Midnight Line

A browser-based 3D Halloween runner, in the style of Subway Surfers. The player
is a hooded lantern bearer running along the roofs of Southeastern-style electric
trains on a brick railway viaduct, at night, across London: London Bridge → Waterloo →
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
- Rendering aims for a filmed night, not a game look: HDR buffer, bloom, AgX tone curve,
  FXAA, grade and grain (`game/postfx.ts`); a baked night environment map for reflections;
  height fog; procedural cloud sky
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
    RunFeedback.ts        per-step feedback: sounds, toasts, particles, camera shake, phone vibration
    effects.ts            particle recipes (soul sparkle, landing dust, hit sparks, ghost wisps, flare)
    ChaseCamera.ts        camera behind the runner; eases, FOV widens with pace, trauma-based shake
    Input.ts              keyboard + touch swipes; actions() = this frame's left/right/jump/slide presses
    Loop.ts, renderer.ts  rAF loop with clamped delta; WebGLRenderer setup (no shadow maps, no canvas AA)
    postfx.ts             RenderPipeline: HDR target -> quarter-res bloom -> FXAA + grade + AgX + grain;
                          adaptive render scale (drops after slow frames, recovers after fast ones)
    config.ts             ALL tuning: LANES, RUN, TRAIN, OBSTACLE, COURSE, ROUTE, SOUL, CAMERA, ATMOSPHERE
  world/
    course.ts             block-by-block course generator + queries (hasRoof, obstaclesNear, blocksNear)
    lanes.ts              laneX / nearestLane
    souls.ts              soul trails per block + gatherSouls (with the flare's magnet)
    hazards.ts            ghost + lantern placement and queries (ghostX, swoops, banish, touch, pickups)
    CourseView.ts         instanced carriages, gap pieces, gangways, cabs, stabled trains on the
                          sidings, pumpkin hurdles, signal boards, bridges
    SoulsView.ts          instanced soul wisps + halos, animated every frame
    GhostsView.ts         instanced ghosts (bodies, faces, halos); red eyes while swooping, fade when gone
    PickupsView.ts        floating lantern pickups
    Particles.ts          one pooled additive Points cloud for every spark effect (single draw call)
    World.ts              owns sky, lights, viaduct, course + souls views, skyline, river, landmarks, stations
    viaduct.ts            parapets, arches, lit street grid; carries track.ts; shifted in 2-block steps
    track.ts              five tracks (3 lanes + a siding each side): ballast, concrete sleepers,
                          flat-bottom rails with polished heads, third rail on insulators, cable troughs
    skyline.ts            recycled London buildings both sides, by row (buildingKinds.ts)
    buildingKinds.ts      building types (terrace, warehouse, mansion block, stone/glass office,
                          council block, towers), the rows, and each facade's look
    facades.ts            facade tiles painted on canvas: stock/red brick with sash windows and
                          shopfronts, Portland stone, glass curtain wall, post-war concrete
    facadeCanvas.ts       FacadePainter: colour + glass mask (in alpha) + glow layers, brickwork
    facadeMaterial.ts     facade shader: windows at true size from the instance scale, per-building
                          lit pattern, glossy reflective glass, cornice and roof bands
    rooftops.ts           slate gable roofs + chimney stacks, plant rooms, red aircraft lights
    river.ts              Thames water + embankment lamps at each crossing
    atmosphere.ts         FogExp2 + sky dome shader (city glow, clouds, moon, stars)
    heightFog.ts          replaces three's fog chunks: thin haze + ground mist thinning with height
    environment.ts        procedural night city baked once with PMREM -> scene.environment
    lighting.ts           moonlight + dim hemisphere fill (no shadows)
    rng.ts                seeded PRNG + value noise
    props/                sites.ts (landmark positions + landmarkClear), shard (eight leaning
                          glass shards, lit spire), landmarks (Eye, glow sprites), stPauls,
                          westminster (Big Ben, Parliament), towerBridge, station,
                          train (assembles carriage parts + materials), carriage (swept body
                          profile, underframe, bogies, gangway, cab), livery (canvas livery +
                          lit interiors), obstacles, pumpkins, glow texture,
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
  Lane 0 is left (x = -2.8), lane 1 the middle, lane 2 right (`laneX()`). Rail
  tops sit at y = 0 (sleepers and ballast below), carriage roofs at `TRAIN.roofHeight`
  (3.2), the street at y = -9. Sidings at x = ±5.6 are scenery only.
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
- **No pointer lock / mouse look:** keyboard or touch; the cursor hides while running.
  Touch: a swipe (28 px) is a one-frame 'SwipeLeft/Right/Up/Down' press; swipes on the
  canvas never scroll the page (`touch-action: none`). The HUD has a pause button.
  Screens show swipe hints instead of keys when `(pointer: coarse)` matches.
- **Juice** lives in `RunFeedback` + `effects.ts`: particles, `ChaseCamera.shake()` and
  `navigator.vibrate` (touch only). Shake is disabled under `prefers-reduced-motion`.
  Speed lines and the flare glow are CSS overlays driven from `Hud.update`.
- **Readability:** red tail lamps mark where a train ends or a gap opens (`CourseView`).
  Cabs face the runner where a train starts (headlights); trains end in a rear cab.
- **Lights are fixed** (hemisphere, moon, lantern): never add or remove lights at
  runtime. Glows (pumpkin faces, windows, signals, Eye pods) are unlit materials.
- **HDR and bloom:** only light above `RENDER.bloomThreshold` (linear) blooms, so lamps
  and lit windows use colours or emissive intensities above 1 (e.g. `new Color(...).multiplyScalar(3)`).
  Keep saturated reds below ~2: the AgX curve washes very bright red out to pink.
- **Facades** are unit boxes scaled per instance; the shader derives windows from the
  instance scale, so never bake a building's size into its geometry or UVs. Add a
  building type in `buildingKinds.ts`, a new facade in `facades.ts` + `createFacades()`.
- **Fog** is the custom chunk in `heightFog.ts` (imported by atmosphere.ts before any
  material compiles); tune it with `ATMOSPHERE.fogDensity`, `mistDensity`, `mistFalloff`.
  The sky dome's colour at the horizon equals `fogColor`, so distant city fades into it.
- **Sky dome** is drawn last at the far plane (`gl_Position.z = w`, renderOrder 1000) so
  only visible sky runs its cloud shader.
- **UI:** all styling goes through the CSS tokens in `style.css` (`--c-*`, `--space-*`,
  `--radius-*`, `--dur-*`). Buttons are real `<button>`s with `data-action`
  (`play`, `restart`, `sound`); screens focus their main button; animations
  respect `prefers-reduced-motion`. HUD bars/markers move with transforms only.
- **Performance target:** 60 fps on a mid-range laptop (Iris Xe class). Currently
  ~75 draw calls and ~160k triangles; ~8 ms GPU at 1136x860 on Iris Xe (sky ~0.7,
  bloom ~1.3, skyline ~1). Pixel ratio capped at 1.5; `RenderPipeline` lowers the scene
  resolution (down to `RENDER.minScale`) when frames run slow. Don't use MSAA render
  targets: with the bloom writing back into the scene buffer it cost ~10 ms here.
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
  `EXT_disjoint_timer_query_webgl2` around `game.pipeline.render(...)` calls spaced with
  `setTimeout` (not rAF, which stalls while the pane is hidden), then poll the results.
- To look at a spot from any angle: `game.paused = true`, `game.course.update(d)`, set
  `game.camera.camera` position + `lookAt`, then `game.world.update(0, 1, cam, d, game.course)`;
  the paused loop keeps rendering from that camera.
- The pane can't play audio: render effects offline with an `OfflineAudioContext` via
  `Sound.prototype.x.call({ play: (make) => make(ctx, out) })` and check peak/RMS.
- Bot runs save a best score in localStorage (`midnight-line-best-score`); clear it afterwards.
- Difficulty was tuned with a ghost-dodging bot over 8 runs: before (speeds 20/23/26,
  denser hazards) 3/8 finished at 0.48 lives lost per km; after (19/22/24, tail lamps,
  sparser lane ends, 70 m breather after stations) 6/8 finished at 0.29 per km, most
  losses in stages 2-3, ~5.8 min per full run. Re-measure whenever `ROUTE`, `COURSE`
  or `GHOST` change. A bot that
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
4. **Done:** particles, screen shake and haptics, speed lines and flare glow, touch swipes
   and a pause button, train tail lamps, bot-measured difficulty tuning; realism pass:
   render pipeline (bloom, AgX, grade, adaptive resolution), height fog, cloud sky, night
   environment reflections, London building types with true-scale facades and rooftops,
   Electrostar-style trains with cabs and gangways, five-track permanent way, the Shard
