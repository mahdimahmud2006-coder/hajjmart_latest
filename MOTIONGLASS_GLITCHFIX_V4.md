# MotionGlass Glitch Fix V4

This build fixes the exact regressions reported from the AutoHide build.

## 1. Department strip flicker removed

The desktop department/category bar is no longer collapsed by JavaScript at a `scrollY` threshold.

Instead:
- the main HajjMart header remains sticky;
- the department strip sits in normal document flow below it;
- as the page scrolls, the department strip naturally scrolls out of view;
- there is no sticky-header height mutation, so the hero/content no longer jumps when the strip disappears.

## 2. Mega menus refined

Desktop department popups now use:
- translucent forest glass;
- backdrop blur and saturation;
- emerald grain texture;
- gold granular hover reveals;
- immediate opening with a short close grace period;
- a small invisible hover bridge so moving from the tab into the popup does not cause flicker.

## 3. Mobile sidebar rebuilt as glass

The mobile navigation is no longer a plain white sheet.

It now uses:
- translucent forest glass;
- 30px backdrop blur;
- emerald grain overlay;
- gold border/highlights;
- rounded right edge;
- glass logo header;
- gold granular link hover/focus reveals;
- gold separators and a glass HajjMart Care footer.

## 4. Hero/banner image set replaced

The old hero sources under `motion-v2` / `refined-v3` are no longer used by the homepage hero.

The hero now uses the newer wide landscape imagery copied to:

`Frontend/public/images/hero-v4/`

including:
- `madina-courtyard-sunset.jpg`
- `madina-lantern-sunset.jpg`
- `kaaba-golden-hour.jpg`
- `kaaba-mountain-golden-hour.jpg`

Additional detail imagery is used by homepage campaign banners.

## 5. Hero motion changed

The hero now:
- advances automatically every 7.6 seconds;
- crossfades between wide images;
- gently pans each active image from left to right;
- uses `object-fit: cover` so artwork is cropped rather than flattened;
- resets the auto timer after a manual selection;
- keeps small manual controls only as a fallback.

## Validation

- TypeScript/TSX syntax parse: 105 files, 0 failures
- CSS braces balanced
- `dev1.sh` shell syntax passed
- Backend API route handler audit: 185 handlers passed
