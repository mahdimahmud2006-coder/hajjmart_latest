# MotionGlass V13 — Crystal Hero + Larger Type/Delete Heading

## Hero clarity
- Reprocessed all five V12 banner images into 2880px-wide high-quality WebP masters.
- Used Lanczos resampling, restrained local contrast, sharpness restoration and an unsharp-mask pass.
- The hero now references the HQ assets so Ken Burns / parallax / scale transitions have enough resolution headroom for large desktop screens.
- Existing hero size and V12 transition choreography are preserved.

## Animated heading size
- Fixed a CSS specificity issue where the typewriter text's inner span inherited the generic 9px eyebrow styling.
- The heading now renders at `clamp(3.15rem, 5.2vw, 5.75rem)` on desktop and scales responsively on mobile.
- The looping type-and-delete animation and blinking cursor are preserved.
