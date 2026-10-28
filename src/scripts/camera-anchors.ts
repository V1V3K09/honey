import * as THREE from 'three';

export interface AnchorPoints {
  head: THREE.Vector3;
  torso: THREE.Vector3;
  knees: THREE.Vector3;
  feet: THREE.Vector3;
  bounds: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
}

export interface CameraWaypoint {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export function computeAnchorPoints(object: THREE.Object3D): AnchorPoints {
  const bounds = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  bounds.getCenter(center);
  bounds.getSize(size);

  const min = bounds.min;
  const height = size.y > 0 ? size.y : 2.0;

  // Search for optional named bones/nodes first
  let headPos: THREE.Vector3 | null = null;
  let torsoPos: THREE.Vector3 | null = null;
  let kneePos: THREE.Vector3 | null = null;
  let feetPos: THREE.Vector3 | null = null;

  object.traverse((child) => {
    const name = child.name.toLowerCase();
    if (!headPos && (name.includes('head') || name.includes('face') || name.includes('neck'))) {
      headPos = new THREE.Vector3();
      child.getWorldPosition(headPos);
    }
    if (!torsoPos && (name.includes('spine') || name.includes('chest') || name.includes('torso'))) {
      torsoPos = new THREE.Vector3();
      child.getWorldPosition(torsoPos);
    }
    if (!kneePos && (name.includes('knee') || name.includes('leg'))) {
      kneePos = new THREE.Vector3();
      child.getWorldPosition(kneePos);
    }
    if (!feetPos && (name.includes('foot') || name.includes('feet') || name.includes('shoe'))) {
      feetPos = new THREE.Vector3();
      child.getWorldPosition(feetPos);
    }
  });

  return {
    head: headPos || new THREE.Vector3(center.x, min.y + height * 0.88, center.z),
    torso: torsoPos || new THREE.Vector3(center.x, min.y + height * 0.62, center.z),
    knees: kneePos || new THREE.Vector3(center.x, min.y + height * 0.28, center.z),
    feet: feetPos || new THREE.Vector3(center.x, min.y + height * 0.08, center.z),
    bounds,
    center,
    size
  };
}

export function createCameraWaypoints(anchors: AnchorPoints, isMobile: boolean = false): CameraWaypoint[] {
  const { head, torso, knees, feet, size } = anchors;
  const h = size.y > 0 ? size.y : 2.0;

  // Responsive offsets: mobile requires slightly wider view or centered framing
  const heroXOffset = isMobile ? 0 : -0.42;
  const faceXOffset = isMobile ? 0 : -0.45;
  const kneeXOffset = isMobile ? 0 : 0.52;
  const distanceMultiplier = isMobile ? 1.35 : 1.0;

  return [
    // 0: Stage A — Full-Body Hero (Model on RIGHT, Annotations on LEFT)
    {
      position: new THREE.Vector3(
        anchors.center.x + heroXOffset,
        anchors.center.y + h * 0.08,
        anchors.center.z + h * 1.55 * distanceMultiplier
      ),
      target: new THREE.Vector3(anchors.center.x + (isMobile ? 0 : 0.1), anchors.center.y, anchors.center.z),
      fov: isMobile ? 48 : 42
    },

    // 1: Stage B — Approach Face
    {
      position: new THREE.Vector3(
        anchors.center.x + 0.15,
        head.y + h * 0.05,
        head.z + h * 0.85 * distanceMultiplier
      ),
      target: new THREE.Vector3(head.x, head.y, head.z),
      fov: isMobile ? 45 : 38
    },

    // 2: Stage C — KARKE.AI Acoustic Protocol (Model on LEFT, KARKE.AI on RIGHT)
    {
      position: new THREE.Vector3(
        head.x + faceXOffset,
        head.y + 0.03,
        head.z + h * 0.44 * distanceMultiplier
      ),
      target: new THREE.Vector3(head.x + (isMobile ? 0 : 0.08), head.y, head.z),
      fov: isMobile ? 44 : 36
    },

    // 3: Stage D — Face Composition & Birthday Card (Model on LEFT, Card on RIGHT)
    {
      position: new THREE.Vector3(
        head.x + faceXOffset,
        head.y + 0.02,
        head.z + h * 0.42 * distanceMultiplier
      ),
      target: new THREE.Vector3(head.x + (isMobile ? 0 : 0.08), head.y, head.z),
      fov: isMobile ? 44 : 36
    },

    // 4: Stage E — Knee Composition & 3D Mini-Game (Model on RIGHT, Mini-Game on LEFT on desktop)
    {
      position: new THREE.Vector3(
        knees.x + kneeXOffset,
        knees.y + 0.04,
        knees.z + h * 0.5 * distanceMultiplier
      ),
      target: new THREE.Vector3(knees.x - (isMobile ? 0 : 0.12), knees.y, knees.z),
      fov: isMobile ? 45 : 38
    },

    // 5: Stage F — Feet Center-Stage (The Footer Punchline)
    {
      position: new THREE.Vector3(
        feet.x,
        feet.y + 0.12,
        feet.z + h * 0.38 * distanceMultiplier
      ),
      target: new THREE.Vector3(feet.x, feet.y + 0.03, feet.z),
      fov: isMobile ? 48 : 40
    }
  ];
}
