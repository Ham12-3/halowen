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
