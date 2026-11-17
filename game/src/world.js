// world.js: builds the static scene from map.js data: dusk sky dome, sun, fog, shadows,
// textured boxes, bombsite paint, lamps and props. Nothing here runs per frame.
import * as THREE from 'three';
import { BOXES, SITES } from './map.js';
import { rand, TAU } from './util.js';

const CELL_TEX = 2.4; // metres covered by one texture tile

// Scale UVs of a BoxGeometry so textures tile at a constant world size on every face.
function tileUVs(geo, w, h, d) {
  const uv = geo.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * faces[f][0]) / CELL_TEX, (uv.getY(i) * faces[f][1]) / CELL_TEX);
    }
  }
}

export function buildWorld(scene, T, renderer) {
  scene.background = new THREE.Color(0xf2b184);
  scene.fog = new THREE.Fog(0xf0b184, 38, 120);   // matches the sky's horizon band so the far wall melts into it

  // Lights: low warm sun, cool sky fill from above. The fill is kept low on purpose: the sun does
  // the modelling, so forms and faces read instead of flattening.
  scene.add(new THREE.HemisphereLight(0xa9b8ff, 0x8a6a58, 1.15));
  const sun = new THREE.DirectionalLight(0xffd0a0, 2.9);
  sun.position.set(-48, 26, 38);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 5; sc.far = 160;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(sun);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Sky dome (gradient painted in textures.js) and a sun disc low on the horizon.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(200, 24, 16),
    new THREE.MeshBasicMaterial({ map: T.sky, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(dome);
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.flash, fog: false, depthWrite: false, transparent: true }));
  disc.position.copy(sun.position).normalize().multiplyScalar(180);
  disc.scale.set(70, 70, 1);
  scene.add(disc);

  // Materials by key. MeshStandardMaterial so lights and shadows work.
  const std = (map, color = 0xffffff, rough = 0.9) => new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: 0.05 });
  const mats = {
    brick: std(T.brick), concrete: std(T.concrete), crateA: std(T.crateA), crateB: std(T.crateB),
    crateC: std(T.crateC), contRed: std(T.contRed, 0xffffff, 0.6), contTeal: std(T.contTeal, 0xffffff, 0.6),
    contBlue: std(T.contBlue, 0xffffff, 0.6),
  };

  for (const o of BOXES) {
    const w = o.x2 - o.x1, d = o.z2 - o.z1;
    const geo = new THREE.BoxGeometry(w, o.h, d);
    tileUVs(geo, w, o.h, d);
    const m = new THREE.Mesh(geo, mats[o.m]);
    m.position.set((o.x1 + o.x2) / 2, o.h / 2, (o.z1 + o.z2) / 2);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }

  // Ground, tiled concrete slabs; extends past the walls so the horizon is never bare.
  T.floor.repeat.set(60, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ map: T.floor, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Bombsite paint on the floor and stencilled letters on the back wall.
  for (const k of ['A', 'B']) {
    const s = SITES[k];
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(s.r * 1.7, s.r * 1.7),
      new THREE.MeshBasicMaterial({ map: T['plate' + k], transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(s.x, 0.02, s.z);
    scene.add(plate);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({ map: T['wall' + k], transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    wall.position.set(s.x, 3, -39.95);
    scene.add(wall);
  }

  // Ground wear: grime patches and scorch marks. One canvas texture, a handful of planes; without
  // them the floor reads as a clean tiled plane. Kept below the bomb-site plates (y 0.02).
  const wear = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = 64 + (rand() - 0.5) * 78, y = 64 + (rand() - 0.5) * 78, r = 10 + rand() * 30;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(28,22,16,0.5)');
      rg.addColorStop(1, 'rgba(28,22,16,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const wearMat = new THREE.MeshBasicMaterial({ map: wear, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const wearGeo = new THREE.PlaneGeometry(1, 1);
  const scorchMat = new THREE.MeshBasicMaterial({ map: T.puff, color: 0x120d0a, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  // [x, z, size, is scorch]
  const WEAR = [
    [-26, -16, 14, 0], [-30, -21, 9, 0], [-21, -12, 8, 0], [-26, -17, 5, 1],
    [26, -16, 14, 0], [30, -20, 9, 0], [22, -11, 8, 0], [26, -15, 5, 1],
    [-24, 6, 12, 0], [-24, 18, 10, 0], [24, 6, 12, 0], [24, 18, 10, 0],
    [0, 12, 11, 0], [0, -6, 10, 0], [-10, 24, 8, 0], [10, 26, 8, 0],
    [-4, 30, 7, 0], [5, 31, 7, 0], [-12, -28, 8, 0], [12, -28, 8, 0],
    [16, 4, 4, 1], [-14, 2, 4, 1],
  ];
  for (const [x, z, s, scorch] of WEAR) {
    const m = new THREE.Mesh(wearGeo, scorch ? scorchMat : wearMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rand() * TAU;
    m.scale.set(s, s * (0.7 + rand() * 0.5), 1);
    m.position.set(x, scorch ? 0.016 : 0.014, z);
    scene.add(m);
  }

  // Lamp posts: a pole, a lit head and a glow sprite. Cosmetic, placed along the outer walls.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.7 });
  const lamps = [[-38, -38], [38, -38], [-38, 38], [38, 38], [-38, 0], [38, 0], [0, -38], [0, 38], [-16, 36], [16, 36]];
  for (const [x, z] of lamps) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 6), poleMat);
    pole.position.set(x, 2.5, z);
    pole.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.6), lampMat);
    head.position.set(x, 5.1, z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(x, 5.1, z);
    halo.scale.set(4.5, 4.5, 1);
    scene.add(pole, head, halo);
  }

  // Barrels and pallets in the corners (decor only, never in a walking line).
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2f6f8a, roughness: 0.5, metalness: 0.4 });
  const palletMat = new THREE.MeshStandardMaterial({ map: T.crateA, roughness: 1 });
  const decor = [[-39, 38], [-38, 36.6], [39, 38], [38, 36.5], [-39, -38.4], [39, -38.4], [-39, 20], [39, 20]];
  decor.forEach(([x, z], i) => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), barrelMat);
    barrel.position.set(x, 0.55, z);
    barrel.castShadow = barrel.receiveShadow = true;
    scene.add(barrel);
    if (i % 2 === 0) {
      const pal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 1.2), palletMat);
      pal.position.set(x + (x > 0 ? -1.2 : 1.2), 0.09, z);
      pal.receiveShadow = true;
      scene.add(pal);
    }
  });

  return { sun, mats };
}
