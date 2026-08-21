# MotionGlass Purpose Type V7

This refinement preserves the previously approved hero/banner motion while fixing the Why HajjMart section and transition timing.

## Changes
- Fixed invisible text in the light `Why HajjMart` panel by explicitly restoring forest/dark text contrast.
- Added viewport-triggered heading typewriter animation.
- Added a short decode/scramble animation to the `WHY HAJJMART` eyebrow.
- Added a blinking type cursor.
- Added three subtle sequential gold pulse dots under the heading.
- Body copy and `Our story` link now reveal after the title without a long pause.
- Reduced hero crossfade and copy-animation delays so image/text overlap feels continuous rather than stalled.
- Added frontend filtering for any legacy homepage section whose content matches `Prepare your bag`, `question before checkout`, or `keep your packing simple`, removing that old care CTA from homepage-configured content.
- Existing product reveal / scroll-story effect is unchanged.

## Validation
- Project validator passed.
- Backend route-handler audit: 185 handlers.
- 104 TS/TSX files parsed with 0 syntax failures.
- CSS brace balance passed.
- `dev1.sh` shell syntax passed.
