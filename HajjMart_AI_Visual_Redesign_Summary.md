# HajjMart AI Visual / Videography Redesign Summary

## What was changed

This pass restructures the storefront to follow the reference site's product-first, editorial visual rhythm more closely while preserving HajjMart functionality.

### Frontend changes
- Rebuilt the homepage hero into a **cinematic full-width video hero** with autoplay motion reels.
- Added a **featured scenes panel** with slide switching and visual scene thumbnails.
- Added a **Cinematic Storytelling / Journey Media** section with two autoplay motion reels and two image-led editorial cards.
- Reworked homepage promotional banners to use the supplied sacred imagery.
- Reworked quick-link tiles to use curated Hajj / Umrah image-led shortcuts.
- Updated journal / guide card imagery to use the supplied Madina / Makkah / lantern / calligraphy visuals.
- Reworked the newsletter block into an image-backed atmospheric CTA section.
- Updated the “Why HajjMart” section to reflect the richer image-led experience.

### Preserved functionality
- Existing product catalogue and category routing
- Search
- Cart / cart drawer
- Wishlist
- Account
- Checkout
- Order tracking
- Retail / wholesale flows
- Existing backend / admin / POS / ECM logic

## New assets added

### Images copied into
`Frontend/public/images/sacred/`

Included:
- green-dome-arch.jpg
- kaaba-crowd-painting.jpg
- madina-street-painting.jpg
- kaaba-door-view.jpg
- calligraphy-detail.png
- blue-dome-watercolor.jpg
- makkah-clocktower-painting.jpg
- lantern-painting.jpg
- madina-sketch.jpg
- kaaba-cave-view.jpg

### Video reels generated into
`Frontend/public/videos/`

Included:
- journey-reel-madina.mp4
- journey-reel-makkah.mp4

These are motion reels created from the supplied imagery and used as cinematic homepage media.

## Files added / updated

### Added
- `Frontend/src/lib/sacred-media.ts`
- `Frontend/src/components/journey-media-showcase.tsx`
- `Frontend/public/images/sacred/*`
- `Frontend/public/videos/journey-reel-madina.mp4`
- `Frontend/public/videos/journey-reel-makkah.mp4`

### Updated
- `Frontend/src/components/home-hero.tsx`
- `Frontend/src/components/home-page.tsx`
- `Frontend/src/components/home-promo-banners.tsx`
- `Frontend/src/components/quick-link-tiles.tsx`
- `Frontend/src/components/newsletter-capture.tsx`
- `Frontend/src/lib/guides.ts`
- `Frontend/src/app/globals.css`

## Notes
- This pass focuses on making the storefront feel significantly more visual, premium and faithful to the design direction requested.
- Backend and commerce logic were intentionally preserved.
