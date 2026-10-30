# Modello ottico per Ice Glass

## Coordinate e geometria

Lavora in coordinate pixel o normalizzate coerenti. Per una card arrotondata usa una signed distance function:

```glsl
float sdRoundBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}
```

Deriva la normale dal gradiente della SDF con differenze centrali. Mantieni `epsilon` proporzionale al pixel, per esempio `1.0 / min(resolution.x, resolution.y)` in coordinate normalizzate.

## Rifrazione e spessore

La legge di Snell è `n1 * sin(theta1) = n2 * sin(theta2)`. In GLSL usa:

```glsl
vec3 transmitted = refract(-viewDir, normal, nAir / nGlass);
```

Per vetro scuro da interfaccia parti da `nGlass = 1.31`. Simula lo spessore con un offset di campionamento proporzionale alla componente tangenziale del raggio trasmesso:

```glsl
vec2 refractOffset = transmitted.xy * thicknessPx / resolution;
```

Limita l'offset per evitare sdoppiamenti innaturali. Lo spessore percepito deve crescere vicino al bordo e restare più calmo al centro.

## Fresnel

Usa l'approssimazione di Schlick:

```glsl
float f0 = pow((nAir - nGlass) / (nAir + nGlass), 2.0);
float fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);
```

Fresnel rinforza i bordi radenti. Non usarlo come alone uniforme intorno alla card.

## Dispersione cromatica

Usa indici leggermente diversi per i tre canali, per esempio `1.305`, `1.315`, `1.325`. Campiona l'ambiente con tre offset rifratti e ricomponi RGB. Mantieni la separazione sotto 1–2 px alla scala nominale: deve emergere sui bordi e sui punti di maggiore curvatura.

## Assorbimento

Per vetro scuro usa Beer-Lambert:

```glsl
vec3 transmittance = exp(-absorption * opticalPathLength);
```

Valori iniziali moderati: `absorption = vec3(0.08, 0.045, 0.03)`. Modula il cammino ottico con spessore e angolo, evitando di annerire il centro.

## Highlight speculare

Per un materiale compatto usa GGX:

```glsl
float distributionGGX(float nDotH, float roughness) {
  float a2 = pow(roughness, 4.0);
  float d = nDotH * nDotH * (a2 - 1.0) + 1.0;
  return a2 / max(3.14159265 * d * d, 1e-4);
}
```

Combina GGX con Fresnel e attenuazione della luce. Per Ice Glass prova `roughness` tra `0.12` e `0.28`. La luce del cursore deve deformarsi secondo normale e bordo, non apparire come un cerchio sovrapposto.

## Attenuazione globale

Calcola la distanza del cursore dal rettangolo arrotondato, non soltanto dal centro:

```glsl
float reach = 620.0;
float attenuation = pow(clamp(1.0 - distancePx / reach, 0.0, 1.0), 1.5);
```

Usa la stessa sorgente globale per tutte le card e applica l'attenuazione per card. Mantieni un contributo ambientale debole anche quando la luce è lontana.
