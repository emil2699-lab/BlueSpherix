# Today: clear glass and intermediate labels

Implemented from the user's photographic reference and choices: Today only,
light mode only; text/icons at half the glass height; charts/images on the base;
soft transmitted shadow plus caustics. Based on restored `0e6bf17`.

The latest material-only revision restores the visible soap from `3f3fcd6`:
56 px rounded corners and its original soft rim, shoulder, crown and polished
lip equations. The 48 px glass / 24 px label animation, dashboard palette,
shadow softness and caustic intensity remain those of `f30afa0`.
The subsequent corner correction uses the same measured 56 px CSS radius for
the visible contour, shadow SDF and caustic source mesh/mask. Every pass clamps
it to 47.5% of the smaller card dimension, including the narrow notice/strip.
The caustic field follows the corrected corners; lighting, motion and colour
parameters remain unchanged.

## Rendering

- `app/daylight-glass.ts`: the restored soft teal rim, rounded convex shoulder,
  Fresnel reflection, a nearly clear face, and a weak transmitted shadow.
- The fixed daylight direction is `(-.38, -.56, 1.4)`, above/left, with angular
  radius `.045`. Shadow and caustics travel according to this same source.
- The glass advances 48 CSS px, with perspective distance 900 px. Labels advance
  exactly 24 px at full hover, using the same continuous lift clock and card
  centre. The projected scales differ according to `P / (P - z)`; the screen-space
  enlargement is therefore not an arbitrary 50% scale multiplier.
- `app/daylight-parallax.ts` moves real DOM label/icon groups. Charts and images
  are excluded. Today does not use the previous SVG displacement filter or a DOM
  screenshot. Text stays selectable and controls keep their native behaviour.
- A mesh traces daylight through the convex upper surface and flat underside
  with Snell refraction and Fresnel losses. Receiver/source differential area
  determines flux concentration. Three source samples plus spatial filtering
  soften focused paths. The receiving field extends beyond the source card.
- The shared WebGL context caches each card's caustic field by geometry and
  elevation. Stationary cards reuse their texture. Text is never rasterized.
  Rendering stops at settled hover/rest; Today DPR is capped at 1.25.

This is a physically inspired 2.5D rendering. The underside and caustic receiver
are planar approximations, highlights are display-bounded, and there is no full
scene path tracing or multiple transmission through neighbouring glass volumes.
Perspective movement of labels is intentionally **not** called optical text
refraction.

## Verification

- Corner correction: instrumented WebGL draws confirm matching glass/caustic
  radii at 1440×1000 and 390×844, including the smaller radius clamped for short
  cards. The shadow uses the glass's exact SDF radius. No browser runtime errors.
- Previous material-only revision (`f696746`): isolated GPU comparison with `3f3fcd6` produces
  identical RGBA pixels at three card sizes and three lift states. The same
  comparison confirms the shadow is identical to `f30afa0` (18 comparisons,
  zero changed channels). Caustic shaders/cache and motion parameters are
  unchanged at source level. The later corner correction intentionally updates
  shadow/caustic geometry to match the restored glass.
- Production build including TypeScript: passed.
- Existing optical model checks and shader skill compilation: passed.
- Skill manifest/reference validation: passed.
- ESLint: no errors; existing unused `basename` warning in the skill validator.
- Chromium browser tests: label Z = 24 px; unchanged chart and card bounds;
  no Today content displacement filters; working range buttons and navigation;
  dark theme, scrolling, mobile, reduced motion, no-WebGL fallback and context
  loss/restoration.
- Previous `f696746` caustic ablation at 1440×1000: disabling only the equity card's caustic
  composite changed 9,613 brightened pixels inside and 2,533 outside its original
  bounds (RGB-sum difference greater than 12).
- Dark baseline/new screenshot comparison at 1440×1000: all 4,320,000 RGB
  channels identical, with reduced motion enabled in both captures.
- Settled hover: zero WebGL draw calls over one second; headless frame p95
  about 16.7 ms. This does not establish a 60 fps animation guarantee or measured
  battery savings. Software-GPU startup/route changes produced long tasks.
- Safari user-agent selection was exercised under Chromium. Real Playwright
  WebKit was attempted but could not launch: missing `libharfbuzz-icu.so.0`
  (and `libhyphen.so.0` in dependency inspection). Actual Safari/macOS appearance
  and performance remain to be checked.

## Skills and research

Reused `ice-glass-shader` and `visual-glass-testing`. Installed the project-local
`daylight-glass-parallax` skill; it records the revised interaction and links to
PBRT, NVIDIA GPU Gems and MDN. The external skills examined were
`Na2H2P2O7/liquid-glass-skill` and `dabit3/liquid-glass-web-skill`; neither was
installed because their backdrop-capture/displacement or frosted-control
workflows do not match this request. No runtime dependency was added.
