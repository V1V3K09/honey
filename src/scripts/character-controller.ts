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
    return isMobile ? [
      // Mobile Milestones: Character is framed vertically so face/torso/feet appear above cards
      // 0. Full-body landing: entire body visible from headwrap to bare feet
      { scale: 0.85, x: '0vw', y: '0vh' },
      // 1. Approach face: smooth zoom towards headwrap & eyes
      { scale: 1.8, x: '0vw', y: '2vh' },
      // 2. KARKE.AI Protocol: face framed in upper half, terminal below
      { scale: 2.2, x: '0vw', y: '-6vh' },
      // 3. Face & Birthday Card: face framed in upper half, card below
      { scale: 2.5, x: '0vw', y: '-8vh' },
      // 4. Knees & Mini-Game: knees framed above the brain defense card
      { scale: 2.2, x: '0vw', y: '-95vh' },
      // 5. Feet & Footer punchline: bare feet framed cleanly above footer card
      { scale: 2.6, x: '0vw', y: '-154vh' }
    ] : [
      // Desktop Milestones: Horizontal split screen framing
      // 0. Full-body landing: entire body visible from head to bare feet
      { scale: 1.0, x: '0vw', y: '0vh' },
      // 1. Approach face: zooming towards headwrap
      { scale: 2.2, x: '-8vw', y: '4vh' },
      // 2. KARKE.AI Protocol: face framed on LEFT opposite KARKE.AI terminal on right
      { scale: 3.2, x: '-25vw', y: '6vh' },
      // 3. Face & Birthday Card: face framed on LEFT opposite card on right
      { scale: 3.2, x: '-24vw', y: '6vh' },
      // 4. Knees & Mini-Game: knees framed on RIGHT opposite game on left
      { scale: 2.3, x: '24vw', y: '-72vh' },
      // 5. Feet & Footer punchline: feet framed on the RIGHT, feet section on the LEFT
      { scale: 2.7, x: '24vw', y: '-122vh' }
    ];
  };

  let milestones = getMilestones();
  let lastStage = -1;

  // Build scrubbed timeline
  let timeline: gsap.core.Timeline | null = null;

  const buildTimeline = () => {
    if (timeline) {
      timeline.kill();
    }
    milestones = getMilestones();

    // Set initial frame state
    gsap.set(frame, {
      scale: milestones[0].scale,
      x: milestones[0].x,
      y: milestones[0].y,
      transformOrigin: '50% 14%'
    });

    timeline = gsap.timeline({
      scrollTrigger: {
        trigger: scrollContainer,
        start: 'top top',
        end: 'bottom bottom',
        scrub: isReducedMotion ? 0.1 : 0.6,
        onUpdate: (self) => {
          const stageIndex = Math.min(
            milestones.length - 1,
            Math.floor(self.progress * (milestones.length - 0.1))
          );
          if (stageIndex !== lastStage) {
            lastStage = stageIndex;
            window.dispatchEvent(
              new CustomEvent('birthday:stage-change', {
                detail: {
                  stage: stageIndex,
                  progress: self.progress,
                  stageName: [
                    'Aki Landing',
                    'Face Approach',
                    'KARKE.AI Protocol',
                    'Birthday Note',
                    'Protect The Brain',
                    'The Footer (Literally Feet)'
                  ][stageIndex] || ''
                }
              })
            );
          }
        }
      }
    });

    // Sequence through the 6 camera milestones
    for (let i = 1; i < milestones.length; i++) {
      timeline.to(frame, {
        scale: milestones[i].scale,
        x: milestones[i].x,
        y: milestones[i].y,
        ease: 'power1.inOut',
        duration: 1
      });
    }
  };

  buildTimeline();

  // ScrollTrigger refresh on window resize or when scenes settle
  window.addEventListener('resize', () => {
    buildTimeline();
    ScrollTrigger.refresh();
  });

  window.addEventListener('birthday:rocket-landed', () => {
    ScrollTrigger.refresh();
  });

  // Ready signal
  window.dispatchEvent(new CustomEvent('birthday:scene-ready'));
}
