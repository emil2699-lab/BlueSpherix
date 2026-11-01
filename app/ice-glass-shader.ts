export const glassVertex = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uDPR;
uniform vec4 uRect;
void main() {
  vec2 corners[6] = vec2[6](vec2(0,0),vec2(1,0),vec2(0,1),vec2(0,1),vec2(1,0),vec2(1,1));
  vec2 pixel = uRect.xy+corners[gl_VertexID]*uRect.zw;
  vec2 clip = pixel*uDPR/uResolution*2.0-1.0;
  gl_Position = vec4(clip.x,-clip.y,0,1);
}`;

// One continuous 2.5D slab. The DOM remains sharp above this optical layer.
export const glassFragment = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uDPR;
uniform vec4 uRect;
uniform float uRadius;
uniform vec3 uTint;
uniform vec3 uLight;
uniform vec4 uGlass; // IOR, thickness, roughness, opacity
uniform vec4 uOptics; // Fresnel, dispersion, refraction, internal reflection
uniform vec4 uEnergy; // ambient, intensity, light height, falloff
uniform vec3 uFinish; // sharpness, bloom intensity, bloom radius
uniform vec4 uSecondary; // previous slab exit and refracted direction
uniform float uSecondaryEnergy;

float boxSDF(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r;
}
vec2 roundedSurfaceNormal(vec2 p, vec2 b, float r) {
  vec2 q = abs(p)-b+r;
  if (q.x > 0.0 && q.y > 0.0) return normalize(q)*sign(p);
  return q.x > q.y ? vec2(sign(p.x),0.0) : vec2(0.0,sign(p.y));
}
vec2 innerFaceWeights(vec2 p, vec2 b, float softness) {
  vec2 faceDistance = max(b-abs(p),vec2(.001));
  float nearest = min(faceDistance.x,faceDistance.y);
  return exp(-(faceDistance-vec2(nearest))/softness);
}
vec2 continuousInnerNormal(vec2 p, vec2 b, float softness) {
  // Both adjacent faces contribute through continuous weights. There is no
  // nearest-face switch when the cursor crosses a diagonal medial axis.
  vec2 weights = innerFaceWeights(p,b,softness);
  vec2 softSign = p/sqrt(p*p+vec2(softness*softness*.04));
  vec2 field = softSign*weights;
  return field/sqrt(dot(field,field)+.000001);
}
float continuousInnerDepth(vec2 p, vec2 b, float softness) {
  vec2 faceDistance = max(b-abs(p),vec2(0.0));
  vec2 weights = innerFaceWeights(p,b,softness);
  // A normalized weighted average preserves the local depth at equal-distance
  // diagonals instead of creating a bright or dark ridge there.
  return dot(faceDistance,weights)/max(weights.x+weights.y,.0001);
}
vec3 environment(vec3 ray) {
  float sky = smoothstep(-.55,.72,ray.y);
  float cool = pow(max(0.0, .5 + .5 * ray.x), 2.4);
  return vec3(.008,.016,.024) + vec3(.025,.055,.085)*sky + vec3(.010,.026,.044)*cool;
}
float rayConcentration(vec2 surface, vec3 ray, float pathLength) {
  // Follow the refracted ray to the receiving plane inside the slab. The
  // Jacobian of this map measures the actual contraction of a ray bundle.
  // Its zeros move with incidence, local curvature and wavelength; no UV band
  // or prescribed focal depth is involved. Finite aperture regularizes folds.
  vec2 landing = surface + ray.xy/max(-ray.z,.12)*pathLength;
  vec2 dx = dFdx(landing)*uDPR;
  vec2 dy = -dFdy(landing)*uDPR;
  float determinant = dx.x*dy.y-dx.y*dy.x;
  float footprint = dot(dx,dx)+dot(dy,dy);
  float aperture = .16 + uGlass.z*.35;
  return exp(-determinant*determinant/(aperture*aperture)) /
    sqrt(1.0+footprint*.12);
}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x/uDPR, (uResolution.y-gl_FragCoord.y)/uDPR);
  vec2 halfSize = uRect.zw*.5;
  vec2 p = pixel-uRect.xy-halfSize;
  float d = boxSDF(p,halfSize,uRadius);
  float aa = 1.25/uDPR;
  float coverage = 1.0-smoothstep(-aa,0.0,d);
  float depth = -d;
  float thickness = min(uGlass.y, min(halfSize.x,halfSize.y)*.25);
  // Keep the exact rounded silhouette, but move all optical shading onto a
  // continuous face blend before the box SDF reaches its diagonal medial axes.
  float normalSoftness = max(9.0,thickness*1.35);
  float blendEnd = max(3.0,min(uRadius*.55,thickness*.5));
  float interiorBlend = smoothstep(.75,blendEnd,depth);
  vec2 surfaceNormal = roundedSurfaceNormal(p,halfSize,uRadius);
  vec2 innerNormal = continuousInnerNormal(p,halfSize,normalSoftness);
  vec2 grad = mix(surfaceNormal,innerNormal,interiorBlend);
  grad /= max(length(grad),.001);
  float opticalDepth = mix(depth,continuousInnerDepth(p,halfSize,normalSoftness),interiorBlend);
  float bevel = exp(-opticalDepth/max(thickness,1.0));
  // A stable, low-frequency liquid normal varies the optical path, not the DOM.
  float phaseA = p.x*.018+sin(p.y*.023)*1.4;
  float phaseB = p.y*.016+p.x*.009;
  float wave = sin(phaseA)*sin(phaseB);
  // The height field is fixed in space: its gradient bends the local normal.
  vec2 waveGradient = vec2(
    .018*cos(phaseA)*sin(phaseB)+.009*sin(phaseA)*cos(phaseB),
    .0322*cos(p.y*.023)*cos(phaseA)*sin(phaseB)+.016*sin(phaseA)*cos(phaseB)
  );
  float slope = .76*bevel*(1.0+.075*wave);
  vec2 normalXY = grad*slope + waveGradient*3.2*bevel;
  vec3 N = normalize(vec3(normalXY,sqrt(max(.015,1.0-dot(normalXY,normalXY)))));
  float surfaceHeight = thickness*(1.0-bevel);
  // A distant observer gives a gentle perspective, stable under page zoom.
  vec3 V = normalize(vec3(uResolution/uDPR*.5-pixel,2400.0));
  vec3 delta = vec3(uLight.xy-pixel,uEnergy.z-surfaceHeight);
  float distanceXY = length(delta.xy);
  vec3 L = normalize(delta);
  vec3 H = normalize(L+V);
  float attenuation = 1.0/(1.0+pow(distanceXY/uEnergy.w,2.0)*3.0);
  attenuation *= 1.0-smoothstep(uEnergy.w*1.75,uEnergy.w*2.75,distanceXY);
  attenuation *= uLight.z;
  float ndl = max(dot(N,L),0.0);
  float ndh = max(dot(N,H),0.0);
  float f0 = pow((uGlass.x-1.0)/(uGlass.x+1.0),2.0);
  float fresnel = f0+(1.0-f0)*pow(1.0-max(N.z,0.0),5.0);
  float a2 = pow(uGlass.z,4.0);
  float denominator = ndh*ndh*(a2-1.0)+1.0;
  float ggx = a2/max(3.141593*denominator*denominator,.0001);
  float specular = min(ggx*.06,1.4) + pow(ndh,uFinish.x)*.19;
  float edge = exp(-opticalDepth/(thickness*.74));
  float shoulder = exp(-pow((opticalDepth-thickness*.72)/(thickness*.58),2.0));
  vec3 transmittedR = refract(-L,N,1.0/(uGlass.x-uOptics.y));
  vec3 transmittedG = refract(-L,N,1.0/uGlass.x);
  vec3 transmittedB = refract(-L,N,1.0/(uGlass.x+uOptics.y));
  vec3 refracted = vec3(environment(transmittedR).r,environment(transmittedG).g,environment(transmittedB).b);
  // Two traversals through the slab, plus the existing internal reflection
  // contribution. Each wavelength has its own landing map and concentration.
  float pathLength = thickness*(2.0+uOptics.w*2.0);
  vec3 caustic = vec3(rayConcentration(pixel,transmittedR,pathLength),
    rayConcentration(pixel,transmittedG,pathLength),
    rayConcentration(pixel,transmittedB,pathLength));
  if (coverage <= 0.0) discard;
  vec2 tangent = vec2(-grad.y,grad.x);
  float facing = .11+.89*max(dot(N.xy,normalize(delta.xy+vec2(.001))),0.0);
  float light = attenuation*uEnergy.y*facing;
  float alongEdge = dot(delta.xy,tangent) + wave*thickness*.85;
  float sourceFocus = exp(-pow(alongEdge/(uEnergy.z*.72),2.0));
  float whiteCore = pow(attenuation,4.2)*sourceFocus*edge;
  vec2 secondaryDelta=pixel-uSecondary.xy;
  float travel=dot(secondaryDelta,uSecondary.zw);
  float deviation=abs(secondaryDelta.x*uSecondary.w-secondaryDelta.y*uSecondary.z);
  float beamWidth=14.0+max(travel,0.0)*.045+wave*3.0;
  float bounced=uSecondaryEnergy*uLight.z*smoothstep(-beamWidth,beamWidth,travel)*
    exp(-pow(deviation/max(beamWidth,2.0),2.0))*exp(-max(travel,0.0)/360.0);
  vec3 tint = mix(vec3(.48,.70,1.0),uTint,.22);
  vec3 absorption = exp(-vec3(.09,.06,.035)*thickness*.12);
  vec3 ambient = environment(normalize(vec3(p/max(halfSize,vec2(1.0))*.18,1.0)));
  float frontSpread = attenuation*(.20+.80*max(dot(N,L),0.0));
  vec3 face = ambient*(1.75+.35*(1.0-bevel)) + uTint*.018;
  face += refracted*frontSpread*(.12+.18*(1.0-bevel))*absorption;
  face += mix(vec3(.32,.53,.78),uTint,.25)*attenuation*exp(-opticalDepth/(thickness*3.3))*.20;
  face += mix(vec3(.23,.36,.54),uTint,.45)*light*exp(-opticalDepth/(thickness*4.8))*.14;
  face += mix(vec3(.34,.55,.77),uTint,.35)*bounced*(.12+.24*bevel);
  face += vec3(.63,.76,.92)*attenuation*(1.0-bevel)*.035;
  vec3 edgeLight = light*(vec3(.93,.96,1.0)*specular + tint*shoulder*.18);
  float spectralReach = exp(-opticalDepth/(thickness*1.55));
  edgeLight += light*caustic*spectralReach*uOptics.z*1.15;
  edgeLight += bounced*caustic*spectralReach*.34;
  edgeLight += vec3(.92,.98,1.0)*whiteCore*.31;
  edgeLight += light*tint*edge*uOptics.w*.08;
  vec3 color = face + edgeLight*(.32+.68*edge);
  color *= .72 + uOptics.x*fresnel;
  // Premultiplied, full-card material: no CSS-like stroke or external glow.
  float alpha = clamp((.24 + max(max(color.r,color.g),color.b)*uGlass.w)*coverage,0.0,.72);
  outColor = vec4(color*alpha,alpha);
}`;
