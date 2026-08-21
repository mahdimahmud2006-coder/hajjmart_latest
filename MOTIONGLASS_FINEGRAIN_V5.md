# MotionGlass FineGrain V5

This refinement is based on the V4 glitch-fixed storefront.

## Changes in V5

### Top-only storefront navigation
- The white main storefront header is no longer sticky.
- The forest department/category strip remains in normal document flow.
- Both rows naturally leave the viewport as the customer scrolls down.
- The previous scroll listener that changed header state has been removed.

### Fine hover grain instead of coarse dots
- Removed the large radial dot pattern from desktop category hover states.
- Removed the persistent coarse emerald texture from the mobile drawer.
- Added `forest-grain-fine.jpg`, a lower-contrast fine green paper grain.
- Fine grain now appears primarily inside hovered/focused department and drawer items.
- Mega-menu glass stays clean by default; hovered links receive the subtle grain reveal.

### Softer light texture
- Added the user's softer ivory paper texture as `ivory-paper-fine.png`.
- Product rails, favourites, editorial, shop and collection backgrounds use the fine paper texture instead of the coarse speckled stone texture.

### Slow product reveal
- Product grid cards now reveal with a slower staggered clip/slide/scale animation.
- Best-seller rail cards reveal progressively from left to right.
- Reveal remains bright and consistent with the HajjMart theme; no dark page treatment is added.
- Existing hover zoom, wishlist, cart and product links remain unchanged.
- Reduced-motion users receive instant, stable product presentation.

## Validation
- `validate-project.sh` passes.
- 185 backend route handlers mapped.
- 105 TS/TSX files parse with zero syntax errors.
- CSS braces balanced.
- `dev1.sh` shell syntax passes.
