---
name: daylight-glass-parallax
description: Riproduce vetro trasparente bombato da riferimento fotografico, con bordo lucidato verde acqua, ombra trasmissiva, caustiche geometriche e testi su un piano intermedio senza distorsione del DOM.
---

# Daylight glass and intermediate content plane

Use with the existing ice-glass-shader and visual-glass-testing skills. This
project-specific material applies only to Today in light mode. Keep the existing
dark material and other views. The user's current choices supersede older
instructions about a cursor light or keeping every label on the base.

## Optical and interaction contract

- Preserve layout and real selectable, accessible DOM content.
- Reference: clear shallow convex slab, rounded corners, a narrow teal seam,
  multiple polished edge interfaces, broad soft window reflection, clear centre.
- One fixed natural source above and to the left. Its transmitted rays and cast
  shadow must travel down/right in page coordinates. Cursor controls height only.
- Glass advances in Z. Text and icons advance by exactly half its Z distance.
  Images, charts and decorative diagrams stay on the base. Project both planes
  with `P / (P - z)`, around the same card centre. This is perspective parallax,
  **not optical refraction of text**. No SVG displacement or DOM rasterization.
- Derive caustics from Snell rays crossing the curved top and flat underside,
  then intersecting the receiving plane. Estimate flux concentration from the
  projected/source area ratio; bound highlights and account for Fresnel losses.
  This is a planar-receiver approximation, not full scene path tracing.
- Use the same height, profile and source for the material, shadow and caustics.
  Do not add animated noise, random decorative lines, or a separate light source.
- Weak transmitted shadow and bright caustics coexist. Keep the shadow light;
  clear glass does not cast an opaque grey copy of the entire card.

## Integration and performance

Reuse the shared WebGL context and animation clock. No render loop/context per
card, no new runtime dependency, no screenshot capture of DOM. Cache label
geometry on layout invalidation, never on pointer movement. Ignore only renderer
owned style mutations. Stop when lift settles and nothing else is animated.
Respect reduced motion, hidden documents, context restoration and CSS fallback.

Verify shader compilation, half-height ratio, stationary chart geometry, absence
of SVG filters on Today content, real controls, both themes, scrolling, mobile,
and idle draw count. Report headless frame timings as environment-specific.
Attempt WebKit; report its exact availability rather than claiming Safari parity.

## Sources consulted

- [PBRT: Dielectric BSDF](https://pbr-book.org/4ed/Reflection_Models/Dielectric_BSDF)
- [NVIDIA GPU Gems: Rendering Water Caustics](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics)
- [MDN: perspective](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/perspective)

GPU Gems explicitly describes its final technique as aesthetics-driven. Reuse
the explanation of Snell transport and receiver intersections, not a claim that
the chapter's approximate sun-map method is a physical simulation.
