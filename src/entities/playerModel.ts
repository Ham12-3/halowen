import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';

export interface PlayerModel {
  /** Everything that bobs while walking. */
  body: Group;
  /** Attach point for the lantern handle, in body space. */
  hand: Group;
}

/** A small hooded wanderer with glowing eyes, built from primitives. Faces -Z. */
export function createPlayerModel(): PlayerModel {
  const cloth = new MeshStandardMaterial({ color: 0x6a5488, roughness: 0.85 });
  const darkCloth = new MeshStandardMaterial({ color: 0x4e3d66, roughness: 0.85 });
  const body = new Group();

  const robe = new Mesh(new ConeGeometry(0.44, 1.3, 14), cloth);
  robe.position.y = 0.65;

  const hood = new Mesh(new SphereGeometry(0.27, 16, 12), darkCloth);
  hood.position.y = 1.34;
  hood.scale.set(1, 1.05, 1.08);

  const hoodTip = new Mesh(new ConeGeometry(0.16, 0.42, 10), darkCloth);
  hoodTip.position.set(0, 1.6, 0.1);
  hoodTip.rotation.x = 0.55;

  // A shadowed face opening with two glowing eyes.
  const face = new Mesh(new CircleGeometry(0.17, 16), new MeshBasicMaterial({ color: 0x050308 }));
  face.position.set(0, 1.31, -0.27);
  face.rotation.y = Math.PI;
  const eyeMaterial = new MeshBasicMaterial({ color: 0xffd27a });
  const eyes = [-0.065, 0.065].map((x) => {
    const eye = new Mesh(new SphereGeometry(0.028, 8, 6), eyeMaterial);
    eye.position.set(x, 1.33, -0.28);
    return eye;
  });

  const arm = new Mesh(new CylinderGeometry(0.06, 0.075, 0.5, 8), cloth);
  // Angled down and forward from the shoulder to the hand.
  arm.position.set(0.32, 1.03, -0.22);
  arm.rotation.x = 1.0;

  const hand = new Group();
  hand.position.set(0.36, 0.9, -0.42);

  for (const mesh of [robe, hood, hoodTip, arm]) mesh.castShadow = true;
  body.add(robe, hood, hoodTip, face, ...eyes, arm, hand);
  return { body, hand };
}
