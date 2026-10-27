// game-entities.ts — 3D Procedural Models & Visual Entities for Three.js
import * as THREE from 'three';
import type { ThreatType, CollectibleType } from './game-logic';

export class BrainCellEntity {
  public group: THREE.Group;
  private leftHemisphere: THREE.Mesh;
  private rightHemisphere: THREE.Mesh;
  private leftEye: THREE.Mesh;
  private rightEye: THREE.Mesh;
  private leftPupil: THREE.Mesh;
  private rightPupil: THREE.Mesh;
  private brainMaterial: THREE.MeshStandardMaterial;

  private baseScale: number = 1.0;
  private squishTimer: number = 0;
  private hitFlashTimer: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // Soft glowing pink-magenta material
    this.brainMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF5FA2,
      emissive: 0x550E36,
      roughness: 0.35,
      metalness: 0.1
    });

    const hemiGeo = new THREE.SphereGeometry(0.36, 16, 14);
    hemiGeo.scale(0.85, 1.0, 1.15);

    // Left hemisphere
    this.leftHemisphere = new THREE.Mesh(hemiGeo, this.brainMaterial);
    this.leftHemisphere.position.set(-0.16, 0, 0);
    this.leftHemisphere.rotation.z = 0.08;
    this.group.add(this.leftHemisphere);

    // Right hemisphere
    this.rightHemisphere = new THREE.Mesh(hemiGeo, this.brainMaterial);
    this.rightHemisphere.position.set(0.16, 0, 0);
    this.rightHemisphere.rotation.z = -0.08;
    this.group.add(this.rightHemisphere);

    // Cerebellum / Folds detail
    const foldMat = new THREE.MeshStandardMaterial({
      color: 0xE0488A,
      roughness: 0.4
    });
    const foldGeo = new THREE.TorusGeometry(0.18, 0.05, 8, 16);
    const leftFold = new THREE.Mesh(foldGeo, foldMat);
    leftFold.position.set(-0.16, -0.05, 0.2);
    leftFold.rotation.x = Math.PI * 0.4;
    this.group.add(leftFold);

    const rightFold = new THREE.Mesh(foldGeo, foldMat);
    rightFold.position.set(0.16, -0.05, 0.2);
    rightFold.rotation.x = Math.PI * 0.4;
    this.group.add(rightFold);

    // Cute cartoon eyes
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.1
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x121316 });

    const eyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const pupilGeo = new THREE.SphereGeometry(0.038, 10, 10);

    this.leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    this.leftEye.position.set(-0.13, 0.06, 0.34);
    this.leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.leftPupil.position.set(-0.13, 0.06, 0.41);
    this.group.add(this.leftEye);
    this.group.add(this.leftPupil);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    this.rightEye.position.set(0.13, 0.06, 0.34);
    this.rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.rightPupil.position.set(0.13, 0.06, 0.41);
    this.group.add(this.rightEye);
    this.group.add(this.rightPupil);
  }

  public hit() {
    this.squishTimer = 0.35;
    this.hitFlashTimer = 0.25;
  }

  public update(time: number, delta: number, state: 'ready' | 'playing' | 'paused' | 'victory' | 'defeat') {
    if (state === 'victory') {
      // Joyous victory celebration!
      const bounce = Math.abs(Math.sin(time * 6)) * 0.35;
      this.group.position.y = bounce;
      this.group.rotation.y = time * 3;
      this.group.scale.set(1.15, 1.15, 1.15);
      this.brainMaterial.emissive.setHex(0xFF4081);
      return;
    }

    if (state === 'defeat') {
      // Defeated flatline
      this.group.position.y = -0.2;
      this.group.rotation.z = Math.PI * 0.45;
      this.group.scale.set(1.2, 0.5, 1.2);
      this.brainMaterial.color.setHex(0x757575);
      this.brainMaterial.emissive.setHex(0x212121);
      return;
    }

    // Normal floating bob & subtle heartbeat pulse
    const bob = Math.sin(time * 2.8) * 0.08;
    this.group.position.y = bob;

    const pulse = 1.0 + Math.sin(time * 4) * 0.04;
    this.group.scale.set(pulse, pulse, pulse);

    // Hit flash / squish decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      this.brainMaterial.emissive.setHex(0xFF0033);
    } else {
      this.brainMaterial.color.setHex(0xFF5FA2);
      this.brainMaterial.emissive.setHex(0x550E36);
    }

    if (this.squishTimer > 0) {
      this.squishTimer -= delta;
      this.group.scale.set(1.25, 0.75, 1.25);
    }
  }

  public dispose() {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

export class ShieldEntity {
  public group: THREE.Group;
  private arcMesh: THREE.Mesh;
  private energyMesh: THREE.Mesh;
  private coreLight: THREE.PointLight;
  private blockTimer: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // Curved shield outer rim (Arc of Torus)
    const arcGeo = new THREE.TorusGeometry(0.75, 0.055, 10, 32, Math.PI * 0.7);
    const arcMat = new THREE.MeshStandardMaterial({
      color: 0x00E599,
      emissive: 0x00E599,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8
    });
    this.arcMesh = new THREE.Mesh(arcGeo, arcMat);
    // Center the arc rotation
    this.arcMesh.rotation.z = -Math.PI * 0.35;
    this.group.add(this.arcMesh);

    // Inner glowing energy barrier
    const energyGeo = new THREE.RingGeometry(0.55, 0.75, 24, 1, 0, Math.PI * 0.7);
    const energyMat = new THREE.MeshBasicMaterial({
      color: 0x00E599,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.energyMesh = new THREE.Mesh(energyGeo, energyMat);
    this.energyMesh.rotation.z = -Math.PI * 0.35;
    this.group.add(this.energyMesh);

    // Little central aura light
    this.coreLight = new THREE.PointLight(0x00E599, 1.5, 2.5);
    this.group.add(this.coreLight);
  }

  public setPosition(x: number, y: number) {
    this.group.position.set(x, y, 0);

    // Automatically angle the shield to face outward from the central brain cell (0, 0)
    const angle = Math.atan2(y, x);
    this.group.rotation.z = angle - Math.PI * 0.5;
  }

  public triggerBlockEffect() {
    this.blockTimer = 0.22;
  }

  public update(time: number, delta: number) {
    // Subtle energetic pulse
    const pulse = 1.0 + Math.sin(time * 8) * 0.05;
    this.energyMesh.scale.set(pulse, pulse, pulse);

    if (this.blockTimer > 0) {
      this.blockTimer -= delta;
      (this.arcMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xFFFFFF);
      (this.energyMesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
      this.coreLight.intensity = 3.5;
    } else {
      (this.arcMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x00E599);
      (this.energyMesh.material as THREE.MeshBasicMaterial).opacity = 0.45;
      this.coreLight.intensity = 1.5;
    }
  }

  public dispose() {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

export class ThreatEntityMesh {
  public mesh: THREE.Group;
  public type: ThreatType;

  constructor(type: ThreatType) {
    this.type = type;
    this.mesh = new THREE.Group();
    this.buildGeometry();
  }

  private buildGeometry() {
    switch (this.type) {
      case 'alarm': {
        // Red Alarm Clock with Brass Bells
        const bodyGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16);
        bodyGeo.rotateX(Math.PI * 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFF2E7E, roughness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.add(body);

        // White Face
        const faceGeo = new THREE.CircleGeometry(0.18, 16);
        const faceMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.position.z = 0.065;
        this.mesh.add(face);

        // Little brass bells
        const bellMat = new THREE.MeshStandardMaterial({ color: 0xFFE600, metalness: 0.8, roughness: 0.2 });
        const bellGeo = new THREE.SphereGeometry(0.075, 8, 8);
        const leftBell = new THREE.Mesh(bellGeo, bellMat);
        leftBell.position.set(-0.16, 0.22, 0);
        const rightBell = new THREE.Mesh(bellGeo, bellMat);
        rightBell.position.set(0.16, 0.22, 0);
        this.mesh.add(leftBell);
        this.mesh.add(rightBell);
        break;
      }

      case 'exam': {
        // Navy blue textbook with paper edges & red bookmark
        const bookGeo = new THREE.BoxGeometry(0.42, 0.52, 0.1);
        const bookMat = new THREE.MeshStandardMaterial({ color: 0x1E3A8A, roughness: 0.4 });
        const book = new THREE.Mesh(bookGeo, bookMat);
        this.mesh.add(book);

        const edgeGeo = new THREE.BoxGeometry(0.38, 0.48, 0.09);
        const edgeMat = new THREE.MeshBasicMaterial({ color: 0xF3F4F6 });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(0.02, 0, 0);
        this.mesh.add(edge);

        const bookmarkGeo = new THREE.BoxGeometry(0.06, 0.18, 0.02);
        const bookmarkMat = new THREE.MeshBasicMaterial({ color: 0xFF2E7E });
        const bookmark = new THREE.Mesh(bookmarkGeo, bookmarkMat);
        bookmark.position.set(0.06, -0.24, 0.05);
        this.mesh.add(bookmark);
        break;
      }

      case 'responsibility': {
        // Adult Responsibility Heavy Crate
        const crateGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
        const crate = new THREE.Mesh(crateGeo, crateMat);
        this.mesh.add(crate);

        const barGeo = new THREE.BoxGeometry(0.4, 0.08, 0.4);
        const barMat = new THREE.MeshStandardMaterial({ color: 0xFF4B00 });
        const bar = new THREE.Mesh(barGeo, barMat);
        this.mesh.add(bar);
        break;
      }

      case 'deadline': {
        // Urgent Deadline Hexagonal Cylinder with Vermilion Warning
        const cylGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.28, 6);
        const cylMat = new THREE.MeshStandardMaterial({
          color: 0xFF4B00,
          emissive: 0x771100,
          roughness: 0.3
        });
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        this.mesh.add(cyl);
        break;
      }

      case 'commonsense': {
        // Common Sense Question Dodecahedron
        const polyGeo = new THREE.DodecahedronGeometry(0.25);
        const polyMat = new THREE.MeshStandardMaterial({
          color: 0x7038FF,
          emissive: 0x32007A,
          roughness: 0.2,
          metalness: 0.6
        });
        const poly = new THREE.Mesh(polyGeo, polyMat);
        this.mesh.add(poly);
        break;
      }
    }
  }

  public update(delta: number) {
    this.mesh.rotation.x += 1.8 * delta;
    this.mesh.rotation.y += 2.2 * delta;
  }

  public dispose() {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

export class CollectibleEntityMesh {
  public mesh: THREE.Group;
  public type: CollectibleType;

  constructor(type: CollectibleType) {
    this.type = type;
    this.mesh = new THREE.Group();
    this.buildGeometry();
  }

  private buildGeometry() {
    // Golden Crispy Samosa: 3-sided pyramid / tetrahedron
    const samosaGeo = new THREE.ConeGeometry(0.28, 0.36, 3);
    samosaGeo.rotateX(Math.PI * 0.15);

    const isGolden = this.type === 'golden-samosa';
    const samosaMat = new THREE.MeshStandardMaterial({
      color: isGolden ? 0xFFE600 : 0xF59E0B,
      emissive: isGolden ? 0xF59E0B : 0x78350F,
      roughness: 0.3,
      metalness: isGolden ? 0.6 : 0.2
    });

    const samosa = new THREE.Mesh(samosaGeo, samosaMat);
    this.mesh.add(samosa);

    // Shimmering aura light
    const auraLight = new THREE.PointLight(isGolden ? 0xFFE600 : 0xF59E0B, 1.2, 1.8);
    this.mesh.add(auraLight);
  }

  public update(time: number, delta: number) {
    this.mesh.rotation.y += 2.8 * delta;
    this.mesh.rotation.z = Math.sin(time * 3) * 0.2;
  }

  public dispose() {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}

export class SparkParticleSystem {
  public group: THREE.Group;
  private particles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
  private sparkGeo: THREE.SphereGeometry;
  private sparkMat: THREE.MeshBasicMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.sparkGeo = new THREE.SphereGeometry(0.045, 6, 6);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xFFE600 });
  }

  public emit(x: number, y: number, colorHex: number = 0xFFE600, count: number = 10) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(this.sparkGeo, mat);
      p.position.set(x, y, 0);
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1.2;
      this.particles.push({
        mesh: p,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: (Math.random() - 0.5) * 1.5,
        life: 0.45 + Math.random() * 0.2
      });
      this.group.add(p);
    }
  }

  public update(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      p.mesh.position.x += p.vx * delta;
      p.mesh.position.y += p.vy * delta;
      p.mesh.position.z += p.vz * delta;
      const scale = Math.max(0, p.life * 2);
      p.mesh.scale.set(scale, scale, scale);

      if (p.life <= 0) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  public dispose() {
    this.sparkGeo.dispose();
    this.sparkMat.dispose();
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    this.particles = [];
  }
}
