#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;

float sdRoundBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

float environmentField(vec2 uv) {
  float waves = sin(uv.x * 13.0 + uTime * 0.15) * 0.08;
  waves += cos(uv.y * 17.0 - uTime * 0.1) * 0.06;
  return 0.32 + waves + uv.y * 0.08;
}

float distributionGGX(float nDotH, float roughness) {
  float a2 = pow(roughness, 4.0);
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;
  return a2 / max(3.14159265 * d * d, 0.0001);
}

void main() {
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (vUv * 2.0 - 1.0) * aspect;
  vec2 pointer = ((uPointer / uResolution) * 2.0 - 1.0) * aspect;

  vec2 halfSize = vec2(0.68 * aspect.x, 0.54);
  float radius = 0.16;
  float distanceToGlass = sdRoundBox(p, halfSize, radius);
  float pixel = 2.0 / min(uResolution.x, uResolution.y);
  float mask = 1.0 - smoothstep(-pixel, pixel, distanceToGlass);

  float dx = sdRoundBox(p + vec2(pixel, 0.0), halfSize, radius)
    - sdRoundBox(p - vec2(pixel, 0.0), halfSize, radius);
  float dy = sdRoundBox(p + vec2(0.0, pixel), halfSize, radius)
    - sdRoundBox(p - vec2(0.0, pixel), halfSize, radius);
  vec2 normal2 = normalize(vec2(dx, dy) + vec2(0.00001));
  vec3 normal = normalize(vec3(normal2 * 0.72, 1.0));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  float edge = 1.0 - smoothstep(0.0, 0.12, abs(distanceToGlass));
  float curvature = smoothstep(0.2, 0.0, -distanceToGlass);
  float thickness = mix(0.012, 0.034, max(edge, curvature * 0.35));

  vec3 refractedR = refract(-viewDir, normal, 1.0 / 1.305);
  vec3 refractedG = refract(-viewDir, normal, 1.0 / 1.315);
  vec3 refractedB = refract(-viewDir, normal, 1.0 / 1.325);
  vec3 refracted = vec3(
    environmentField(vUv + refractedR.xy * thickness),
    environmentField(vUv + refractedG.xy * thickness),
    environmentField(vUv + refractedB.xy * thickness)
  );

  float f0 = pow((1.0 - 1.315) / (1.0 + 1.315), 2.0);
  float fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);

  vec2 lightVector = pointer - p;
  float lightDistance = length(lightVector);
  vec3 lightDir = normalize(vec3(lightVector / max(lightDistance, 0.0001), 0.75));
  vec3 halfVector = normalize(lightDir + viewDir);
  float specular = distributionGGX(max(dot(normal, halfVector), 0.0), 0.2);
  float attenuation = pow(clamp(1.0 - lightDistance / 1.7, 0.0, 1.0), 1.5);

  vec3 base = vec3(0.025, 0.045, 0.065);
  vec3 absorption = exp(-vec3(0.08, 0.045, 0.03) * (0.8 + edge * 1.6));
  vec3 glass = mix(base, refracted * absorption, 0.48);
  glass += vec3(0.2, 0.72, 0.82) * fresnel * edge * 0.34;
  glass += vec3(0.22, 0.68, 0.72) * specular * attenuation * edge * 0.025;

  vec3 background = vec3(0.008, 0.014, 0.022);
  outColor = vec4(mix(background, glass, mask), 1.0);
}
