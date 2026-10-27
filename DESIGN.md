# DESIGN.md — BIRTHDAY.EXE Design System & Image Choreography

## 1. Aesthetic Identity: "Raw Paper-Cut Collage with Full-Body Character Integration"
BIRTHDAY.EXE uses the real full-body photograph of Aki (`public/images/friend-fullbody.png`) seamlessly integrated into a paper-cut editorial universe. By removing rectangular borders and using transparent PNG compositing, the character feels alive inside the layout—accompanied by torn-paper badges, washi-tape stickers, hard ink drop shadows, and authentic newsprint textures.

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

  /* Elevation & Border Craft (Better-UI Standards) */
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

## 3. Persistent 2D Character Transformation Matrix
The transparent character image has an aspect ratio of $764 \times 1024$ ($0.746$). Its normalized anatomical landmarks are:
- **Head & Radhe Radhe Headwrap:** $X = 50.4\%$, $Y = 14.2\%$
- **Torso & Scarf:** $X = 50.4\%$, $Y = 38.2\%$
- **Knees & Trousers:** $X = 50.4\%$, $Y = 71.2\%$
- **Bare Feet:** $X = 50.4\%$, $Y = 93.7\%$

### Milestone Transformation Map (GSAP ScrollTrigger Timeline)

| Milestone | Normalized Scroll | Target Focus | Scale | Desktop Offset ($X, Y$) | Mobile Offset ($X, Y$) | Visual Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0: Full-Body** | `0.00 - 0.12` | Full Person | `1.0` | `0vw, 0vh` | `0vw, 0vh` | Heroic full-body view; head to bare feet fully visible. |
| **1: Face Zoom** | `0.18 - 0.32` | Head & Eyes | `2.2` | `12vw, 3vh` | `0vw, 2vh` | Smooth zoom towards the Radhe Radhe headwrap. |
| **2: Face & Card** | `0.35 - 0.48` | Face Close-up | `3.2` | `26vw, 6vh` | `0vw, -4vh` | Face framed on right; interactive birthday card on left. |
| **3: Torso Descent** | `0.52 - 0.62` | Chest & Scarf | `2.6` | `-6vw, -36vh` | `0vw, -28vh` | Camera travels down chest; scarf in focus. |
| **4: Knees & Cake** | `0.68 - 0.80` | Knee Region | `2.4` | `-25vw, -76vh` | `0vw, -62vh` | Knees on left; 3D Birthday Cake Boss Fight on right. |
| **5: Foot Approach** | `0.85 - 0.92` | Lower Legs | `2.6` | `-6vw, -106vh` | `0vw, -92vh` | Gliding towards ankles and feet. |
| **6: Feet & Footer** | `0.95 - 1.00` | Bare Feet | `2.9` | `0vw, -136vh` | `0vw, -122vh` | Bare feet centered in viewport; footer punchline surrounds them. |

## 4. UI Craft & Micro-Interactions (Better-UI Standards)
- **Concentric Radii:** $R_{outer} = R_{inner} + \text{padding}$.
- **Tactile Button Physics:**
  - Normal: `transform: translate(0, 0)`, `box-shadow: 4px 4px 0 #121316`.
  - Active/Press: `transform: scale(0.96) translate(3px, 3px)`, `box-shadow: 1px 1px 0 #121316`, transition $120\text{ms}$ `cubic-bezier(0.2, 0, 0, 1)`.
- **Optical Centering:** Visual mass of stickers and annotations nudged by eye.
- **Selective 3D:** The Birthday Cake Boss Fight uses a lightweight, isolated Three.js canvas that stops its render loop when scrolled offscreen.
