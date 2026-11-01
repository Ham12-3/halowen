# Pumpkin Hollow

A browser-based 3D Halloween game. The player carries a lantern through a foggy
churchyard at the heart of a medieval French old town (half-timbered houses, a
Gothic church, cobbled streets). Goal: collect 10 glowing soul candles before
the timer runs out while ghosts wander the graves. Ghost touch = lose a life
(3 lives). The lantern flare pushes ghosts back but drains fuel; pumpkin shrines
refill it.

## Tech stack

- Three.js (r187) + Vite 8 + TypeScript 7 in strict mode (`noUncheckedIndexedAccess` on)
- No game engine, no physics library, no external models or audio files
- Every asset is built from Three.js primitives; repeated props use `InstancedMesh`
- Collision is custom: circles and axis-aligned boxes on the XZ ground plane
- Sound uses the Web Audio API, synthesised in code

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
  style.css               screen / HUD styles
  game/                   loop, input, camera, round state, config
    Game.ts               wires everything; frame() renders, simulate() advances play
    GameState.ts          score, lives, countdown, round status (ready / playing / won / timeUp / dead)
    renderer.ts           WebGLRenderer setup (tone mapping, pixel ratio, shadows)
    Loop.ts               rAF loop with clamped delta
    Input.ts              keyboard state, pointer-locked mouse look, locked clicks as 'Mouse0'
    ThirdPersonCamera.ts  camera locked behind the player, pulls in before tall obstacles
    config.ts             ALL tuning constants (speeds, fog, camera, render limits)
  world/                  static environment
    World.ts              builds everything, owns colliders + camera blockers
    layout.ts             hand-placed landmarks (spawn, crypt, gate, shrines) and path network
    graveyard.ts          seeded procedural placement of graves, trees, pumpkins
    town.ts               house rows and side-street gaps around the churchyard
    atmosphere.ts         FogExp2, gradient sky dome, moon, stars
    lighting.ts           moonlight (shadow-casting) + hemisphere fill
    ground.ts / streets.ts  grass churchyard / cobbled streets (canvas texture)
    collision.ts          circle/box colliders, resolveCircle, overlapsAny
    rng.ts                seeded PRNG + value noise
    props/                geometry builders (tombstones, trees, fence, pumpkins, shrine
                          altars, crypt, houses, church, stained glass, glow texture)
  entities/
    Player.ts, playerModel.ts, Lantern.ts   (Player also owns hurt knockback + blink)
    Flare.ts              lantern oil, Space flare (cooldown, ring + burst), lantern power/flash
    Shrines.ts            pumpkin shrines' charge, glowing faces, halos, fake ground glow
    Candles.ts            the round's soul candles: spawn, bob, pickup, light pool
    candleModel.ts        candle/flame geometry and materials
    Ghosts.ts             the ghost pack: spawn, movement, touch detection, instanced drawing
    ghostBrain.ts         per-ghost state machine (wander / chase / retreat) + separation
    ghostModel.ts         bedsheet ghost body, face, translucent materials
  ui/
    Hud.ts                souls, pumpkin lives, countdown, oil gauge, hurt flash
    Screens.ts            title / pause / end-of-round overlays (picks one each frame)
    icons.ts              inline SVG icons shared by HUD and screens
    FpsMeter.ts           dev frame-rate / draw-call meter
  audio/
    Sound.ts              every sound effect + mute; unlocked by the first click/key
    synth.ts              Web Audio building blocks: tone, noiseBurst, bell, envelope
    ambience.ts           looping wind, low drone, occasional owl
```

## Conventions

- **Coordinates:** Y is up. North is -Z. The gate is on the south fence (+Z), the
  crypt and church are to the north. The churchyard spans `±WORLD.halfSize`.
- **Facing:** characters face -Z in local space; tombstones, houses and the church
  have their fronts on +Z. Camera yaw 0 looks down -Z; turning right decreases yaw.
- **Controls:** the camera yaw *is* the player's facing. A/D (or arrows) turn the
  player and camera together with eased turning (`CAMERA.turnSpeed`), the mouse
  turns them too, and W/S walk along the facing. There is no strafing.
- **Tuning** lives in `src/game/config.ts` (`ROUND` for candle count and time
  limit, `CANDLE` for pickup reach, spacing and glow, `GHOST`, `FLARE` for oil,
  cost and blast, `SHRINE` for reach and recharge), not in entity code.
- **Round flow:** `restart()` puts the round in `ready` (title screen). Capturing
  the mouse calls `beginRound()` (status `playing`, nearby ghosts scatter). All
  candles = `won`; timer hits 0 = `timeUp`; last life lost = `dead`. The end
  screen offers R or a click, which restarts and re-captures the mouse.
- **Pause:** only a round in progress pauses: releasing the mouse (Esc) shows the
  pause screen and freezes everything. The title and end screens keep simulating
  the world (no timer, no hunting) so it stays alive behind them. `frame()` always
  renders. `Screens.update()` picks the overlay from status + capture each frame.
- **Flare and shrines:** Space spends `FLARE.cost` oil (with a cooldown) to blast
  ghosts within `FLARE.radius` into retreat; the lantern also burns oil slowly and
  dims when low. Standing at a lit shrine refills the lantern only if it is missing
  at least `SHRINE.minRefill`; the shrine then goes dark for `rechargeTime`.
- **Sound** is all synthesised (`audio/`). The AudioContext is created on the first
  click or key press (browser autoplay rules); effects are no-ops before that or
  while muted (M, remembered in localStorage).
- **Ghosts** float through graves and trees (only the fence bounds them). They
  wander, chase inside `GHOST.detectRadius`, give up beyond `loseRadius`, and flee
  for `retreatTime` after any touch. A touch costs a life only when
  `player.canBeHurt` (2 s blinking grace after a hit). Chase speed stays below
  the player's walk speed so a chase can always be escaped.
- **Never hide or add lights mid-game** (e.g. the lantern during the hurt blink):
  only the figure's meshes blink, so the light count, and the shaders, stay stable.
  Glows that come and go (flare ring, shrine halos and ground pools) are additive
  sprites/meshes kept in the scene and faded via opacity or colour, never toggled.
- **Procedural layout** is seeded (`WORLD.seed`), so the map is identical every run.
- **Performance target:** 60 fps on a mid-range laptop. Use `InstancedMesh` (see
  `props/geometry.ts` `instance()` and `mergeParts()`) for anything repeated. Keep
  the number of lights fixed at runtime (adding/removing lights recompiles shaders).
  Pixel ratio is capped at 1.5. Only the moon casts shadows, and its shadow map is
  drawn **once** (`shadowMap.autoUpdate = false` in `game/renderer.ts`): never set
  `castShadow` on anything that moves; give it a blob shadow like the player's.
  Measured on an Intel Iris Xe at 1080p: ~12.4 ms/frame at 1x, ~16.6 ms at 1.5x.
- Keep files focused and under ~200 lines; split builders out when they grow.

## Testing notes

- Click the page to capture the mouse (pointer lock); Esc releases it.
- Backquote (`) toggles the FPS / draw-call / triangle meter (shown by default in dev only).
- In dev, `window.game` exposes the running game for console poking, e.g.
  `game.player.respawn(0, -10)`, `game.cameraRig.yaw = Math.PI`, `game.state.timeLeft = 5`,
  `game.ghosts.list[0]` (fields x, z, mode). `restart()` replaces the ghost and
  candle arrays, so re-read `game.ghosts.list` after restarting.
- The automated browser pane cannot capture the mouse, so the game stays paused
  there. Drive it by stepping manually, mirroring the real frame loop:
  `game.restart(); game.beginRound();` then
  `game.simulate(1 / 60, t); game.input.endFrame();` (skipping `endFrame` leaves
  "pressed this frame" keys set across steps). Press keys with
  `game.input.pressed.add('Space')` before a step.
- In the pane the pause screen covers the scene; for screenshots hide it with
  `document.querySelector('.screen').style.display = 'none'` (restore with `''`).
  Pane screenshots can show a stale frame: wait a second and take another.
- The pane's own fps is meaningless (the app throttles it, often to ~1 fps). To
  measure GPU cost use `EXT_disjoint_timer_query_webgl2` around a burst of ~8
  back-to-back `renderer.render` calls after a warm-up; spaced-out single frames
  let the laptop GPU downclock and read 2-3x too slow.
- To play many rounds quickly, drive the game with player-level inputs only
  (`input.down` keys, `cameraRig.yaw`, `input.pressed.add('Space')`) while stepping
  `simulate`; a BFS over `world.isOpen` cells makes a decent path-finding bot.
- The pane can't play audio. To check a sound, render it offline: import
  `/src/audio/Sound.ts`, call `Sound.prototype.flare.call({ play: (make) => make(ctx, out) })`
  with an `OfflineAudioContext`, and measure the rendered buffer's peak/RMS.
- After each phase: run `npm run typecheck`, start the dev server, and check the
  browser console for errors.

## Build phases

1. **Done:** scene, fog, lighting, churchyard + French old town, player movement, camera follow
2. **Done:** soul candles to collect, score, midnight timer, HUD, win/time-up banner, R to restart
3. **Done:** ghost AI (wander, chase when close, retreat after a touch), 3 lives, hurt feedback, game over
4. **Done:** lantern flare + oil, pumpkin shrines, title/pause/end screens, synthesised sound
5. Polish (particles, ghost glow, screen shake, difficulty tuning)
