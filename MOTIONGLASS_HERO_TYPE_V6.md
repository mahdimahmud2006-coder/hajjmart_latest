# MotionGlass Hero Type V6

This pass changes only the top hero/banner presentation and leaves the previously approved scroll-story/reveal section intact.

## Banner image set
The hero now uses the newly supplied Madina / Makkah landscape imagery only:

1. Madina courtyard at golden hour
2. Madina lantern / sunset view
3. Kaaba kiswa detail
4. Interior calligraphy / architecture
5. Kaaba at sunset
6. Madina arches / interior
7. Kaaba mountain sunset view

Each source was preprocessed to a 1920×1080 WebP using high-quality Lanczos resampling and a mild clarity pass so the browser does not have to stretch the smaller originals directly.

Assets live under:
`Frontend/public/images/hero-v6/`

## Motion and typography
- Banner dimensions are unchanged from V5.
- Automatic slide rotation remains the primary behavior.
- Images crossfade and drift gently left-to-right without zoom shake.
- Eyebrow text uses a short decode/scramble reveal on slide change.
- Headline uses a letter-by-letter type-on effect.
- A blinking cursor remains after the headline types in.
- Description, CTA row and utility pills reveal in a soft stagger.
- Manual arrows/dots remain only as fallback controls.
- `prefers-reduced-motion` disables the animated typing/pan behavior.

## Preserved
The previously approved scroll-driven visual section and product reveal system were intentionally not changed in this pass.

## Validation
- 103 TypeScript/TSX source files parsed with 0 syntax failures.
- CSS braces balanced.
- `dev1.sh` shell syntax passed.
- Backend route-handler audit passed: 185 handlers.
