import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { sfx } from './audio-fx';

gsap.registerPlugin(ScrollTrigger);

export function initCharacterScroll() {
  const frame = document.getElementById('character-frame');
  const scrollContainer = document.getElementById('scroll-container');
  if (!frame || !scrollContainer) return;

  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isMobile = window.innerWidth < 768;

  // Milestone Transformation Definitions (anchored around face: transform-origin: 50% 14%)
  const getMilestones = () => {
    isMobile = window.innerWidth < 768;
    return [
      // 0. Full-body landing: entire body visible from head to bare feet
      { scale: 1.0, x: '0vw', y: '0vh' },
      // 1. Approach face: zooming towards headwrap
      { scale: 2.0, x: isMobile ? '0vw' : '-10vw', y: '3vh' },
      // 2. Face & Birthday Card: face framed on LEFT (desktop) opposite card on right
      { scale: 3.2, x: isMobile ? '0vw' : '-24vw', y: isMobile ? '-4vh' : '6vh' },
      // 3. Torso descent: camera travels down past chest and scarf
      { scale: 2.5, x: isMobile ? '0vw' : '0vw', y: isMobile ? '-28vh' : '-36vh' },
      // 4. Knees & Mini-Game: knees framed on RIGHT (desktop) opposite game on left
      { scale: 2.3, x: isMobile ? '0vw' : '24vw', y: isMobile ? '-58vh' : '-72vh' },
      // 5. Approach feet: moving downwards towards lower legs and ankles
      { scale: 2.5, x: isMobile ? '0vw' : '20vw', y: isMobile ? '-82vh' : '-96vh' },
      // 6. Feet & Footer punchline: feet framed on the RIGHT, feet section on the LEFT
      { scale: 2.7, x: isMobile ? '0vw' : '24vw', y: isMobile ? '-106vh' : '-122vh' }
    ];
  };

  let milestones = getMilestones();
  let lastStage = -1;

  // Build scrubbed timeline
  let timeline: gsap.core.Timeline | null = null;
  let isLandingActive = true;

  const buildTimeline = () => {
    if (timeline) {
      timeline.kill();
    }
    milestones = getMilestones();

    // Set initial frame state (keep x/scale/origin, preserve landing y if in progress)
    if (!isLandingActive) {
      gsap.set(frame, {
        scale: milestones[0].scale,
        x: milestones[0].x,
        y: milestones[0].y,
        transformOrigin: '50% 14%'
      });
    } else {
      gsap.set(frame, {
        scale: milestones[0].scale,
        x: milestones[0].x,
        transformOrigin: '50% 14%'
      });
    }

    timeline = gsap.timeline({
      scrollTrigger: {
        trigger: scrollContainer,
        start: 'top top',
        end: 'bottom bottom',
        scrub: isReducedMotion ? 0.1 : 0.6,
        onUpdate: (self) => {
          if (isLandingActive) return;
          const stageIndex = Math.min(
            milestones.length - 1,
            Math.floor(self.progress * (milestones.length - 0.1))
          );
          if (stageIndex !== lastStage) {
            lastStage = stageIndex;
            sfx.playWhoosh();
            window.dispatchEvent(
              new CustomEvent('birthday:stage-change', {
                detail: {
                  stage: stageIndex,
                  progress: self.progress,
                  stageName: [
                    'Aki Landing',
                    'Face Zoom',
                    'Birthday Note',
                    'Good Energy',
                    'Protect The Brain',
                    'Feet Approach',
                    'The Footer (Literally Feet)'
                  ][stageIndex] || ''
                }
              })
            );
          }
        }
      }
    });

    // Sequence through the 6 transitions
    for (let i = 1; i < milestones.length; i++) {
      timeline.to(frame, {
        scale: milestones[i].scale,
        x: milestones[i].x,
        y: milestones[i].y,
        ease: 'power1.inOut',
        duration: 1
      });
    }

    if (isLandingActive && timeline.scrollTrigger) {
      timeline.scrollTrigger.disable(false);
    }
  };

  buildTimeline();

  // Listen to rocket landing events
  window.addEventListener('birthday:rocket-landing-start', () => {
    isLandingActive = true;
    if (timeline && timeline.scrollTrigger) {
      timeline.scrollTrigger.disable(false);
    }
  });

  window.addEventListener('birthday:rocket-landed', () => {
    isLandingActive = false;
    if (timeline && timeline.scrollTrigger) {
      timeline.scrollTrigger.enable();
      ScrollTrigger.refresh();
    }
  });

  window.addEventListener('resize', () => {
    buildTimeline();
    ScrollTrigger.refresh();
  });

  // Ready signal
  window.dispatchEvent(new CustomEvent('birthday:scene-ready'));
}
