# PRODUCT.md — BIRTHDAY.EXE

## 1. Vision & Concept
**BIRTHDAY.EXE** is an unhinged, bespoke 3D interactive birthday experience built as a playful digital tribute for a close friend. Instead of another cookie-cutter SaaS-style landing page or static greeting card, it immerses the visitor into a continuous scroll journey where a full-body 3D model of the birthday friend serves as the protagonist. As the visitor scrolls, a single camera travels cinematographically through the model's anatomy—from head to toe—unlocking interactive paper-cut vignettes, personal greetings, and a playable 3D boss fight.

## 2. Audience & Tonal Identity
- **Recipient:** The Birthday Friend ("The Specimen" / `[FRIEND_NAME]`).
- **Tone:** Unserious editorial humor, absurd internet culture, handmade paper-cut collage aesthetic, cinematic 3D choreography, and genuine personal celebration.
- **Experience Mode (Impeccable):** `Experience` + `Persuade` — high-fidelity craft, distinct visual perspective, zero generic templates, satisfying tactile feedback.

## 3. Experience Architecture & Journey
The experience runs on a single, continuous Three.js scene synchronized with a deterministic, normalized GSAP ScrollTrigger timeline:

1. **Stage A — Full-Body Landing:**
   - Full 3D model in heroic view with gentle breathing/sway idle motion.
   - Surrounded by scattered paper-cut display typography, sticker badges ("100% ORGANIC", "AGE +1"), and a tactile scroll indicator.
2. **Stage B — Descent to the Face:**
   - Smooth, scrubbed camera journey interpolating towards the model's head/face anchor point.
   - No clipping, no scale hacks; genuine 3D spatial camera tracking with eased vectors.
3. **Stage C — Face Composition & Interactive Birthday Card:**
   - Split layout: 3D face anchored on the right, interactive paper-cut birthday envelope on the left.
   - Click/tap/keyboard to unfold envelope, revealing personalized letter, photo frame placeholder, and custom birthday greetings.
4. **Stage D — Descent to Torso & Knees:**
   - Continuous camera trajectory panning down past the torso to the knees.
   - Seamless transition reframing model to the left side while clearing the right viewport.
5. **Stage E — Mini-Game: "BOSS FIGHT: THE BIRTHDAY CAKE":**
   - Playable 3D combat module mounted on the right.
   - Features an animated 3D birthday cake boss with dynamic candle flame, health bar (100 HP), floating damage text ("+42 EXP", "CRITICAL BASH!"), squash & stretch hit reactions, randomized witty taunts, victory confetti celebration, and an unlocked secret birthday perk.
   - Isolated pointer and keyboard controls that prevent unintentional document scrolling.
6. **Stage F — Journey to the Feet:**
   - Camera tracks smoothly downwards from knees to shoes/feet with close framing.
7. **Stage G — The Foot-Centered Footer:**
   - The literal punchline: "YES, THIS IS THE FOOTER. NO MORE CONTENT. JUST FEET."
   - Functional controls: "Teleport to Top", audio toggle (optional sound effects), credits, and customizable birthday signature.

## 4. Technical Guardrails & Constraints
- **Static-first:** Astro + TypeScript + Vite + Three.js + GSAP ScrollTrigger + CSS.
- **Single Source of Truth:** A unified render loop and coordinate system across the entire page.
- **Asset Fallback:** Supports a drop-in GLB model at `public/models/friend-model.glb`; provides a stylized, fully rigged procedural 3D mannequin placeholder with customizable anchor points if no file is present.
- **Accessibility & Resilience:** Respects `prefers-reduced-motion`, includes keyboard controls for all interactives, semantic HTML layer alongside WebGL canvas, and full responsive design for desktop & mobile.
