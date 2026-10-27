import { gsap } from 'gsap';
import { sfx } from './audio-fx';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  rotation: number;
  vRot: number;
  color: string;
}

interface Shockwave {
  x: number;
  y: number;
  rx: number;
  ry: number;
  maxRx: number;
  alpha: number;
  color: string;
}

export class RocketLandingSystem {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private landingWrapper: HTMLElement | null = null;
  private characterFrame: HTMLElement | null = null;
  private characterImg: HTMLImageElement | null = null;
  private viewport: HTMLElement | null = null;

  // Telemetry HUD Elements
  private telemetryBadge: HTMLElement | null = null;
  private telemetryStatus: HTMLElement | null = null;
  private telemetryAlt: HTMLElement | null = null;
  private telemetryVel: HTMLElement | null = null;
  private replayBtn: HTMLElement | null = null;

  // Simulation State
  public isLanding: boolean = false;
  public hasLanded: boolean = false;
  private throttle: number = 0; // 0.0 to 1.0
  private sparks: Spark[] = [];
  private smoke: SmokePuff[] = [];
  private shockwaves: Shockwave[] = [];
  private animFrameId: number | null = null;
  private thrusterAudioStopper: { stop: () => void } | null = null;
  private timeline: gsap.core.Timeline | null = null;

  // Normalized foot positions relative to image dimensions (measured via pixel inspection)
  private readonly LEFT_FOOT_X_RATIO = 0.380;
  private readonly RIGHT_FOOT_X_RATIO = 0.619;
  private readonly SOLE_Y_RATIO = 0.985;

  constructor() {
    // Initialized in init()
  }

  public init() {
    this.canvas = document.getElementById('rocket-thruster-canvas') as HTMLCanvasElement;
    this.landingWrapper = document.getElementById('rocket-landing-wrapper');
    this.characterFrame = document.getElementById('character-frame');
    this.characterImg = document.getElementById('character-img') as HTMLImageElement;
    this.viewport = document.getElementById('character-stage-viewport');

    this.telemetryBadge = document.getElementById('rocket-telemetry-badge');
    this.telemetryStatus = document.getElementById('telemetry-status-text');
    this.telemetryAlt = document.getElementById('telemetry-alt');
    this.telemetryVel = document.getElementById('telemetry-vel');
    this.replayBtn = document.getElementById('btn-replay-rocket');

    if (!this.canvas || !this.characterFrame || !this.characterImg) {
      console.warn('Rocket landing elements not found');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Wire up replay button
    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => {
        this.replayLanding();
      });
    }

    // Check prefers-reduced-motion
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) {
      this.completeInstantTouchdown();
      return;
    }

    // If starting with scroll position, reset to top so landing is seen
    if (window.scrollY > 20) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Dismiss early if visitor aggressively scrolls down during landing
    window.addEventListener('scroll', () => {
      if (this.isLanding && window.scrollY > 80) {
        this.completeInstantTouchdown();
      }
    }, { passive: true });

    // Trigger initial rocket landing sequence on page open
    // Small timeout ensures layout metrics are settled
    setTimeout(() => {
      this.startLandingSequence();
    }, 150);
  }

  private handleResize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  public replayLanding() {
    if (this.isLanding) return;
    sfx.playPop();

    // Scroll smoothly to top first
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      this.startLandingSequence();
    }, 350);
  }

  public completeInstantTouchdown() {
    this.hasLanded = true;
    this.isLanding = false;
    this.throttle = 0;

    if (this.viewport) {
      this.viewport.style.zIndex = '5';
    }

    if (this.landingWrapper) {
      gsap.killTweensOf(this.landingWrapper);
      gsap.set(this.landingWrapper, { clearProps: 'all' });
    }

    const leftCol = document.querySelector('.hero-left-column');
    const rightCol = document.querySelector('.hero-right-column');
    const actions = document.querySelector('.hero-landing-actions');
    if (leftCol) {
      gsap.killTweensOf(leftCol);
      gsap.set(leftCol, { x: 0, opacity: 1 });
    }
    if (rightCol) {
      gsap.killTweensOf(rightCol);
      gsap.set(rightCol, { x: 0, opacity: 1 });
    }
    if (actions) {
      gsap.killTweensOf(actions);
      gsap.set(actions, { y: 0, opacity: 1 });
    }

    this.updateTelemetry(0, 0, '🎯 IN POSITION: SCROLL TO EXPLORE');
    if (this.telemetryBadge) {
      this.telemetryBadge.classList.remove('is-active');
    }
    window.dispatchEvent(new CustomEvent('birthday:rocket-landed'));
  }

  public startLandingSequence() {
    if (!this.landingWrapper || !this.characterImg) return;

    if (this.timeline) {
      this.timeline.kill();
    }

    this.isLanding = true;
    this.hasLanded = false;
    this.throttle = 0.6;
    this.sparks = [];
    this.smoke = [];
    this.shockwaves = [];

    // Notify window that landing is active
    window.dispatchEvent(new CustomEvent('birthday:rocket-landing-start'));

    // Start audio synthesis
    if (this.thrusterAudioStopper) {
      this.thrusterAudioStopper.stop();
    }
    this.thrusterAudioStopper = sfx.startRocketThruster();

    // Show telemetry badge
    if (this.telemetryBadge) {
      this.telemetryBadge.classList.add('is-active');
      this.telemetryBadge.classList.remove('is-landed');
    }

    // Bring viewport to the front during the rocket landing descent
    if (this.viewport) {
      this.viewport.style.zIndex = '35';
    }

    // Start particle render loop
    this.startRenderLoop();

    // Foreground Landing Dimensions: Aki lands prominently in the FRONT!
    const isMobile = window.innerWidth < 768;
    const frontScale = isMobile ? 1.22 : 1.35;
    const frontY = isMobile ? '1vh' : '2.5vh';

    // Initial carrier state: stratosphere descent in front with rocket attitude tilt
    gsap.set(this.landingWrapper, {
      y: '-115vh',
      x: '0vw',
      scale: frontScale,
      rotation: -3,
      transformOrigin: '50% 50%'
    });

    // Part flank columns slightly so full visual focus is on Aki landing in the front
    const leftCol = document.querySelector('.hero-left-column');
    const rightCol = document.querySelector('.hero-right-column');
    const actions = document.querySelector('.hero-landing-actions');
    if (leftCol) {
      gsap.killTweensOf(leftCol);
      gsap.set(leftCol, { x: -55, opacity: 0.18 });
    }
    if (rightCol) {
      gsap.killTweensOf(rightCol);
      gsap.set(rightCol, { x: 55, opacity: 0.18 });
    }
    if (actions) {
      gsap.killTweensOf(actions);
      gsap.set(actions, { y: 24, opacity: 0 });
    }

    const progressTracker = { progress: 0, altitude: 1200, velocity: 85 };

    this.timeline = gsap.timeline({
      onUpdate: () => {
        // Update telemetry numbers in real time
        const alt = Math.max(0, Math.round(progressTracker.altitude));
        const vel = Math.max(0, Math.round(progressTracker.velocity));
        const status = alt > 300 
          ? 'RETRO-PROPULSION ENGAGED' 
          : alt > 30 
            ? 'TERMINAL BRAKING BURN' 
            : 'FOREGROUND TOUCHDOWN';
        this.updateTelemetry(alt, vel, status);
      },
      onComplete: () => {
        this.handleTouchdown(frontScale, frontY);
      }
    });

    // --- PHASE 1: Atmospheric Entry & High-Speed Descent (0.0s - 1.2s) ---
    this.timeline.to(this.landingWrapper, {
      y: '-32vh',
      rotation: 2.2,
      duration: 1.2,
      ease: 'power2.in'
    }, 0);

    this.timeline.to(progressTracker, {
      altitude: 450,
      velocity: 110,
      duration: 1.2,
      ease: 'power2.in'
    }, 0);

    this.timeline.to(this, {
      throttle: 1.0,
      duration: 0.5,
      ease: 'power1.out'
    }, 0.7); // Thruster ramps to 100% full throttle for suicide burn

    // --- PHASE 2: Terminal Suicide Burn Deceleration (1.2s - 2.1s) ---
    this.timeline.to(this.landingWrapper, {
      y: '-2vh',
      rotation: -0.6,
      duration: 0.9,
      ease: 'power2.out'
    }, 1.2);

    this.timeline.to(progressTracker, {
      altitude: 40,
      velocity: 12,
      duration: 0.9,
      ease: 'power2.out'
    }, 1.2);

    this.timeline.to(this, {
      throttle: 0.75,
      duration: 0.4
    }, 1.6);

    // --- PHASE 3: Micro-Stabilization Hover into Contact Up Front (2.1s - 2.6s) ---
    this.timeline.to(this.landingWrapper, {
      y: frontY,
      rotation: 0,
      duration: 0.5,
      ease: 'power1.out'
    }, 2.1);

    this.timeline.to(progressTracker, {
      altitude: 0,
      velocity: 0,
      duration: 0.5,
      ease: 'power1.out'
    }, 2.1);

    this.timeline.to(this, {
      throttle: 0.35,
      duration: 0.4
    }, 2.1);
  }

  private handleTouchdown(frontScale: number, frontY: string) {
    this.throttle = 0; // Cut thruster flames immediately!

    // Cut thruster continuous audio
    if (this.thrusterAudioStopper) {
      this.thrusterAudioStopper.stop();
      this.thrusterAudioStopper = null;
    }

    // Play impact thump + pneumatic depressurization hiss!
    sfx.playTouchdown();

    // Trigger expanding ground shockwave ring
    const groundY = this.getGroundY();
    const centerX = window.innerWidth / 2;
    this.shockwaves.push({
      x: centerX,
      y: groundY,
      rx: 35,
      ry: 12,
      maxRx: window.innerWidth * 0.42,
      alpha: 0.9,
      color: 'rgba(255, 195, 60, '
    });

    // Spawn final touchdown dust burst
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI;
      const speed = 4 + Math.random() * 14;
      const isLeft = i % 2 === 0;
      this.smoke.push({
        x: centerX + (Math.random() - 0.5) * 70,
        y: groundY - 5 + (Math.random() - 0.5) * 12,
        vx: (isLeft ? -1 : 1) * speed,
        vy: -Math.sin(angle) * 3.5 - Math.random() * 2,
        radius: 20 + Math.random() * 18,
        maxRadius: 85 + Math.random() * 50,
        alpha: 0.7,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.04,
        color: 'rgba(240, 236, 226, '
      });
    }

    // Viewport camera impulse shake (tactile impact)
    if (this.viewport) {
      gsap.fromTo(this.viewport, 
        { y: 9 }, 
        { y: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.35)' }
      );
    }

    // Landing gear compression in the front: squash slightly then spring back
    if (this.landingWrapper) {
      gsap.fromTo(this.landingWrapper,
        { scaleY: frontScale * 0.92, scaleX: frontScale * 1.05 },
        { 
          scaleY: frontScale, 
          scaleX: frontScale, 
          duration: 0.45, 
          ease: 'back.out(2.2)',
          onComplete: () => {
            gsap.set(this.landingWrapper, { clearProps: 'scaleX,scaleY' });
          }
        }
      );
    }

    // Telemetry badge confirmation update
    this.updateTelemetry(0, 0, '🎯 TOUCHDOWN CONFIRMED: AKI HAS ARRIVED IN FRONT!');
    if (this.telemetryBadge) {
      this.telemetryBadge.classList.add('is-landed');
    }

    // Hold in the FRONT for 900ms to let the impact and smoke be admired,
    // then smoothly move to original position for website scrolling!
    setTimeout(() => {
      this.moveToOriginalPosition(frontScale, frontY);
    }, 950);
  }

  // Smoothly move Aki from the foreground into the original position used for scrolling
  private moveToOriginalPosition(fromScale: number, fromY: string) {
    if (!this.landingWrapper) return;

    // Drop character behind cards for the scroll experience
    if (this.viewport) {
      this.viewport.style.zIndex = '5';
    }

    this.updateTelemetry(0, 0, 'MISSION CONTROL: DOCKING INTO STATION');

    // Camera reframing whoosh sound
    sfx.playWhoosh();

    const moveTl = gsap.timeline({
      onComplete: () => {
        this.isLanding = false;
        this.hasLanded = true;
        this.updateTelemetry(0, 0, '🎯 READY: SCROLL TO EXPLORE');

        if (this.telemetryBadge) {
          setTimeout(() => {
            if (this.hasLanded) {
              this.telemetryBadge?.classList.remove('is-active');
            }
          }, 3200);
        }

        // Clean up carrier transform values so character-frame takes 100% of the screen
        gsap.set(this.landingWrapper, { clearProps: 'all' });

        window.dispatchEvent(new CustomEvent('birthday:rocket-landed'));
      }
    });

    // 1. Carrier steps back from front (scale 1.35 ➔ 1.0, y: 2.5vh ➔ 0vh)
    moveTl.to(this.landingWrapper, {
      scale: 1.0,
      y: '0vh',
      x: '0vw',
      duration: 1.25,
      ease: 'power2.inOut'
    }, 0);

    // 2. Dossier and Newspaper flank panels glide in around him into place
    const leftCol = document.querySelector('.hero-left-column');
    const rightCol = document.querySelector('.hero-right-column');
    const actions = document.querySelector('.hero-landing-actions');

    if (leftCol) {
      moveTl.to(leftCol, {
        x: 0,
        opacity: 1,
        duration: 1.0,
        ease: 'back.out(1.2)'
      }, 0.25);
    }

    if (rightCol) {
      moveTl.to(rightCol, {
        x: 0,
        opacity: 1,
        duration: 1.0,
        ease: 'back.out(1.2)'
      }, 0.25);
    }

    if (actions) {
      moveTl.to(actions, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power2.out'
      }, 0.5);
    }
  }

  private updateTelemetry(altitude: number, velocity: number, status: string) {
    if (this.telemetryStatus) {
      this.telemetryStatus.textContent = status;
    }
    if (this.telemetryAlt) {
      this.telemetryAlt.textContent = `ALTITUDE: ${altitude}M`;
    }
    if (this.telemetryVel) {
      this.telemetryVel.textContent = `VELOCITY: ${velocity > 0 ? velocity + ' M/S' : '0.0 M/S (STABLE)'}`;
    }
  }

  private getGroundY(): number {
    return window.innerHeight * 0.91;
  }

  private startRenderLoop() {
    if (this.animFrameId !== null) return;

    const render = () => {
      this.updateAndDraw();

      // Continue render loop if landing is active, or if smoke/sparks are still fading
      if (this.isLanding || this.sparks.length > 0 || this.smoke.length > 0 || this.shockwaves.length > 0) {
        this.animFrameId = requestAnimationFrame(render);
      } else {
        if (this.ctx && this.canvas) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.animFrameId = null;
      }
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  private updateAndDraw() {
    if (!this.ctx || !this.canvas || !this.characterImg) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Get current live bounding box of character image on screen
    const rect = this.characterImg.getBoundingClientRect();
    const soleY = rect.top + rect.height * this.SOLE_Y_RATIO;
    const leftFootX = rect.left + rect.width * this.LEFT_FOOT_X_RATIO;
    const rightFootX = rect.left + rect.width * this.RIGHT_FOOT_X_RATIO;
    const groundY = this.getGroundY();

    // 1. Draw Thruster Flames (only while throttle > 0)
    if (this.throttle > 0.05) {
      this.drawThrusterPlume(ctx, leftFootX, soleY, this.throttle, groundY);
      this.drawThrusterPlume(ctx, rightFootX, soleY, this.throttle, groundY);

      // Spawn spark embers from each nozzle
      const sparksToSpawn = Math.round(this.throttle * 4);
      for (let i = 0; i < sparksToSpawn; i++) {
        const isLeft = Math.random() < 0.5;
        const nx = isLeft ? leftFootX : rightFootX;
        this.sparks.push({
          x: nx + (Math.random() - 0.5) * 16,
          y: soleY + Math.random() * 8,
          vx: (Math.random() - 0.5) * 6,
          vy: 8 + Math.random() * 16 * this.throttle,
          radius: 1.5 + Math.random() * 2.5,
          alpha: 1.0,
          color: Math.random() > 0.4 ? '#FFF5AA' : '#FF7700',
          life: 0,
          maxLife: 20 + Math.random() * 25
        });
      }

      // Proximity ground smoke: when thrusters approach ground
      const distToGround = groundY - soleY;
      if (distToGround < 220 && distToGround > -20) {
        const proximityFactor = Math.max(0.1, 1 - distToGround / 220);
        const smokePuffs = Math.round(proximityFactor * 2.5);
        for (let i = 0; i < smokePuffs; i++) {
          const isLeft = Math.random() < 0.5;
          const nx = isLeft ? leftFootX : rightFootX;
          const lateralSpeed = (3 + Math.random() * 9) * proximityFactor;
          this.smoke.push({
            x: nx + (Math.random() - 0.5) * 30,
            y: groundY - 8 + (Math.random() - 0.5) * 8,
            vx: (isLeft ? -1 : 1) * lateralSpeed,
            vy: -0.4 - Math.random() * 1.5,
            radius: 12 + Math.random() * 12,
            maxRadius: 55 + Math.random() * 45 * proximityFactor,
            alpha: 0.45 * proximityFactor,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.03,
            color: 'rgba(242, 238, 230, '
          });
        }
      }
    }

    // 2. Update & Draw Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy *= 0.96; // drag
      sp.life++;

      // Ground bounce
      if (sp.y >= groundY) {
        sp.y = groundY;
        sp.vy = -Math.abs(sp.vy) * 0.35;
        sp.vx *= 1.4;
      }

      sp.alpha = Math.max(0, 1 - sp.life / sp.maxLife);

      if (sp.life >= sp.maxLife || sp.alpha <= 0.01) {
        this.sparks.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = sp.alpha;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Update & Draw Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.rx += (sw.maxRx - sw.rx) * 0.12;
      sw.ry = sw.rx * 0.28;
      sw.alpha *= 0.91;

      if (sw.alpha <= 0.02) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, sw.rx, sw.ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `${sw.color}${sw.alpha})`;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner glow fill
      ctx.fillStyle = `${sw.color}${sw.alpha * 0.25})`;
      ctx.fill();
      ctx.restore();
    }

    // 4. Update & Draw Volumetric Billowing Smoke
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const sm = this.smoke[i];
      sm.x += sm.vx;
      sm.y += sm.vy;
      sm.vx *= 0.94; // friction
      sm.radius += (sm.maxRadius - sm.radius) * 0.045;
      sm.rotation += sm.vRot;
      sm.alpha *= 0.965;

      if (sm.alpha <= 0.02) {
        this.smoke.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(sm.x, sm.y);
      ctx.rotate(sm.rotation);

      const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sm.radius);
      radGrad.addColorStop(0, `${sm.color}${sm.alpha})`);
      radGrad.addColorStop(0.5, `${sm.color}${sm.alpha * 0.6})`);
      radGrad.addColorStop(1, `${sm.color}0)`);

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(0, 0, sm.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw realistic rocket thruster plume with Mach diamonds
  private drawThrusterPlume(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    throttle: number,
    groundY: number
  ) {
    const time = performance.now() * 0.001;
    // Jitter and pulse
    const jitter = Math.sin(time * 55 + x) * 2.5;
    const maxFlameLength = Math.min(300 * throttle, Math.max(70, groundY - y + 50));
    const flameLength = (maxFlameLength * (0.88 + Math.random() * 0.12));
    const flameWidth = (34 + Math.random() * 8) * throttle;

    ctx.save();

    // 0. Searing White-Hot Engine Throat / Nozzle Glow
    ctx.beginPath();
    ctx.ellipse(x, y, flameWidth * 0.45, 8 * throttle, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(255, 200, 50, 1)';
    ctx.shadowBlur = 22;
    ctx.fill();

    // A. Outer Fiery Plume (Orange to Red Glow)
    ctx.beginPath();
    ctx.moveTo(x - flameWidth * 0.5, y);
    ctx.quadraticCurveTo(x - flameWidth * 0.65, y + flameLength * 0.5, x + jitter, y + flameLength);
    ctx.quadraticCurveTo(x + flameWidth * 0.65, y + flameLength * 0.5, x + flameWidth * 0.5, y);
    ctx.closePath();

    const outerGrad = ctx.createLinearGradient(x, y, x, y + flameLength);
    outerGrad.addColorStop(0, 'rgba(255, 245, 120, 0.98)');
    outerGrad.addColorStop(0.2, 'rgba(255, 130, 20, 0.95)');
    outerGrad.addColorStop(0.6, 'rgba(235, 45, 10, 0.7)');
    outerGrad.addColorStop(1, 'rgba(180, 10, 0, 0)');
    ctx.fillStyle = outerGrad;
    ctx.shadowColor = 'rgba(255, 100, 20, 0.85)';
    ctx.shadowBlur = 28;
    ctx.fill();

    // B. Inner Plasma Core (Intense Incandescent White-Cyan)
    const coreWidth = flameWidth * 0.5;
    const coreLength = flameLength * 0.65;
    ctx.beginPath();
    ctx.moveTo(x - coreWidth * 0.5, y);
    ctx.quadraticCurveTo(x - coreWidth * 0.5, y + coreLength * 0.5, x + jitter * 0.5, y + coreLength);
    ctx.quadraticCurveTo(x + coreWidth * 0.5, y + coreLength * 0.5, x + coreWidth * 0.5, y);
    ctx.closePath();

    const coreGrad = ctx.createLinearGradient(x, y, x, y + coreLength);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    coreGrad.addColorStop(0.3, 'rgba(190, 240, 255, 0.95)');
    coreGrad.addColorStop(0.75, 'rgba(255, 190, 40, 0.6)');
    coreGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = coreGrad;
    ctx.shadowBlur = 12;
    ctx.fill();

    // C. Supersonic Mach Shock Diamonds (3 distinct diamond pulses along exhaust jet)
    const diamondCount = 3;
    const diamondStep = coreLength / (diamondCount + 1);
    for (let d = 1; d <= diamondCount; d++) {
      const dy = y + diamondStep * d + (Math.sin(time * 30 + d) * 2);
      const dw = (coreWidth * 0.65) * (1 - (d / (diamondCount + 1)) * 0.45);
      const dh = dw * 1.6;

      ctx.beginPath();
      ctx.moveTo(x, dy - dh);
      ctx.lineTo(x + dw, dy);
      ctx.lineTo(x, dy + dh);
      ctx.lineTo(x - dw, dy);
      ctx.closePath();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowColor = 'rgba(200, 240, 255, 0.9)';
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    ctx.restore();
  }
}

export const rocketLanding = new RocketLandingSystem();
if (typeof window !== 'undefined') {
  (window as unknown as { rocketLandingInstance: RocketLandingSystem }).rocketLandingInstance = rocketLanding;
}
