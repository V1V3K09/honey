// game-scene.ts — Three.js Scene, Camera, Lighting, Renderer & Interaction Controller
import * as THREE from 'three';
import { BrainGameLogic } from './game-logic';
import {
  BrainCellEntity,
  ShieldEntity,
  ThreatEntityMesh,
  CollectibleEntityMesh,
  SparkParticleSystem
} from './game-entities';
import { sfx } from '../audio-fx';

export class BrainGameScene {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  public logic: BrainGameLogic;
  private brainCell: BrainCellEntity;
  private shield: ShieldEntity;
  private particles: SparkParticleSystem;

  private threatMeshes: Map<number, ThreatEntityMesh> = new Map();
  private collectibleMeshes: Map<number, CollectibleEntityMesh> = new Map();

  private isVisible: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private isDestroyed: boolean = false;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private pointer: THREE.Vector2 = new THREE.Vector2();
  private planeZ0: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private intersectionPoint: THREE.Vector3 = new THREE.Vector3();

  // Target shield position for smooth interpolation
  private targetShieldX: number = 0;
  private targetShieldY: number = 1.6;

  private observer: IntersectionObserver | null = null;

  constructor(container: HTMLElement, logic: BrainGameLogic) {
    this.container = container;
    this.canvas = container.querySelector('.brain-game-canvas') as HTMLCanvasElement;
    this.logic = logic;

    // 1. Scene setup
    this.scene = new THREE.Scene();

    // 2. Camera setup
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 50);
    this.camera.position.set(0, 0, 7.5);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xFFFAF0, 0.95);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 1.25);
    dirLight.position.set(4, 5, 5);
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x00E599, 0.6);
    rimLight.position.set(-3, -3, 2);
    this.scene.add(rimLight);

    // 5. Arena Floor Boundary
    this.buildArenaBoundary();

    // 6. Entities
    this.brainCell = new BrainCellEntity();
    this.scene.add(this.brainCell.group);

    this.shield = new ShieldEntity();
    this.shield.setPosition(0, 1.6);
    this.scene.add(this.shield.group);

    this.particles = new SparkParticleSystem();
    this.scene.add(this.particles.group);

    // 7. Bindings
    this.bindEvents();
    this.setupObserver();
    this.resize();

    // 8. Initial render
    this.renderer.render(this.scene, this.camera);
  }

  private buildArenaBoundary() {
    // Stylized paper-cut arena floor ring
    const ringGeo = new THREE.RingGeometry(2.8, 2.88, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x121316,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = -0.05;
    this.scene.add(ring);

    // Subtle soft paper floor backdrop
    const floorGeo = new THREE.CircleGeometry(2.8, 36);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0xFAF7F0,
      transparent: true,
      opacity: 0.45
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.z = -0.06;
    this.scene.add(floor);
  }

  private setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible && !this.animFrameId && !this.isDestroyed) {
            this.lastTime = performance.now();
            this.loop(this.lastTime);
          }
        });
      },
      { threshold: 0.1 }
    );
    this.observer.observe(this.container);

    // Tab visibility handling
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.logic.getState() === 'playing') {
        this.logic.pause();
      }
    });
  }

  private bindEvents() {
    const updatePointerCoords = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      if (this.raycaster.ray.intersectPlane(this.planeZ0, this.intersectionPoint)) {
        const x = this.intersectionPoint.x;
        const y = this.intersectionPoint.y;
        const dist = Math.hypot(x, y);

        // Constrain shield radius around the brain cell (r between 1.0 and 2.4 units)
        const radius = Math.max(1.0, Math.min(2.4, dist));
        const angle = Math.atan2(y, x);

        this.targetShieldX = Math.cos(angle) * radius;
        this.targetShieldY = Math.sin(angle) * radius;
      }
    };

    // Mouse movement
    this.canvas.addEventListener('mousemove', (e) => {
      updatePointerCoords(e.clientX, e.clientY);
    });

    // Touch tap & drag (passive: false to prevent background scrolling during game interaction)
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 0) {
          e.preventDefault();
          updatePointerCoords(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length > 0) {
          e.preventDefault();
          updatePointerCoords(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    // Keyboard support: Arrow keys / WASD to steer shield
    window.addEventListener('keydown', (e) => {
      const isTarget =
        document.activeElement === this.container ||
        this.container.contains(document.activeElement) ||
        this.container.matches(':hover');

      if (!isTarget) return;

      if (e.key === 'Escape') {
        if (this.logic.getState() === 'playing') {
          this.logic.pause();
        } else if (this.logic.getState() === 'paused') {
          this.logic.resume();
        }
        return;
      }

      if (this.logic.getState() !== 'playing') return;

      let currentAngle = Math.atan2(this.targetShieldY, this.targetShieldX);
      const angleStep = 0.22;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        currentAngle += angleStep;
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        currentAngle -= angleStep;
        e.preventDefault();
      }

      const r = Math.hypot(this.targetShieldX, this.targetShieldY);
      this.targetShieldX = Math.cos(currentAngle) * r;
      this.targetShieldY = Math.sin(currentAngle) * r;
    });

    window.addEventListener('resize', () => this.resize());
  }

  public resize() {
    if (this.isDestroyed) return;
    const width = this.canvas.clientWidth || 400;
    const height = this.canvas.clientHeight || 320;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    this.renderer.render(this.scene, this.camera);
  }

  public onThreatBlocked(threatX: number, threatY: number) {
    this.shield.triggerBlockEffect();
    this.particles.emit(threatX, threatY, 0x00E599, 14);
    sfx.playHit();
  }

  public onDamageTaken(threatX: number, threatY: number) {
    this.brainCell.hit();
    this.particles.emit(threatX, threatY, 0xFF2E7E, 16);
    sfx.playHit(true);

    // Screen shake on game container
    this.container.classList.remove('game-shake');
    void this.container.offsetWidth;
    this.container.classList.add('game-shake');
  }

  public onCollectibleGrabbed(x: number, y: number, isGolden: boolean) {
    this.particles.emit(x, y, isGolden ? 0xFFE600 : 0xF59E0B, 18);
    sfx.playPop();
  }

  private loop = (now: number) => {
    if (this.isDestroyed) return;

    if (!this.isVisible && this.logic.getState() !== 'playing') {
      this.animFrameId = null;
      return;
    }

    const delta = Math.min(0.064, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const time = now / 1000;

    // 1. Smooth shield interpolation
    this.logic.shieldX += (this.targetShieldX - this.logic.shieldX) * 0.25;
    this.logic.shieldY += (this.targetShieldY - this.logic.shieldY) * 0.25;
    this.shield.setPosition(this.logic.shieldX, this.logic.shieldY);
    this.shield.update(time, delta);

    // 2. Update logic simulation
    this.logic.update(delta);

    // 3. Update Brain Cell Mascot
    this.brainCell.update(time, delta, this.logic.getState());

    // 4. Synchronize 3D Threat Meshes with Logic threats
    this.syncThreats(delta);

    // 5. Synchronize 3D Collectible Meshes with Logic collectibles
    this.syncCollectibles(time, delta);

    // 6. Update Particle System
    this.particles.update(delta);

    // 7. Render 3D Scene
    this.renderer.render(this.scene, this.camera);

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private syncThreats(delta: number) {
    const activeIds = new Set(this.logic.threats.map((t) => t.id));

    // Remove meshes for deleted threats
    for (const [id, meshObj] of this.threatMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(meshObj.mesh);
        meshObj.dispose();
        this.threatMeshes.delete(id);
      }
    }

    // Add or update active threat meshes
    for (const t of this.logic.threats) {
      let meshObj = this.threatMeshes.get(t.id);
      if (!meshObj) {
        meshObj = new ThreatEntityMesh(t.type);
        this.scene.add(meshObj.mesh);
        this.threatMeshes.set(t.id, meshObj);
      }
      meshObj.mesh.position.set(t.x, t.y, 0);
      meshObj.update(delta);
    }
  }

  private syncCollectibles(time: number, delta: number) {
    const activeIds = new Set(this.logic.collectibles.map((c) => c.id));

    // Remove meshes for collected/expired collectibles
    for (const [id, meshObj] of this.collectibleMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(meshObj.mesh);
        meshObj.dispose();
        this.collectibleMeshes.delete(id);
      }
    }

    // Add or update active collectible meshes
    for (const c of this.logic.collectibles) {
      let meshObj = this.collectibleMeshes.get(c.id);
      if (!meshObj) {
        meshObj = new CollectibleEntityMesh(c.type);
        this.scene.add(meshObj.mesh);
        this.collectibleMeshes.set(c.id, meshObj);
      }
      meshObj.mesh.position.set(c.x, c.y, 0);
      meshObj.update(time, delta);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.observer) {
      this.observer.disconnect();
    }

    this.brainCell.dispose();
    this.shield.dispose();
    this.particles.dispose();

    for (const m of this.threatMeshes.values()) {
      this.scene.remove(m.mesh);
      m.dispose();
    }
    this.threatMeshes.clear();

    for (const c of this.collectibleMeshes.values()) {
      this.scene.remove(c.mesh);
      c.dispose();
    }
    this.collectibleMeshes.clear();

    this.renderer.dispose();
  }
}
