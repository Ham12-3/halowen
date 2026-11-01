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
- Sound (Phase 4) uses the Web Audio API, synthesised in code

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
  style.css               overlay / HUD styles
  game/                   loop, input, camera, round state, config
    Game.ts               owns renderer + scene; frame() renders, simulate() advances play
    GameState.ts          score, lives, countdown, round status (playing / won / timeUp / dead)
    Loop.ts               rAF loop with clamped delta
    Input.ts              keyboard state + pointer-locked mouse look
    ThirdPersonCamera.ts  camera locked behind the player, pulls in before tall obstacles
    config.ts             ALL tuning constants (speeds, fog, camera, render limits)
  world/                  static environment
    World.ts              builds everything, owns colliders + camera blockers
    layout.ts             hand-placed landmarks (spawn, crypt, gate) and path network
    graveyard.ts          seeded procedural placement of graves, trees, pumpkins
    town.ts               house rows and side-street gaps around the churchyard
    atmosphere.ts         FogExp2, gradient sky dome, moon, stars
    lighting.ts           moonlight (shadow-casting) + hemisphere fill
    ground.ts / streets.ts  grass churchyard / cobbled streets (canvas texture)
    collision.ts          circle/box colliders, resolveCircle, overlapsAny
    rng.ts                seeded PRNG + value noise
    props/                geometry builders (tombstones, trees, fence, pumpkins,
                          crypt, houses, church, stained glass, glow texture)
  entities/
    Player.ts, playerModel.ts, Lantern.ts   (Player also owns hurt knockback + blink)
    Candles.ts            the round's soul candles: spawn, bob, pickup, light pool
    candleModel.ts        candle/flame geometry and materials
    Ghosts.ts             the ghost pack: spawn, movement, touch detection, instanced drawing
    ghostBrain.ts         per-ghost state machine (wander / chase / retreat) + separation
    ghostModel.ts         bedsheet ghost body, face, translucent materials
  ui/
    Hud.ts                souls, pumpkin lives, countdown, hurt flash, end-of-round banner
    LockPrompt.ts         click-to-play overlay (shown while paused)
    FpsMeter.ts           dev frame-rate / draw-call meter
```

## Conventions

- **Coordinates:** Y is up. North is -Z. The gate is on the south fence (+Z), the
  crypt and church are to the north. The churchyard spans `±WORLD.halfSize`.
- **Facing:** characters face -Z in local space; tombstones, houses and the church
  have their fronts on +Z. Camera yaw 0 looks down -Z; turning right decreases yaw.
- **Tuning** lives in `src/game/config.ts` (`ROUND` for candle count and time
  limit, `CANDLE` for pickup reach, spacing and glow), not in entity code.
- **Pause:** the game only simulates while the mouse is captured; releasing it
  (Esc) shows the overlay and freezes the timer. `frame()` always renders.
- **Round flow:** collect all candles = `won`; timer hits 0 = `timeUp`; last life
  lost = `dead`. Each shows the HUD banner; R restarts with fresh candles and ghosts.
- **Ghosts** float through graves and trees (only the fence bounds them). They
  wander, chase inside `GHOST.detectRadius`, give up beyond `loseRadius`, and flee
  for `retreatTime` after any touch. A touch costs a life only when
  `player.canBeHurt` (2 s blinking grace after a hit). Chase speed stays below
  the player's walk speed so a chase can always be escaped.
- **Never hide or add lights mid-game** (e.g. the lantern during the hurt blink):
  only the figure's meshes blink, so the light count, and the shaders, stay stable.
- **Procedural layout** is seeded (`WORLD.seed`), so the map is identical every run.
- **Performance target:** 60 fps on a mid-range laptop. Use `InstancedMesh` (see
  `props/geometry.ts` `instance()` and `mergeParts()`) for anything repeated. Keep
  the number of lights fixed at runtime (adding/removing lights recompiles shaders).
  Pixel ratio is capped at 1.5. Only the moon casts shadows.
- Keep files focused and under ~200 lines; split builders out when they grow.

## Testing notes

- Click the page to capture the mouse (pointer lock); Esc releases it.
- Backquote (`) toggles the FPS / draw-call / triangle meter.
- In dev, `window.game` exposes the running game for console poking, e.g.
  `game.player.respawn(0, -10)`, `game.cameraRig.yaw = Math.PI`, `game.state.timeLeft = 5`,
  `game.ghosts.list[0]` (fields x, z, mode). `restart()` replaces the ghost and
  candle arrays, so re-read `game.ghosts.list` after restarting.
- The automated browser pane cannot capture the mouse, so the game stays paused
  there. Drive it by stepping manually, mirroring the real frame loop:
  `game.simulate(1 / 60, t); game.input.endFrame();` (skipping `endFrame` leaves
  "pressed this frame" keys set across steps).
- After each phase: run `npm run typecheck`, start the dev server, and check the
  browser console for errors.

## Build phases

1. **Done:** scene, fog, lighting, churchyard + French old town, player movement, camera follow
2. **Done:** soul candles to collect, score, midnight timer, HUD, win/time-up banner, R to restart
3. **Done:** ghost AI (wander, chase when close, retreat after a touch), 3 lives, hurt feedback, game over
4. Lantern flare and shrines, start/pause/win screens, sound
5. Polish (particles, ghost glow, screen shake, difficulty tuning)
