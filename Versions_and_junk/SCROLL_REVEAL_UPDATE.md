# Storefront scroll-linked reveal

The homepage's "Preparation, organised beautifully." section now uses a scroll-linked category reveal inspired by the supplied reference recording.

## Behaviour

- The section pins to the viewport while the first three journey/category cards rise into place.
- Animation progress is derived directly from the section's real document scroll progress. Faster scrolling therefore advances the reveal faster and slower scrolling advances it slower.
- There is no embedded/autoplay video.
- The scene uses HajjMart's forest, deep-green, gold and ivory visual language.
- The card content remains real HajjMart category data and links to the existing category pages.

## Performance

The implementation intentionally avoids an animation dependency. A passive scroll listener schedules one `requestAnimationFrame`, and only `transform` and `opacity` are updated on the three animated wrappers. It does not update React state while scrolling. Motion is disabled for `prefers-reduced-motion`, and small screens fall back to a normal stacked layout for usability.
