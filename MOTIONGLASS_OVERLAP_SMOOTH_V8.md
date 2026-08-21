# MotionGlass V8 — Overlap / Transition Smoothing

This build fixes the transition overlap shown in the supplied screencast and restores the five requested hero images as the active banner set.

## Hero transition
- Uses only the five user-supplied Makkah/Madina banner images in `Frontend/public/images/hero-v8/`.
- Keeps the existing hero dimensions.
- Incoming and outgoing frames now overlap for the same 1.08s transition window.
- Incoming frame slides/fades gently from the right while the outgoing frame fades slightly left.
- Removed the crossfade dead gap caused by relying only on active/inactive opacity state.
- Image drift is subtle and synchronized with the slide lifetime.
- Reduced the typography delay so typewriter, description and CTA start with the image instead of catching up afterward.
- Reduced the dark image overlay so the supplied imagery remains clearer.

## Editorial overlap fix
The supplied screencast showed the "Useful reading before the journey" cards visually colliding.

Root cause: each grid column could be ~270px wide while `.editorial-card` forced its own width up to 390px. Text and cards therefore overflowed into the next grid column during reveal.

Fixes:
- Reveal wrapper owns the grid-column width.
- Editorial cards are now `width: 100%` of their column.
- Desktop columns use a controlled `clamp(292px, 23vw, 372px)` width.
- Text is constrained to the card width and wraps safely.
- Staggered reveal remains, but uses a smoother 780ms light slide/reveal.
- Mobile cards use `min(82vw, 330px)` columns.

## Validation
- Project validator passed.
- Backend route audit passed: 185 handlers.
- 104 TS/TSX files parsed with 0 syntax/transpile failures.
- CSS brace balance: 0.
- `dev1.sh` shell syntax passed.

No database reset is required.
