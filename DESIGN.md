# DESIGN.md — BIRTHDAY.EXE Design System & Art Direction

## 1. Aesthetic Identity: "Raw Paper-Cut Collage Meets High-Energy 3D"
BIRTHDAY.EXE rejects template-like SaaS conventions (cream gradient cards, rounded pills, timid pastel buttons) in favor of a punchy, tactile, handmade editorial aesthetic. It combines physical paper-cut textures, bold ransom-note typography, washi-tape stickers, hard ink shadows, and a seamless 3D spatial camera ride.

## 2. Color Palette & Token Architecture

```css
:root {
  /* Paper & Ink Foundations */
  --bg-paper: #FBF8F1;
  --bg-paper-alt: #F4EFE6;
  --bg-cardboard: #EDE4D3;
  --ink-primary: #121316;
  --ink-muted: #4B4E54;
  --ink-inverted: #FFFFFF;

  /* Tactile Tape & Accents */
  --tape-color: #E8D9BD;
  --accent-vermilion: #FF4B00;
  --accent-yellow: #FFE600;
  --accent-pink: #FF2E7E;
  --accent-mint: #00E599;
  --accent-violet: #7038FF;

  /* Elevation & Border Craft */
  --border-ink: 2.5px solid var(--ink-primary);
  --border-ink-thin: 1.5px solid var(--ink-primary);
  --shadow-hard-sm: 2px 2px 0px var(--ink-primary);
  --shadow-hard-md: 4px 4px 0px var(--ink-primary);
  --shadow-hard-lg: 7px 7px 0px var(--ink-primary);
  --shadow-hard-press: 1px 1px 0px var(--ink-primary);

  /* Typography Scales */
  --font-display: "Syne", "Space Grotesk", system-ui, sans-serif;
  --font-body: "Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "JetBrains Mono", "Space Mono", monospace;

  /* Concentric Radius Scaling */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 14px;
  --radius-cut: 2px;
}
```

## 3. Typographic Hierarchy & Ransom-Note Rules
- **Headline Display (Paper-Cut Treatment):**
  - Uppercase, high-weight (`font-weight: 800`).
  - Rendered inside colored "cutout chunks" (alternating yellow, pink, white, mint backgrounds).
  - Subtle varied rotation per word or letter segment (`transform: rotate(-2.5deg)`, `rotate(3deg)`).
  - Hard ink drop-shadow (`box-shadow: 4px 4px 0 #121316`).
  - Irregular borders simulating scissor cuts.
- **Subheads & Badges:**
  - Monospace or bold sans badges styled like labeled masking tape (`background: var(--tape-color)` with serrated edges or jagged ends).
- **Body & Long Messages:**
  - High-legibility `Space Grotesk` (`16px-18px`, `line-height: 1.6`) on high-contrast paper background (contrast ratio > 11:1).

## 4. UI Craft & Micro-Interactions (Better-UI Standards)
- **Concentric Radii:** Outer container radius = inner container radius + padding.
- **Button Physics (Press Scale):**
  - Normal: `transform: translate(0, 0)`, `box-shadow: 4px 4px 0 var(--ink-primary)`.
  - Hover: `transform: translate(-1px, -1px)`, `box-shadow: 5px 5px 0 var(--ink-primary)`.
  - Active/Press: `transform: scale(0.96) translate(3px, 3px)`, `box-shadow: 1px 1px 0 var(--ink-primary)`, transition `120ms cubic-bezier(0.2, 0, 0, 1)`.
- **Optical Alignment:**
  - Glyphs, stickers, and icon buttons feature visual center-mass compensation (e.g. play triangles offset +2px towards point).
- **No Floating Gradients:**
  - Depth is communicated through physical paper layering, hard shadows, offset paper borders, and 3D spatial lighting.

## 5. 3D & Spatial Choreography Rules
- **Normalized Scroll Timeline:** 
  - Single GSAP ScrollTrigger timeline tracking normalized scroll progress `0.0 -> 1.0`.
  - Camera transitions between defined 3D anchor targets (`fullBody`, `faceApproach`, `faceSplit`, `torsoDescend`, `kneeSplit`, `feetCloseUp`, `footerOverview`).
  - Independent vector spherical/linear interpolation (`camera.position.lerp(targetPos, alpha)` and `lookAtVector.lerp(targetLookAt, alpha)`).
- **Scene Continuity:**
  - Zero camera teleportation or sudden jumps.
  - Bounding box auto-calculation ensures dynamic camera distance fits any aspect ratio or custom model scale.
- **Mini-Game Containment:**
  - Mini-game runs in an isolated WebGL sub-canvas / overlay layer with its own interaction loop.
  - Keyboard events (`Space`) and clicks are captured inside the game element without propagating to document scroll.

## 6. Accessibility & Resilience
- Semantic HTML markup alongside 3D canvas (all headings, birthday messages, and footer text exist in accessible DOM).
- `prefers-reduced-motion`: When active, scroll scrubbing snaps smoothly without dizzying rotations, and screen shake in the mini-game is disabled.
- WebGL feature detection with immediate fallback banner and interactive cards still fully operable.
