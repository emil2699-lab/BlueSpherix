/** Optical calibration in CSS pixels. No temporal interpolation of the light. */
export const ICE_GLASS = {
  glassIOR: 1.5,
  glassThickness: 14,
  // Match the shallow convex section of the calendar's reference notice.
  daylightThickness: 12,
  // Travel along the viewer-facing Z axis; perspective affects glass only.
  daylightLift: 48,
  daylightPerspective: 900,
  // The approved convex-lens prototype, scoped to the Today dashboard.
  todayRadius: 56,
  todayThickness: 18,
  todayLift: 82,
  todayPerspective: 1100,
  todayParaxial: .075,
  glassRoughness: .21,
  glassOpacity: .58,
  glassBodyOpacity: .14,
  ambientReflection: .055,
  lightIntensity: 1.95,
  lightHeight: 48,
  lightFalloff: 340,
  fresnelStrength: .8,
  chromaticDispersion: .05,
  edgeRefraction: .88,
  internalReflection: .22,
  specularSharpness: 38,
  bloomIntensity: .12,
  bloomRadius: 4,
  cursorSmoothing: 0,
  maxBounces: 2,
  maxDPR: 2,
} as const;
