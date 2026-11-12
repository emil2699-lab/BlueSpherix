# Glass rendering: performance audit

## Findings

The glass renderer is shared by all dashboard sections. Pointer and transition
events therefore affected pages outside Today, even though their components
had not changed. This was a rendering cost, not a JavaScript exception.

- Daylight retained ten SVG content filters on Today at rest. Every pointer
  frame also redrew the material of every card in the overscanned canvas.
- A first hover traced an inverse optical map synchronously on the UI thread.
- Safari's html2canvas capture cloned the dashboard document, including hidden
  sections, to render just one card. The baseline test recorded 1,428 computed
  style reads and long tasks exceeding one second in this path.
- The 64ms integration clamp stretched lift/return animations when real frame
  intervals were much longer. Rendering continued long after pointer exit.
- All CSS transitions triggered a 700ms layout-settling loop, including color
  changes that could not move a surface. Canvas style changes and optical
  definitions could also trigger unnecessary observer work.
- The previous resolution adaptation excluded frame intervals above 120ms,
  precisely when the application was most overloaded.

## Implemented changes

1. Cache material pixels in one shared framebuffer texture. Repaint damaged
   regions and intersecting neighbours, then blit the result to the canvas.
   This preserves overlapping glass and caustics; it uses no per-card contexts.
2. Keep daylight rendering idle when pointer movement stays within the same
   settled card. The room light is fixed, so that movement changes no optics.
   Release content filters when the lens returns to its base; the material
   itself stays visible at rest.
3. Trace lens fields in one lazy worker, transfer their buffers, and cache up
   to sixteen profiles. Both browser paths use the same unchanged optical math.
4. Capture Safari content in an isolated document containing the card, its
   ancestor selectors and styles. Keep live controls in the original document.
   Defer a new capture until the lift has nearly settled and serialize captures.
5. Reuse measured geometry during pointer frames. Ignore hidden sections and
   optical-definition mutations when scanning controls. Only transitions that
   can affect geometry start layout settling.
6. Reuse the current overscan tile while document scrolling changes only its
   screen offset. Re-measure on tile changes and nested scroller changes.
7. Limit dynamic lighting updates to the visible area plus a small margin.
   Bound the material backing store to 4,194,304 pixels. Where available, use
   asynchronous GPU timings to lower material resolution after repeated slow
   samples; keep the existing frame-based fallback for other browsers.
8. Integrate lift using real elapsed time, and recreate optical resources after
   material context restoration. Pointer input uses one coalesced event stream.

Card dimensions, layout, full-lift calibration, optical field equations and
material shaders are unchanged. The intentional visual/performance tradeoff is
that resting daylight text no longer receives a permanent displacement filter.

## Verification and limits

Measured with Chromium/ANGLE SwiftShader at 1280×800, DPR 1. This is software
rendering, not the user's Mac GPU. The WebKit branch is selected with a Safari
user agent; this does not constitute a real Safari engine test.

- Settled daylight hover with continuous pointer motion: **zero draw calls**,
  p95 frame interval approximately **16.7–16.8ms**, in both browser paths.
- After exit: no active optical plane and **zero draw calls** in the observed
  idle window. The baseline still drew forty material quads in the same test.
- Isolated Safari capture: **39 computed-style reads**, versus 1,428 before.
  Its first comparison reduced the largest observed long task from over a
  second to 125ms. Cold capture/upload still has a measurable cost.
- Navigation through Today, Portfolio, Analytics, Operations, Risk, Lab,
  Journal and Calendar, scrolling, theme changes and 390px resizing passed
  browser checks without page errors. DOM card bounds stayed fixed on hover.
- Numerical optics checks, shader compilation checks, lint, TypeScript and
  normal/GitHub Pages production builds passed. Lint retains the pre-existing
  unused `basename` warning in the skill validator.

Continuous transitions and moving dark-room lighting still exceed a 16.7ms
budget in SwiftShader. Do not extrapolate the settled-hover result to every
animation or claim universally constant 60fps. Real WebKit could not launch
because the runtime lacks `libharfbuzz-icu.so.0`; verify on Safari/macOS before
claiming Safari performance parity. No battery discharge was measured.

## Next optimization priorities

1. Profile real Safari/macOS and Chromium at the target display DPR, separating
   UI work, GPU time, DOM filtering and texture upload. Target p95 frame time,
   not average FPS alone.
2. Split the dark material's cached ambient contribution from the moving-light
   contribution. This is the main remaining GPU cost. Validate pixel output
   before restricting expensive optical calculations to the illuminated rim.
3. Offer an explicit energy-saving quality setting for slower devices. Adjust
   material resolution and secondary optical detail while keeping DOM text
   sharp, hit targets fixed and the lens calibration unchanged.
