import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { computeAnchorPoints, type AnchorPoints } from './camera-anchors';

export interface LoadedCharacter {
  group: THREE.Group;
  anchors: AnchorPoints;
  isPlaceholder: boolean;
  update: (time: number, delta: number) => void;
  mixer?: THREE.AnimationMixer;
}

/**
 * Creates the stylized procedural 3D Party Friend character
 */
function createProceduralFriend(): { group: THREE.Group; update: (time: number, delta: number) => void } {
  const root = new THREE.Group();
  root.name = 'ProceduralFriend';

  // Materials with tactile vinyl / paper-craft finish
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffd1a4,
    roughness: 0.55,
    metalness: 0.05
  });

  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xff4b00, // Vibrant Vermilion
    roughness: 0.6,
    metalness: 0.0
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x223a5e, // Denim Blue
    roughness: 0.7,
    metalness: 0.0
  });

  const kneePatchMat = new THREE.MeshStandardMaterial({
    color: 0xffe600, // Yellow knee patches
    roughness: 0.5,
    metalness: 0.0
  });

  const shoeBodyMat = new THREE.MeshStandardMaterial({
    color: 0xff2e7e, // Bubblegum pink sneaker
    roughness: 0.4
  });

  const shoeSoleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3
  });

  const hatMat = new THREE.MeshStandardMaterial({
    color: 0x7038ff, // Electric Violet
    roughness: 0.45
  });

  const pomPomMat = new THREE.MeshStandardMaterial({
    color: 0xffe600,
    roughness: 0.9
  });

  const darkInkMat = new THREE.MeshStandardMaterial({
    color: 0x121316,
    roughness: 0.2
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2
  });

  const goldMedalMat = new THREE.MeshStandardMaterial({
    color: 0xffb703,
    roughness: 0.3,
    metalness: 0.4
  });

  // --- FEET / SHOES (y: 0.0 to 0.2) ---
  const feetGroup = new THREE.Group();
  feetGroup.name = 'FeetGroup';

  const makeShoe = (isLeft: boolean) => {
    const shoe = new THREE.Group();
    shoe.name = isLeft ? 'LeftFoot' : 'RightFoot';
    const xPos = isLeft ? -0.22 : 0.22;

    // Sole
    const soleGeo = new THREE.BoxGeometry(0.22, 0.08, 0.42);
    const sole = new THREE.Mesh(soleGeo, shoeSoleMat);
    sole.position.set(0, 0.04, 0.04);
    sole.castShadow = true;
    sole.receiveShadow = true;
    shoe.add(sole);

    // Canvas Upper
    const upperGeo = new THREE.BoxGeometry(0.2, 0.16, 0.34);
    const upper = new THREE.Mesh(upperGeo, shoeBodyMat);
    upper.position.set(0, 0.12, 0.01);
    upper.castShadow = true;
    shoe.add(upper);

    // Rubber Toe Cap
    const toeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16);
    toeGeo.rotateZ(Math.PI / 2);
    const toe = new THREE.Mesh(toeGeo, shoeSoleMat);
    toe.position.set(0, 0.08, 0.18);
    shoe.add(toe);

    // Sneaker Star Emblem
    const starGeo = new THREE.CircleGeometry(0.04, 5);
    const star = new THREE.Mesh(starGeo, whiteMat);
    star.position.set(isLeft ? -0.105 : 0.105, 0.12, 0);
    star.rotation.y = isLeft ? -Math.PI / 2 : Math.PI / 2;
    shoe.add(star);

    shoe.position.set(xPos, 0, 0);
    return shoe;
  };

  const leftShoe = makeShoe(true);
  const rightShoe = makeShoe(false);
  feetGroup.add(leftShoe);
  feetGroup.add(rightShoe);
  root.add(feetGroup);

  // --- LEGS & KNEES (y: 0.2 to 0.85) ---
  const legsGroup = new THREE.Group();
  legsGroup.name = 'LegsGroup';

  const makeLeg = (isLeft: boolean) => {
    const leg = new THREE.Group();
    const xPos = isLeft ? -0.22 : 0.22;

    // Lower leg
    const lowerLegGeo = new THREE.CylinderGeometry(0.085, 0.08, 0.35, 16);
    const lowerLeg = new THREE.Mesh(lowerLegGeo, pantsMat);
    lowerLeg.position.set(0, 0.34, 0);
    lowerLeg.castShadow = true;
    leg.add(lowerLeg);

    // Knee joint & distinct Knee Patch
    const kneeJointGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const kneeJoint = new THREE.Mesh(kneeJointGeo, pantsMat);
    kneeJoint.position.set(0, 0.52, 0);
    leg.add(kneeJoint);

    const patchGeo = new THREE.BoxGeometry(0.12, 0.14, 0.06);
    const patch = new THREE.Mesh(patchGeo, kneePatchMat);
    patch.position.set(0, 0.52, 0.08);
    patch.name = isLeft ? 'LeftKnee' : 'RightKnee';
    leg.add(patch);

    // Upper leg / thigh
    const upperLegGeo = new THREE.CylinderGeometry(0.1, 0.088, 0.35, 16);
    const upperLeg = new THREE.Mesh(upperLegGeo, pantsMat);
    upperLeg.position.set(0, 0.7, 0);
    upperLeg.castShadow = true;
    leg.add(upperLeg);

    leg.position.set(xPos, 0, 0);
    return leg;
  };

  legsGroup.add(makeLeg(true));
  legsGroup.add(makeLeg(false));
  root.add(legsGroup);

  // --- PELVIS & TORSO (y: 0.85 to 1.45) ---
  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'TorsoGroup';

  // Hips
  const hipsGeo = new THREE.BoxGeometry(0.52, 0.2, 0.3);
  const hips = new THREE.Mesh(hipsGeo, pantsMat);
  hips.position.set(0, 0.95, 0);
  hips.castShadow = true;
  torsoGroup.add(hips);

  // Belt with funny buckle
  const beltGeo = new THREE.BoxGeometry(0.54, 0.06, 0.32);
  const belt = new THREE.Mesh(beltGeo, darkInkMat);
  belt.position.set(0, 1.04, 0);
  torsoGroup.add(belt);

  const buckleGeo = new THREE.BoxGeometry(0.12, 0.08, 0.34);
  const buckle = new THREE.Mesh(buckleGeo, goldMedalMat);
  buckle.position.set(0, 1.04, 0.01);
  torsoGroup.add(buckle);

  // Main Chest / Shirt
  const chestGeo = new THREE.BoxGeometry(0.56, 0.44, 0.32);
  const chest = new THREE.Mesh(chestGeo, shirtMat);
  chest.position.set(0, 1.28, 0);
  chest.castShadow = true;
  torsoGroup.add(chest);

  // Birthday Ribbon / Badge on chest
  const medalGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 24);
  medalGeo.rotateX(Math.PI / 2);
  const medal = new THREE.Mesh(medalGeo, goldMedalMat);
  medal.position.set(0.15, 1.34, 0.17);
  torsoGroup.add(medal);

  const starRibbonGeo = new THREE.CircleGeometry(0.05, 5);
  const ribbonStar = new THREE.Mesh(starRibbonGeo, whiteMat);
  ribbonStar.position.set(0.15, 1.34, 0.19);
  torsoGroup.add(ribbonStar);

  // Ribbons hanging from badge
  const ribGeo = new THREE.BoxGeometry(0.04, 0.1, 0.01);
  const rib1 = new THREE.Mesh(ribGeo, shoeBodyMat);
  rib1.position.set(0.13, 1.25, 0.17);
  rib1.rotation.z = 0.2;
  const rib2 = new THREE.Mesh(ribGeo, kneePatchMat);
  rib2.position.set(0.17, 1.25, 0.17);
  rib2.rotation.z = -0.2;
  torsoGroup.add(rib1);
  torsoGroup.add(rib2);

  root.add(torsoGroup);

  // --- ARMS & HANDS (y: 1.15 to 1.45) ---
  const makeArm = (isLeft: boolean) => {
    const arm = new THREE.Group();
    const xPos = isLeft ? -0.34 : 0.34;

    // Shoulder & Sleeve
    const sleeveGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const sleeve = new THREE.Mesh(sleeveGeo, shirtMat);
    sleeve.position.set(0, 1.4, 0);
    arm.add(sleeve);

    // Upper arm
    const upperGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.24, 16);
    const upper = new THREE.Mesh(upperGeo, skinMat);
    upper.position.set(0, 1.26, 0);
    arm.add(upper);

    // Forearm & Hand
    const foreGeo = new THREE.CylinderGeometry(0.065, 0.06, 0.22, 16);
    const fore = new THREE.Mesh(foreGeo, skinMat);
    fore.position.set(0, 1.05, isLeft ? 0.08 : -0.04);
    arm.add(fore);

    // Mitt / Hand
    const handGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(0, 0.92, isLeft ? 0.12 : -0.06);
    arm.add(hand);

    // Party wristband
    const bandGeo = new THREE.TorusGeometry(0.065, 0.02, 8, 24);
    const band = new THREE.Mesh(bandGeo, isLeft ? kneePatchMat : shoeBodyMat);
    band.position.set(0, 0.98, isLeft ? 0.1 : -0.05);
    band.rotation.x = Math.PI / 2;
    arm.add(band);

    arm.position.set(xPos, 0, 0);
    if (isLeft) {
      arm.rotation.z = 0.25;
      arm.rotation.x = 0.2;
    } else {
      arm.rotation.z = -0.15;
    }
    return arm;
  };

  const leftArm = makeArm(true);
  const rightArm = makeArm(false);
  root.add(leftArm);
  root.add(rightArm);

  // --- HEAD & FACE & PARTY HAT (y: 1.5 to 2.1) ---
  const headGroup = new THREE.Group();
  headGroup.name = 'HeadGroup';

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.14, 16);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.set(0, 1.54, 0);
  headGroup.add(neck);

  // Head sphere/capsule
  const headGeo = new THREE.SphereGeometry(0.24, 28, 28);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.76, 0);
  head.castShadow = true;
  headGroup.add(head);

  // Googly Eyes
  const eyeWhiteGeo = new THREE.SphereGeometry(0.065, 16, 16);
  const pupilGeo = new THREE.SphereGeometry(0.035, 16, 16);

  // Left Eye
  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, whiteMat);
  leftEyeWhite.position.set(-0.09, 1.80, 0.20);
  const leftPupil = new THREE.Mesh(pupilGeo, darkInkMat);
  leftPupil.position.set(-0.09, 1.80, 0.255);
  leftPupil.name = 'LeftPupil';
  headGroup.add(leftEyeWhite);
  headGroup.add(leftPupil);

  // Right Eye
  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, whiteMat);
  rightEyeWhite.position.set(0.09, 1.80, 0.20);
  const rightPupil = new THREE.Mesh(pupilGeo, darkInkMat);
  rightPupil.position.set(0.09, 1.80, 0.255);
  rightPupil.name = 'RightPupil';
  headGroup.add(rightEyeWhite);
  headGroup.add(rightPupil);

  // Playful Eyebrows
  const browGeo = new THREE.BoxGeometry(0.08, 0.025, 0.03);
  const leftBrow = new THREE.Mesh(browGeo, darkInkMat);
  leftBrow.position.set(-0.09, 1.88, 0.22);
  leftBrow.rotation.z = -0.15;
  const rightBrow = new THREE.Mesh(browGeo, darkInkMat);
  rightBrow.position.set(0.09, 1.88, 0.22);
  rightBrow.rotation.z = 0.25; // Asymmetric, curious expression!
  headGroup.add(leftBrow);
  headGroup.add(rightBrow);

  // Nose
  const noseGeo = new THREE.SphereGeometry(0.038, 16, 16);
  const nose = new THREE.Mesh(noseGeo, shirtMat); // Cute red/orange button nose
  nose.position.set(0, 1.74, 0.245);
  headGroup.add(nose);

  // Big Happy Grin
  const smileGeo = new THREE.TorusGeometry(0.08, 0.02, 10, 24, Math.PI);
  const smile = new THREE.Mesh(smileGeo, darkInkMat);
  smile.position.set(0, 1.67, 0.225);
  smile.rotation.x = Math.PI / 2;
  smile.rotation.z = Math.PI;
  headGroup.add(smile);

  // Funky Party Glasses / Shades
  const glassesFrameMat = new THREE.MeshStandardMaterial({
    color: 0x00e599, // Acid Mint
    roughness: 0.3
  });
  const glassesLensMat = new THREE.MeshStandardMaterial({
    color: 0x121316,
    roughness: 0.1,
    metalness: 0.7
  });

  const glassBridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.02), glassesFrameMat);
  glassBridge.position.set(0, 1.80, 0.26);
  headGroup.add(glassBridge);

  [-0.09, 0.09].forEach((x) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.015, 8, 24), glassesFrameMat);
    rim.position.set(x, 1.80, 0.26);
    headGroup.add(rim);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.065, 24), glassesLensMat);
    lens.position.set(x, 1.80, 0.261);
    headGroup.add(lens);
  });

  // Iconic Party Cone Hat
  const hatConeGeo = new THREE.ConeGeometry(0.18, 0.42, 24);
  const hatCone = new THREE.Mesh(hatConeGeo, hatMat);
  hatCone.position.set(0, 2.12, 0.02);
  hatCone.rotation.z = 0.12; // tilted jauntily
  headGroup.add(hatCone);

  // Hat Stripes (yellow spiral accents)
  const stripeGeo = new THREE.TorusGeometry(0.14, 0.015, 8, 24);
  const stripe = new THREE.Mesh(stripeGeo, kneePatchMat);
  stripe.position.set(0, 2.0, 0.02);
  stripe.rotation.x = Math.PI / 2;
  stripe.rotation.y = 0.12;
  headGroup.add(stripe);

  // Fluffy Pom-Pom at tip of hat
  const pomPomGeo = new THREE.DodecahedronGeometry(0.06, 1);
  const pomPom = new THREE.Mesh(pomPomGeo, pomPomMat);
  pomPom.position.set(0.05, 2.34, 0.03);
  pomPom.name = 'HatPomPom';
  headGroup.add(pomPom);

  root.add(headGroup);

  // Position root so ground is at y = 0
  root.position.set(0, 0, 0);

  // Idle animation callback
  const update = (time: number, delta: number) => {
    // Gentle breathing
    const breath = Math.sin(time * 2.2) * 0.025;
    chest.scale.set(1 + breath, 1 + breath * 0.6, 1 + breath);

    // Subtle head tilt & sway
    headGroup.rotation.y = Math.sin(time * 1.4) * 0.06;
    headGroup.rotation.z = Math.cos(time * 1.8) * 0.03;

    // Pom-pom bounce
    pomPom.position.y = 2.34 + Math.sin(time * 3.5) * 0.018;

    // Friendly arm wave
    leftArm.rotation.z = 0.22 + Math.sin(time * 2.5) * 0.08;
    rightArm.rotation.z = -0.15 + Math.cos(time * 1.9) * 0.04;
  };

  return { group: root, update };
}

/**
 * Loads the external model if available or falls back to procedural character
 */
export async function loadCharacterModel(): Promise<LoadedCharacter> {
  const modelUrl = '/models/friend-model.glb';

  let hasExternalModel = false;
  try {
    const res = await fetch(modelUrl, { method: 'HEAD' });
    if (res.ok) {
      hasExternalModel = true;
    }
  } catch {
    hasExternalModel = false;
  }

  if (hasExternalModel) {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(modelUrl);
      const group = gltf.scene;

      // Enable shadows on all child meshes
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Normalize size: if the model is huge or tiny, scale it to ~2.0 units height
      const rawBounds = new THREE.Box3().setFromObject(group);
      const rawSize = new THREE.Vector3();
      rawBounds.getSize(rawSize);

      if (rawSize.y > 0) {
        const targetHeight = 2.0;
        const scale = targetHeight / rawSize.y;
        group.scale.setScalar(scale);

        // Center on X and Z, set bottom to Y = 0
        const scaledBounds = new THREE.Box3().setFromObject(group);
        const center = new THREE.Vector3();
        scaledBounds.getCenter(center);
        group.position.x -= center.x;
        group.position.z -= center.z;
        group.position.y -= scaledBounds.min.y;
      }

      const anchors = computeAnchorPoints(group);

      let mixer: THREE.AnimationMixer | undefined;
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(group);
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
      }

      return {
        group,
        anchors,
        isPlaceholder: false,
        mixer,
        update: (_time: number, delta: number) => {
          if (mixer) mixer.update(delta);
        }
      };
    } catch (err) {
      console.warn('Failed to load external GLB model. Falling back to procedural character:', err);
    }
  }

  // Fallback procedural character
  const { group, update } = createProceduralFriend();
  const anchors = computeAnchorPoints(group);

  return {
    group,
    anchors,
    isPlaceholder: true,
    update
  };
}
