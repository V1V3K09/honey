import * as THREE from 'three';
import { loadCharacterModel, type LoadedCharacter } from './model-loader';
import { ScrollTimelineController } from './scroll-timeline';

export class BirthdayMainScene {
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private character: LoadedCharacter | null = null;
  private timelineController: ScrollTimelineController | null = null;
  private clock = new THREE.Clock();
  private isDestroyed = false;
  private isTabVisible = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 1.2, 3.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.setupLighting();
    this.setupFloorShadow();
    this.bindEvents();
  }

  private setupLighting() {
    // Warm ambient illumination simulating gallery daylight
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 1.3);
    this.scene.add(ambientLight);

    // Primary Key Light with soft shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.bias = -0.0005;
    const d = 2.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    this.scene.add(keyLight);

    // Warm Fill Light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffe6c2, 0.9);
    fillLight.position.set(-3, 2, 2);
    this.scene.add(fillLight);

    // Vivid Rim Lights for paper-cut silhouette separation
    const rimMint = new THREE.PointLight(0x00e599, 1.8, 8);
    rimMint.position.set(-2, 2, -2);
    this.scene.add(rimMint);

    const rimPink = new THREE.PointLight(0xff2e7e, 1.6, 8);
    rimPink.position.set(2.2, 1.2, -1.8);
    this.scene.add(rimPink);
  }

  private setupFloorShadow() {
    // Subtle ground shadow catcher plane
    const shadowPlaneGeo = new THREE.PlaneGeometry(6, 6);
    const shadowPlaneMat = new THREE.ShadowMaterial({
      opacity: 0.14
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);
  }

  public async init(): Promise<{ isPlaceholder: boolean }> {
    // Load model
    this.character = await loadCharacterModel();
    this.scene.add(this.character.group);

    // Init scroll timeline with computed anchors
    this.timelineController = new ScrollTimelineController(this.camera, this.character.anchors);

    // Start render loop
    this.renderLoop();

    return { isPlaceholder: this.character.isPlaceholder };
  }

  private renderLoop = () => {
    if (this.isDestroyed) return;

    requestAnimationFrame(this.renderLoop);

    if (!this.isTabVisible) return;

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    if (this.character) {
      this.character.update(elapsedTime, delta);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', () => {
      this.isTabVisible = !document.hidden;
      if (this.isTabVisible) {
        this.clock.getDelta(); // reset delta jump
      }
    });
  }

  private onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (this.timelineController) {
      this.timelineController.resize();
    }
  };

  public destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onResize);
    if (this.timelineController) {
      this.timelineController.destroy();
    }
    this.renderer.dispose();
  }
}
