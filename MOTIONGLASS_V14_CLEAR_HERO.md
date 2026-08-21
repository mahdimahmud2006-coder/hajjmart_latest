# MotionGlass V14 — Clear Hero

Hero clarity changes applied in `Frontend/src/app/globals.css`:

- Reduced desktop hero overlay gradient opacity from 0.78/0.56/0.18/0.06 to 0.45/0.28/0.10/0.04.
- Reduced the secondary bottom overlay to 0.24.
- Removed brightness suppression from base hero images; images now use `saturate(1.05) contrast(1.05)`.
- Removed brightness suppression from parallax back layers.
- Reduced Ken Burns end scale from 1.08 to 1.04.
- Reduced parallax back/front end scales to 1.035 / 1.04 and reduced translation amplitude.
- Lightened the mobile hero overlay proportionally.
- Existing transition choreography and typewriter effects were preserved.

Validation: `validate-project.sh` passed all source checks and 185 route-handler audits. Next.js build was skipped because frontend dependencies are not installed in the clean source environment.
