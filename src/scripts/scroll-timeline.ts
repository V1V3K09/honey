import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createCameraWaypoints, type AnchorPoints, type CameraWaypoint } from './camera-anchors';
import { sfx } from './audio-fx';

gsap.registerPlugin(ScrollTrigger);

export interface CameraState {
  currentPosition: THREE.Vector3;
  currentTarget: THREE.Vector3;
  currentFov: number;
}

export class ScrollTimelineController {
  private camera: THREE.PerspectiveCamera;
  private waypoints: CameraWaypoint[] = [];
  private anchors: AnchorPoints;
  private milestoneTimes = [0.0, 0.18, 0.35, 0.52, 0.68, 0.85, 1.0];
  private lastStageIndex = 0;
  private isReducedMotion = false;

  public cameraState: CameraState;

  constructor(camera: THREE.PerspectiveCamera, anchors: AnchorPoints) {
    this.camera = camera;
    this.anchors = anchors;
    this.isReducedMotion = typeof window !== 'undefined' && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.updateWaypoints();

    this.cameraState = {
      currentPosition: this.waypoints[0].position.clone(),
      currentTarget: this.waypoints[0].target.clone(),
      currentFov: this.waypoints[0].fov
    };

    this.applyCameraState();
    this.initScrollTrigger();
  }

  public updateWaypoints() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    this.waypoints = createCameraWaypoints(this.anchors, isMobile);
  }

  private applyCameraState() {
    this.camera.position.copy(this.cameraState.currentPosition);
    this.camera.lookAt(this.cameraState.currentTarget);
    if (Math.abs(this.camera.fov - this.cameraState.currentFov) > 0.01) {
      this.camera.fov = this.cameraState.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Evaluates camera position and target from normalized scroll progress (0.0 to 1.0)
   */
  public evaluateProgress(progress: number) {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const times = this.milestoneTimes;

    // Find interval [i, i+1]
    let index = 0;
    for (let i = 0; i < times.length - 1; i++) {
      if (clampedProgress >= times[i] && clampedProgress <= times[i + 1]) {
        index = i;
        break;
      }
      if (clampedProgress > times[times.length - 1]) {
        index = times.length - 2;
      }
    }

    const t0 = times[index];
    const t1 = times[index + 1];
    const segmentAlpha = (clampedProgress - t0) / (t1 - t0 || 1);

    // Smoothstep interpolation for seamless easing between segments
    const easeAlpha = this.isReducedMotion 
      ? segmentAlpha 
      : segmentAlpha * segmentAlpha * (3 - 2 * segmentAlpha);

    const w0 = this.waypoints[index];
    const w1 = this.waypoints[index + 1];

    this.cameraState.currentPosition.lerpVectors(w0.position, w1.position, easeAlpha);
    this.cameraState.currentTarget.lerpVectors(w0.target, w1.target, easeAlpha);
    this.cameraState.currentFov = THREE.MathUtils.lerp(w0.fov, w1.fov, easeAlpha);

    this.applyCameraState();

    // Check for stage milestone change
    const currentStage = Math.round(clampedProgress * (times.length - 1));
    if (currentStage !== this.lastStageIndex) {
      this.lastStageIndex = currentStage;
      sfx.playWhoosh();
      this.notifyStageChange(currentStage, clampedProgress);
    }
  }

  private notifyStageChange(stageIndex: number, progress: number) {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
      new CustomEvent('birthday:stage-change', {
        detail: {
          stage: stageIndex,
          progress,
          stageName: [
            'Full-Body Landing',
            'Descent to Face',
            'Face & Birthday Card',
            'Torso Journey',
            'Knees & Cake Boss Fight',
            'Approach to Feet',
            'The Footer (Literally Feet)'
          ][stageIndex] || ''
        }
      })
    );
  }

  private initScrollTrigger() {
    const heroSection = document.getElementById('stage-hero');
    const footerSection = document.getElementById('stage-footer');
    const scrollContainer = document.getElementById('scroll-container');
    if (!scrollContainer) return;

    // The 3D camera journey starts when scrolling past the intro into #stage-hero
    ScrollTrigger.create({
      trigger: heroSection || scrollContainer,
      start: 'top top',
      endTrigger: footerSection || scrollContainer,
      end: 'bottom bottom',
      scrub: this.isReducedMotion ? 0.1 : 0.6,
      onUpdate: (self) => {
        this.evaluateProgress(self.progress);
      }
    });

    // Refresh ScrollTrigger after fonts and layout settle
    window.addEventListener('resize', () => {
      this.updateWaypoints();
      ScrollTrigger.refresh();
    });
  }

  public resize() {
    this.updateWaypoints();
    ScrollTrigger.refresh();
  }

  public destroy() {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }
}
