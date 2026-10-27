# PRODUCT.md — BIRTHDAY.EXE

## 1. Vision & Concept
**BIRTHDAY.EXE** is an unhinged, bespoke scroll-driven birthday experience built as a playful digital tribute for **Aki**. The central visual element is a full-body photograph of Aki (`public/images/friend-fullbody.png`) with transparent background, showing him wearing his iconic light grey-white headwrap with Hindi text reading *"राधे राधे"*, matching scarf, black T-shirt, dark trousers, and bare feet. 

As the visitor scrolls, a single coordinated GSAP ScrollTrigger timeline transforms the transparent character image relative to a stable scene viewport—smoothly zooming into his face, descending through his torso and knees, and concluding with a close-up on his bare feet in the footer punchline.

## 2. Audience & Tonal Identity
- **Recipient:** Aki ("Saint Aki", "The Specimen").
- **Birthday:** October 28th (with dynamic daily countdown / post-birthday tribute banner).
- **Tone:** Unserious editorial humor, absurd internet culture, handmade paper-cut collage aesthetic, cinematic 2D image choreography, and genuine personal celebration.
- **Experience Mode (Impeccable):** `Experience` + `Persuade` — high-fidelity craft, distinct visual perspective, zero generic templates, satisfying tactile feedback.

## 3. Experience Architecture & Journey

1. **Section A — Full-Body Landing:**
   - The entire transparent character image (`friend-fullbody.png`) is displayed centered and large enough to dominate the viewport without clipping (head, torso, legs, and bare feet completely visible).
   - Surrounded by paper-cut typography ("THE SPECIMEN HAS ARRIVED", "100% ORGANIC. 0% COMMON SENSE.", "HAPPY BIRTHDAY, YOU ABSOLUTE MENACE.", "SCROLL TO INVESTIGATE.").
   - Includes authentic newspaper cutout article ("THE AKI CHRONICLE"), dynamic birthday calendar banner, and subtle scroll indicators.
2. **Section B — Scroll-Driven Face Zoom:**
   - Gradual zoom toward Aki's face ($Y \approx 14\%$ of image height) using smooth GSAP transforms (`scale`, `x`, `y`, with transform origin pegged to the face).
   - Reversible, deterministic, and glitch-free under rapid scrolling.
3. **Section C — Face Composition & Interactive Birthday Card:**
   - Desktop: Aki's face on the right; interactive paper envelope on the left.
   - Clicking/tapping the envelope unseals it into an unfolding letter modal with personal birthday greetings, photo frame, and celebratory confetti.
   - Fully keyboard accessible (`Enter`, `Space`, `Esc`) without interfering with document scroll.
4. **Section D — Torso & Knee Composition with 3D Cake Boss Fight:**
   - Image translates upward and scales so the torso and knee region become the focal point on the left.
   - Right side features an interactive 3D mini-game: "BOSS FIGHT: THE BIRTHDAY CAKE" (Three.js cake with health bar, click/spacebar attacks, hit squash & stretch, funny taunts, confetti victory).
5. **Section E — Feet & The Literal Footer:**
   - Image translates upward to center Aki's bare feet in the viewport.
   - Surrounding punchline text: "YES, THIS IS THE FOOTER. NO MORE CONTENT. JUST FEET."
   - Includes functional "Teleport to Top" control and confetti blaster.

## 4. Technical Guardrails & Constraints
- **Static-First & Lightweight:** Astro + TypeScript + GSAP ScrollTrigger + CSS + HTML.
- **2D Image Compositing:** Transparent PNG (`public/images/friend-fullbody.png`) preserves Aki's real photograph, proportions, and clothing without 3D model generation or distortion.
- **Selective 3D:** Three.js is used strictly for the 3D Birthday Cake Mini-Game in Section D, keeping the main page ultra-fast and lightweight.
- **Accessibility:** Keyboard navigable, ARIA labels, `prefers-reduced-motion` fallbacks, responsive desktop and mobile viewports.
