import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { sfx } from './audio-fx';

export class BirthdayCakeGame {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cakeGroup: THREE.Group;
  private candleFlame: THREE.Mesh;
  private candleLight: THREE.PointLight;
  private isDefeated = false;
  private health = 100;
  private maxHealth = 100;
  private combo = 0;
  private isVisible = false;
  private animFrameId: number | null = null;

  // Visual squash-and-stretch target
  private scaleTarget = new THREE.Vector3(1, 1, 1);
  private currentScale = new THREE.Vector3(1, 1, 1);

  // Taunts pool
  private taunts = [
    'IS THAT ALL YOU\'VE GOT, BIRTHDAY BOY?!',
    'MY FROSTING HAS MORE STAMINA THAN YOUR LOWER BACK!',
    'CALORIES DON\'T COUNT TODAY, PAL!',
    'STOP BASHING ME AND MAKE A WISH!',
    'YOUR REFLEXES ARE AGING ACCORDING TO SCHEDULE!',
    'I AM 3,000 KCAL OF PURE UNSTOPPABLE DELICIOUSNESS!',
    'ANOTHER YEAR OLDER, BUT CAN YOU DEFEAT PASTRY?!'
  ];

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = container.querySelector('.game-canvas') as HTMLCanvasElement;

    // Setup 3D mini scene
    this.scene = new THREE.Scene();
    const width = this.canvas.clientWidth || 360;
    const height = this.canvas.clientHeight || 300;

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    this.camera.position.set(0, 1.2, 2.8);
    this.camera.lookAt(0, 0.45, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xfff5eb, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    const rimLight = new THREE.PointLight(0xff2e7e, 1.5, 6);
    rimLight.position.set(-2, 1, -1);
    this.scene.add(rimLight);

    // Build the Cake Boss
    this.cakeGroup = new THREE.Group();
    this.scene.add(this.cakeGroup);

    const { flame, candleLight } = this.buildCake();
    this.candleFlame = flame;
    this.candleLight = candleLight;

    // Attach listeners
    this.bindEvents();
    this.setupIntersectionObserver();
  }

  private buildCake(): { flame: THREE.Mesh; candleLight: THREE.PointLight } {
    // Cake Materials
    const spongeMat = new THREE.MeshStandardMaterial({
      color: 0xf5deb3, // Golden sponge
      roughness: 0.6
    });

    const frostingPinkMat = new THREE.MeshStandardMaterial({
      color: 0xff2e7e, // Bubblegum pink icing
      roughness: 0.35
    });

    const frostingWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Whipped cream
      roughness: 0.25
    });

    const chocolateMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e18,
      roughness: 0.4
    });

    // Plate / Stand
    const plateGeo = new THREE.CylinderGeometry(1.05, 0.95, 0.08, 32);
    const plate = new THREE.Mesh(plateGeo, frostingWhiteMat);
    plate.position.y = 0.04;
    this.cakeGroup.add(plate);

    // Bottom Tier
    const tier1Geo = new THREE.CylinderGeometry(0.85, 0.85, 0.44, 32);
    const tier1 = new THREE.Mesh(tier1Geo, spongeMat);
    tier1.position.y = 0.3;
    this.cakeGroup.add(tier1);

    // Frosting Drips / Border Tier 1
    const frosting1Geo = new THREE.TorusGeometry(0.84, 0.065, 12, 32);
    const frosting1 = new THREE.Mesh(frosting1Geo, frostingPinkMat);
    frosting1.position.y = 0.52;
    frosting1.rotation.x = Math.PI / 2;
    this.cakeGroup.add(frosting1);

    // Top Tier
    const tier2Geo = new THREE.CylinderGeometry(0.55, 0.55, 0.36, 28);
    const tier2 = new THREE.Mesh(tier2Geo, chocolateMat);
    tier2.position.y = 0.7;
    this.cakeGroup.add(tier2);

    // Top Frosting Dollops
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dollopGeo = new THREE.SphereGeometry(0.08, 12, 12);
      const dollop = new THREE.Mesh(dollopGeo, frostingWhiteMat);
      dollop.position.set(Math.cos(angle) * 0.48, 0.88, Math.sin(angle) * 0.48);
      this.cakeGroup.add(dollop);
    }

    // Googly Eyes on the Cake (Boss Face!)
    const eyeWhiteGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const pupilGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x121316 });

    [-0.18, 0.18].forEach((x) => {
      const eyeWhite = new THREE.Mesh(eyeWhiteGeo, frostingWhiteMat);
      eyeWhite.position.set(x, 0.34, 0.84);
      this.cakeGroup.add(eyeWhite);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(x, 0.34, 0.92);
      this.cakeGroup.add(pupil);
    });

    // Grumpy / Menacing Boss Eyebrows
    const browMat = new THREE.MeshBasicMaterial({ color: 0x121316 });
    const browGeo = new THREE.BoxGeometry(0.12, 0.03, 0.03);
    const leftBrow = new THREE.Mesh(browGeo, browMat);
    leftBrow.position.set(-0.18, 0.44, 0.84);
    leftBrow.rotation.z = -0.3;
    const rightBrow = new THREE.Mesh(browGeo, browMat);
    rightBrow.position.set(0.18, 0.44, 0.84);
    rightBrow.rotation.z = 0.3;
    this.cakeGroup.add(leftBrow);
    this.cakeGroup.add(rightBrow);

    // Birthday Candle
    const candleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.35, 16);
    const candleMat = new THREE.MeshStandardMaterial({
      color: 0xffe600,
      roughness: 0.3
    });
    const candle = new THREE.Mesh(candleGeo, candleMat);
    candle.position.set(0, 1.05, 0);
    this.cakeGroup.add(candle);

    // Candle Flame
    const flameGeo = new THREE.ConeGeometry(0.05, 0.16, 16);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(0, 1.3, 0);
    this.cakeGroup.add(flame);

    const candleLight = new THREE.PointLight(0xffa200, 2, 4);
    candleLight.position.set(0, 1.32, 0);
    this.scene.add(candleLight);

    return { flame, candleLight };
  }

  private setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible && !this.animFrameId) {
            this.loop();
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(this.container);
  }

  private loop = () => {
    if (!this.isVisible) {
      this.animFrameId = null;
      return;
    }

    const time = performance.now() * 0.003;

    // Gentle boss idle hover & rotation
    if (!this.isDefeated) {
      this.cakeGroup.rotation.y = Math.sin(time * 0.8) * 0.25;
      this.cakeGroup.position.y = Math.sin(time * 1.5) * 0.04;

      // Candle flame flicker
      const flameScale = 1 + Math.sin(time * 12) * 0.15;
      this.candleFlame.scale.set(flameScale, flameScale * 1.1, flameScale);
      this.candleLight.intensity = 1.8 + Math.sin(time * 10) * 0.6;
    }

    // Spring back from squash-and-stretch
    this.currentScale.lerp(this.scaleTarget, 0.14);
    this.cakeGroup.scale.copy(this.currentScale);

    this.renderer.render(this.scene, this.camera);
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private bindEvents() {
    // Click or tap to attack
    this.canvas.addEventListener('click', (e) => {
      e.stopPropagation();
      this.attack(e.clientX, e.clientY);
    });

    // Spacebar to attack when focused
    this.container.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        const rect = this.canvas.getBoundingClientRect();
        this.attack(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    });

    // Reset button
    const restartBtn = this.container.querySelector('.game-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.reset();
      });
    }

    // Resize handler
    window.addEventListener('resize', () => {
      const width = this.canvas.clientWidth || 360;
      const height = this.canvas.clientHeight || 300;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    });
  }

  public attack(clientX: number, clientY: number) {
    if (this.isDefeated) return;

    this.combo++;
    const isCritical = this.combo % 3 === 0;
    const damage = isCritical ? Math.floor(Math.random() * 10) + 20 : Math.floor(Math.random() * 6) + 12;

    this.health = Math.max(0, this.health - damage);
    sfx.playHit(isCritical);

    // Apply 3D Squash & Stretch
    this.currentScale.set(1.22, 0.78, 1.22);

    // Trigger visual screen shake on container
    this.container.classList.remove('game-shake');
    void this.container.offsetWidth; // force reflow
    this.container.classList.add('game-shake');

    // Spawn floating damage text
    this.spawnDamageNumber(damage, isCritical, clientX, clientY);

    // Update Taunt text
    this.updateTaunt();

    // Update Health Bar UI
    this.updateHealthBar();

    if (this.health <= 0) {
      this.triggerVictory();
    }
  }

  private updateHealthBar() {
    const bar = this.container.querySelector('.game-health-fill') as HTMLElement;
    const text = this.container.querySelector('.game-health-text') as HTMLElement;
    const percent = (this.health / this.maxHealth) * 100;

    if (bar) {
      bar.style.width = `${percent}%`;
      if (percent < 30) {
        bar.style.backgroundColor = '#ff2e7e';
      } else if (percent < 60) {
        bar.style.backgroundColor = '#ffe600';
      } else {
        bar.style.backgroundColor = '#00e599';
      }
    }

    if (text) {
      text.textContent = `${this.health} / ${this.maxHealth} HP`;
    }
  }

  private updateTaunt() {
    const tauntEl = this.container.querySelector('.game-taunt') as HTMLElement;
    if (tauntEl) {
      const randomTaunt = this.taunts[Math.floor(Math.random() * this.taunts.length)];
      tauntEl.textContent = `"${randomTaunt}"`;
    }
  }

  private spawnDamageNumber(damage: number, isCritical: boolean, clientX: number, clientY: number) {
    const rect = this.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const popup = document.createElement('div');
    popup.className = `game-damage-popup ${isCritical ? 'is-crit' : ''}`;
    popup.textContent = isCritical ? `-${damage} CRIT!` : `-${damage}`;
    popup.style.left = `${Math.max(20, Math.min(rect.width - 60, x))}px`;
    popup.style.top = `${Math.max(20, y - 20)}px`;

    this.container.appendChild(popup);

    setTimeout(() => {
      popup.remove();
    }, 900);
  }

  private triggerVictory() {
    this.isDefeated = true;
    sfx.playVictory();

    // Extinguish candle
    this.candleFlame.visible = false;
    this.candleLight.intensity = 0;

    // Explode into victory confetti
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#ff4b00', '#ffe600', '#ff2e7e', '#00e599', '#7038ff']
    });

    // Reveal victory overlay
    const victoryOverlay = this.container.querySelector('.game-victory-overlay') as HTMLElement;
    if (victoryOverlay) {
      victoryOverlay.classList.add('is-active');
    }
  }

  public reset() {
    this.isDefeated = false;
    this.health = this.maxHealth;
    this.combo = 0;
    this.candleFlame.visible = true;
    this.candleLight.intensity = 2;
    this.currentScale.set(1, 1, 1);

    this.updateHealthBar();
    const tauntEl = this.container.querySelector('.game-taunt') as HTMLElement;
    if (tauntEl) {
      tauntEl.textContent = '"YOU DARE CHALLENGE THE SACRED BIRTHDAY CAKE?!"';
    }

    const victoryOverlay = this.container.querySelector('.game-victory-overlay') as HTMLElement;
    if (victoryOverlay) {
      victoryOverlay.classList.remove('is-active');
    }
    sfx.playPop();
  }
}
