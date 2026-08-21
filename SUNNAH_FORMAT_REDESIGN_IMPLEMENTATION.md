# HajjMart — Sunnah-Format Storefront Redesign

## Scope
This build redesigns the customer-facing HajjMart storefront around the structural pattern language observed on thesunnah.store while preserving HajjMart functionality, data contracts, product catalogue, brand assets, forest/gold palette, and all admin/POS/ECM systems.

No Sunnah Store images, copy, video, or brand assets are included.

## Major storefront changes
- Rebuilt desktop header into a centered-brand, department-first commerce header.
- Added per-department full-width mega menus using HajjMart's real category hierarchy.
- Kept live search, recent searches, account, wishlist and cart controls.
- Rebuilt home hero as a full-bleed image-led merchandising banner with one primary CTA.
- Added two alternating campaign/promo banners using existing HajjMart homepage content/assets.
- Kept a horizontal best-seller rail using HajjMart product data.
- Reworked quick collection shortcuts into compact square collection tiles.
- Added a large lifestyle/brand campaign banner.
- Restyled the favourites product grid with flatter, more editorial product cards.
- Added a brand-purpose split section.
- Restyled the preparation journal/editorial rail and newsletter capture.
- Rebuilt the footer into a clean four-column Shop / Information / Support / Legal structure.
- Restyled `/shop` into a restrained collection catalogue with horizontal category shortcuts.
- Restyled `/category/[slug]` into an image-led collection header with subcategory tabs.
- Flattened cart drawer, product detail controls, filters, badges and buttons to match the new storefront language while preserving their behavior.
- Kept the existing non-blocking cart cross-sell, checkout, wishlist, recently-viewed, customer account, order tracking and wholesale pricing behavior.

## New component
- `Frontend/src/components/home-promo-banners.tsx`

## Main files rewritten/updated
- `Frontend/src/components/site-chrome.tsx`
- `Frontend/src/components/site-header.tsx`
- `Frontend/src/components/home-hero.tsx`
- `Frontend/src/components/home-page.tsx`
- `Frontend/src/components/site-footer.tsx`
- `Frontend/src/app/shop/page.tsx`
- `Frontend/src/app/category/[slug]/page.tsx`
- `Frontend/src/app/globals.css`
- `validate-project.sh`

## Validation
- Project validator: PASS
- Route handler audit: 185 handlers
- TS/TSX syntax/transpile parse: 99 files, 0 errors
- PHP syntax checks: PASS
- JSON/package-lock consistency: PASS
- Clean distributable checks: PASS

Full Next.js production compilation is skipped in the clean source archive because `node_modules` is intentionally not bundled. `dev1.sh` installs dependencies on first run.
