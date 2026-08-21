# MotionGlass V15 — Stable Sharp Hero

## Fixes
- Hero desktop geometry is fixed with a 21:9 render box so slide copy cannot resize the banner.
- Typewriter heading reserves the tallest multi-line state; description, CTA row and pills reserve stable heights as well.
- Hero copy and navigation controls are absolutely positioned inside the fixed hero shell, preventing layout reflow between slides.
- All hero imagery now uses responsive `srcset`/`sizes` with 1280, 1920, 2560 and 3840 variants.
- Hero variants are pre-cropped to the same 21:9 aspect ratio instead of allowing the browser to distort dimensions.
- Each hero image carries intrinsic 3840×1646 dimensions for stable browser layout calculation.
- Ken Burns and crossfade scaling were reduced further to protect fine detail.
- Parallax movement is transition-only and settles to one pixel-aligned composition after ~1s, avoiding persistent double-image softness.
- Overlay remains lighter and image filtering contains no brightness reduction.
- Mobile hero uses explicit fixed heights as well.

## Validation
- 105 TS/TSX files parsed with 0 syntax failures.
- Global CSS braces balanced.
- `dev1.sh` shell syntax passes.
- Backend route handler audit passes: 185 handlers.

## Local cache check
After switching builds, hard-refresh the browser (Ctrl/Cmd+Shift+R). If Next dev cache persists, stop the launcher, delete `Frontend/.next`, then run `./dev1.sh` again.
