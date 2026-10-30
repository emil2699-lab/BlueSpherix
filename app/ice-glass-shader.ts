export const glassVertex = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uDPR;
uniform vec4 uRect;
uniform vec4 uGlass;
void main() {
  // Four non-overlapping strips: never rasterize the flat, unlit center.
  float band = min(uGlass.y,min(uRect.z,uRect.w)*.125)*3.01;
  int side = gl_VertexID/6;
  vec4 strip = side==0 ? vec4(0,0,uRect.z,band) :
    side==1 ? vec4(0,uRect.w-band,uRect.z,band) :
    side==2 ? vec4(0,band,band,uRect.w-2.0*band) :
    vec4(uRect.z-band,band,band,uRect.w-2.0*band);
  vec2 corners[6] = vec2[6](vec2(0,0),vec2(1,0),vec2(0,1),vec2(0,1),vec2(1,0),vec2(1,1));
  vec2 pixel = uRect.xy+strip.xy+corners[gl_VertexID%6]*strip.zw;
  vec2 clip = pixel*uDPR/uResolution*2.0-1.0;
  gl_Position = vec4(clip.x,-clip.y,0,1);
}`;

// An analytic bevel and a procedural environment, not a capture of the DOM.
// Snell bends that environment per wavelength; HTML remains perfectly sharp.
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

float boxSDF(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r;
}
vec3 environment(vec3 ray) {
  float cool = pow(max(0.0, .5 + .5 * ray.x), 3.0);
  float warm = pow(max(0.0, .5 - .5 * ray.x), 4.0);
  return vec3(.025,.045,.075) + vec3(.055,.13,.23)*cool + uTint*.13*warm;
}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x/uDPR, (uResolution.y-gl_FragCoord.y)/uDPR);
  vec2 halfSize = uRect.zw*.5;
  vec2 p = pixel-uRect.xy-halfSize;
  float d = boxSDF(p,halfSize,uRadius);
  float aa = 1.0/uDPR;
  float coverage = 1.0-smoothstep(-aa,0.0,d);
  if (coverage <= 0.0) discard;
  float depth = -d;
  float thickness = min(uGlass.y, min(halfSize.x,halfSize.y)*.25);
  if (depth > thickness*3.0) discard;
  // Exact rounded-box gradient, including the corner arcs.
  vec2 q = abs(p)-halfSize+uRadius;
  vec2 grad = q.x>0.0 && q.y>0.0 ? normalize(q)*sign(p) :
    (q.x>q.y ? vec2(sign(p.x),0.0) : vec2(0.0,sign(p.y)));
  float bevel = clamp(1.0-depth/thickness,0.0,1.0);
  float slope = sin(bevel*1.48);
  vec3 N = normalize(vec3(grad*slope, sqrt(max(.015,1.0-slope*slope))));
  vec3 V = vec3(0,0,1);
  vec3 delta = vec3(uLight.xy-pixel,uEnergy.z);
  float distanceXY = length(delta.xy);
  vec3 L = normalize(delta);
  vec3 H = normalize(L+V);
  float attenuation = 1.0/(1.0+pow(distanceXY/uEnergy.w,2.0)*4.0);
  attenuation *= 1.0-smoothstep(uEnergy.w*2.0,uEnergy.w*3.0,distanceXY);
  attenuation *= uLight.z;
  float ndl = max(dot(N,L),0.0);
  float ndh = max(dot(N,H),0.0);
  float f0 = pow((uGlass.x-1.0)/(uGlass.x+1.0),2.0);
  float fresnel = f0+(1.0-f0)*pow(1.0-max(N.z,0.0),5.0);
  float a2 = pow(uGlass.z,4.0);
  float denominator = ndh*ndh*(a2-1.0)+1.0;
  float ggx = a2/max(3.141593*denominator*denominator,.0001);
  float specular = min(ggx*.075,2.5) + pow(ndh,uFinish.x)*.28;
  float edge = exp(-depth/(thickness*.65));
  float rim = exp(-pow((depth-.8)/.7,2.0));
  float innerRim = exp(-pow((depth-thickness*.83)/1.3,2.0));
  vec3 transmittedR = refract(-L,N,1.0/(uGlass.x-uOptics.y));
  vec3 transmittedG = refract(-L,N,1.0/uGlass.x);
  vec3 transmittedB = refract(-L,N,1.0/(uGlass.x+uOptics.y));
  vec3 refracted = vec3(environment(transmittedR).r,environment(transmittedG).g,environment(transmittedB).b);
  // Wavelength-dependent focus through the curved cross-section of the slab.
  float focus = depth/thickness + dot(transmittedG.xy,grad)*.42;
  float spread = uOptics.y*3.4;
  vec3 caustic = exp(-pow((vec3(focus)-vec3(.39+spread,.39,.39-spread))/.09,vec3(2)));
  float facing = .06+.94*max(dot(N.xy,normalize(delta.xy+vec2(.001))),0.0);
  float light = attenuation*uEnergy.y*facing;
  float alongEdge = dot(delta.xy,vec2(-grad.y,grad.x));
  float sourceFocus = exp(-pow(alongEdge/(uEnergy.z*.65),2.0));
  float whiteCore = pow(attenuation,4.0)*sourceFocus*
    exp(-pow((depth/thickness-.43)/.12,2.0));
  vec3 tint = mix(vec3(.40,.64,.96),uTint,.55);
  vec3 absorption = exp(-vec3(.09,.06,.035)*thickness*.12);
  vec3 color = tint*uEnergy.x*(rim*.7+edge*.3);
  color += light*(vec3(1.0,.96,.91)*specular*edge + tint*rim*.26);
  color += light*caustic*edge*uOptics.z*1.3;
  color += light*refracted*absorption*bevel*uOptics.z*.65;
  color += light*mix(uTint,vec3(.85,.92,1.0),.25)*edge*(.24+.4*ndl);
  color += vec3(.88,.97,1.0)*whiteCore*uEnergy.y*facing*.85;
  color += light*uTint*exp(-depth/(thickness*1.8))*.12;
  color += light*tint*innerRim*uOptics.w*.22;
  color += light*tint*exp(-depth/max(uFinish.z,.1))*uFinish.y*.3;
  color *= .65 + uOptics.x*fresnel;
  // Energy is confined to the glass. No fullscreen glow, no external halo.
  float alpha = clamp(max(max(color.r,color.g),color.b)*uGlass.w,0.0,.92)*coverage;
  vec3 rgb = color/max(max(max(color.r,color.g),color.b),.001);
  outColor = vec4(rgb*alpha,alpha);
}`;
