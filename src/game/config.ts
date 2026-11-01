/** Central tuning values. Tweak here rather than hunting through entity code. */

export const WORLD = {
  /** The fenced graveyard spans -halfSize..halfSize on X and Z. */
  halfSize: 34,
  /** Seed for procedural placement, so the layout is identical every run. */
  seed: 1031,
} as const;

export const PLAYER = {
  radius: 0.4,
  walkSpeed: 4.2,
  /** How quickly velocity reaches the target speed (higher = snappier). */
  acceleration: 14,
  /** Seconds of blinking invulnerability after a ghost touches you. */
  hitInvulnerability: 2,
  /** Speed of the shove away from the ghost that touched you. */
  knockback: 9,
} as const;

export const ROUND = {
  candles: 10,
  lives: 3,
  /** Seconds until the church bell tolls midnight. */
  timeLimit: 180,
  /** The timer turns red and pulses below this many seconds. */
  warningTime: 30,
} as const;

export const CANDLE = {
  /** Reach beyond the player's radius for picking a candle up. */
  pickupRadius: 0.6,
  hoverHeight: 0.5,
  /** Candles try to keep at least this far apart (relaxed if the map is crowded). */
  minSpacing: 11,
  minSpawnDistance: 10,
  /** Point lights are lent to the nearest candles; this is their full brightness. */
  lightIntensity: 5,
  lightRange: 9,
} as const;

export const GHOST = {
  count: 6,
  radius: 0.5,
  hoverHeight: 0.35,
  wanderSpeed: 1.5,
  /** Slower than the player's walk so a chase can always be escaped. */
  chaseSpeed: 3.0,
  retreatSpeed: 4,
  /** Start chasing inside this distance... */
  detectRadius: 9,
  /** ...and give up beyond this one (the gap stops them flip-flopping). */
  loseRadius: 13,
  /** Seconds a ghost flees after touching the player. */
  retreatTime: 2.5,
  /** How quickly ghosts steer towards their desired velocity. */
  agility: 2.5,
  minSpawnDistance: 20,
  /** Ghosts closer than this push apart so they don't stack up. */
  separation: 1.8,
} as const;

export const CAMERA = {
  fov: 60,
  near: 0.1,
  far: 500,
  distance: 5.5,
  /** Height above the player's feet that the camera looks at. */
  targetHeight: 1.6,
  defaultPitch: 0.3,
  minPitch: -0.2,
  maxPitch: 1.1,
  mouseSensitivity: 0.0022,
  /** How tightly the camera follows the player (higher = less lag). */
  followSharpness: 12,
  minHeight: 0.4,
} as const;

export const ATMOSPHERE = {
  fogColor: 0x161c2c,
  fogDensity: 0.036,
  skyZenith: 0x03050b,
  /** Direction the moonlight comes from (normalised in lighting.ts). */
  moonLightDir: { x: -0.4, y: 0.62, z: -0.68 },
  /** The visible moon sits lower than the light so it shows up in frame. */
  moonDiscElevation: 0.26,
} as const;

export const RENDER = {
  maxPixelRatio: 1.5,
  shadowMapSize: 2048,
} as const;
