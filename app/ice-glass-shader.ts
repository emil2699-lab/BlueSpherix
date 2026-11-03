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

export const glassGeometry = `float boxSDF(vec2 p, vec2 b, float r) {
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
// Returns the analytic height gradient (xy) and surface height (z).
vec3 soapSurface(vec2 p, vec2 b, float r, float thickness) {
  float depth = max(-boxSDF(p,b,r),0.0);
  // Smooth minimum of all four face distances. Opposite faces participate too:
  // no abs/nearest-face crease survives on the centre axes or diagonals.
  float softness = max(1.0,min(r*.28,thickness*.5));
  vec2 opposite = exp(-2.0*abs(p)/softness);
  vec2 axisDepth = b-abs(p)-softness*log(vec2(1.0)+opposite);
  vec2 axisGradient = -sign(p)*(vec2(1.0)-opposite)/(vec2(1.0)+opposite);
  float nearest = min(axisDepth.x,axisDepth.y);
  vec2 weights = exp(-(axisDepth-vec2(nearest))/softness);
  float weightSum = weights.x+weights.y;
  float innerDepth = nearest-softness*log(weightSum);
  vec2 innerGradient = axisGradient*weights/weightSum;
  // Retain the exact projected contour, joining the smooth interior before the
  // rounded-box distance reaches its medial axes. Both ends have zero slope.
  float join = max(1.0,min(r*.85,min(b.x,b.y)*.7));
  float t = clamp((depth-join*.18)/(join*.82),0.0,1.0);
  float blend = t*t*(3.0-2.0*t);
  float blendDerivative = 6.0*t*(1.0-t)/(join*.82);
  vec2 depthGradient = -roundedSurfaceNormal(p,b,r);
  float bodyDepth = max(mix(depth,innerDepth,blend),0.0);
  vec2 bodyGradient = mix(depthGradient,innerGradient,blend)
    +(innerDepth-depth)*blendDerivative*depthGradient;
  float rollWidth = max(thickness*2.2,r*1.1);
  // Rounded roll: a vertical side at the silhouette becomes the convex face
  // progressively, rather than a flat front with a separate exponential rim.
  float decay = exp(-2.0*bodyDepth/rollWidth);
  float cap = sqrt(max(1.0-decay,0.0));
  vec2 capGradient = bodyGradient*decay/(rollWidth*max(cap,.001));
  vec2 uv = p/max(b,vec2(1.0));
  vec2 crownAxes = max(vec2(1.0)-uv*uv,vec2(0.0));
  float crown = crownAxes.x*crownAxes.y;
  vec2 crownGradient = -2.0*uv/max(b,vec2(1.0))*crownAxes.yx;
  vec2 heightGradient = thickness*(capGradient*(1.0+.30*crown)+cap*.30*crownGradient);
  return vec3(heightGradient,thickness*cap*(1.0+.30*crown));
}
`;

// A convex 2.5D glass volume. The DOM remains sharp above this optical layer.
export const glassFragment = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uDPR;
uniform vec4 uRect;
uniform float uRadius;
uniform float uCrownHeight;
// x: radial coverage, y: control flag, z: deselection fade, w: convex volume.
uniform vec4 uCoating;
uniform vec2 uCoatingOrigin;
// Selected under-glass light: P&L ceiling and seconds since selection.
uniform vec2 uUnderlight;
// Selected area emitter, in the same CSS-pixel space as every glass card.
uniform vec4 uSpillRect;
uniform vec4 uSpill; // strength, time, coating visibility, receiver flag
uniform vec2 uSpillOrigin;
uniform vec3 uSpillTint;
uniform vec3 uTint;
uniform vec3 uLight;
uniform vec4 uGlass; // IOR, thickness, roughness, opacity
uniform float uBodyOpacity;
uniform vec4 uOptics; // Fresnel, dispersion, refraction, internal reflection
uniform vec4 uEnergy; // ambient, intensity, light height, falloff
uniform vec3 uFinish; // sharpness, bloom intensity, bloom radius

${glassGeometry}
vec3 environment(vec3 ray) {
  float sky = smoothstep(-.55,.72,ray.y);
  float cool = pow(max(0.0, .5 + .5 * ray.x), 2.4);
  return vec3(.008,.016,.024) + vec3(.025,.055,.085)*sky + vec3(.010,.026,.044)*cool;
}
float underlightNoise(vec2 p) {
  vec2 cell=floor(p), f=fract(p);
  f=f*f*(3.0-2.0*f);
  vec4 h=fract(sin(vec4(dot(cell,vec2(127.1,311.7)),
    dot(cell+vec2(1,0),vec2(127.1,311.7)),
    dot(cell+vec2(0,1),vec2(127.1,311.7)),
    dot(cell+vec2(1,1),vec2(127.1,311.7))))*43758.5453);
  return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
}
float underlightField(vec2 p, float time) {
  // Time is an independent noise dimension: pools are born and fade locally,
  // rather than transporting an unchanging pattern in one direction.
  float cell=floor(time), f=fract(time);
  f=f*f*(3.0-2.0*f);
  return mix(underlightNoise(p+cell*vec2(37,71)),
    underlightNoise(p+(cell+1.0)*vec2(37,71)),f);
}
float underlightLevel(vec2 localPixel, vec2 size, vec2 origin, float t) {
  vec2 uv=localPixel/vec2(max(90.0,size.x*.24),max(40.0,size.y));
  vec2 seed=origin*7.3+size*.013;
  float broad=underlightField(uv*1.15+seed,t*.075+seed.x);
  float detail=underlightField(uv*2.1+seed.yx+13.0,t*.113+seed.y);
  return smoothstep(.32,.72,broad*.72+detail*.28);
}
vec3 underlightTransmission(vec3 tint, float level) {
  float chroma=max(max(tint.r,tint.g),tint.b)-min(min(tint.r,tint.g),tint.b);
  vec3 pigment=tint/max(max(tint.r,tint.g),max(tint.b,.001));
  vec3 transmission=mix(vec3(1.0),pigment,smoothstep(.18,.32,chroma));
  transmission=mix(transmission,vec3(1.0),smoothstep(.35,.95,level)*.72);
  // Increase only the underlight chroma; retain hue, luminance and white peaks.
  float luminance=dot(transmission,vec3(.2126,.7152,.0722));
  return max(vec3(0.0),mix(vec3(luminance),transmission,1.15));
}
vec3 softUnderlight(vec2 localPixel, float depth, float fresnel, float volume) {
  // Smooth local extinction and relighting, with no moving surface normals.
  // No permanent floor: individual regions can go completely dark. P&L scales
  // the ceiling, so a large result never forces the light to stay switched on.
  float level=underlightLevel(localPixel,uRect.zw,uCoatingOrigin,uUnderlight.y)*uUnderlight.x;
  // The dim pools retain the material hue; the stronger crests softly approach
  // white, rather than making every part of the transmitted light monochrome.
  vec3 transmission=underlightTransmission(uTint,level);
  float softEdge=smoothstep(0.0,min(14.0,uRect.w*.27),depth);
  return transmission*(.138*1.15*level)*softEdge*(1.0-fresnel)
    *smoothstep(.2,1.0,volume);
}
float internalFresnel(float cosine, float fromIOR, float toIOR) {
  float c=clamp(cosine,0.0,1.0), eta=fromIOR/toIOR;
  float sineSquared=eta*eta*(1.0-c*c);
  if(sineSquared>=1.0) return 1.0;
  float transmittedCosine=sqrt(max(0.0,1.0-sineSquared));
  float s=(fromIOR*c-toIOR*transmittedCosine)/max(fromIOR*c+toIOR*transmittedCosine,.0001);
  float p=(toIOR*c-fromIOR*transmittedCosine)/max(toIOR*c+fromIOR*transmittedCosine,.0001);
  return .5*(s*s+p*p);
}
// Intersect the closed soap volume, not a flat slab or a painted edge mask.
// Safeguarded Newton steps converge quickly; bisection handles grazing rays.
float soapRayExit(vec3 origin, vec3 ray, vec2 b, float radius, float thickness,
  float volume, out vec3 normal) {
  float lo=.04;
  float vertical=(thickness*volume*1.3-sign(ray.z)*origin.z)/max(abs(ray.z),.0001);
  vec2 sides=(b-sign(ray.xy)*origin.xy)/max(abs(ray.xy),vec2(.0001));
  float hi=min(vertical,min(sides.x,sides.y))+.001;
  float travel=hi;
  vec3 gradient=vec3(0,0,1);
  for(int i=0;i<13;i++) {
    vec3 point=origin+ray*travel;
    float contour=boxSDF(point.xy,b,radius);
    vec3 surface=contour<0.0 ? soapSurface(point.xy,b,radius,thickness)*volume : vec3(0.0);
    float vertical=abs(point.z)-surface.z;
    float boundary=max(contour,vertical);
    gradient=vertical>contour ? vec3(-surface.xy,sign(point.z))
      : vec3(roundedSurfaceNormal(point.xy,b,radius),0.0);
    if(abs(boundary)<.0005 || i==12) break;
    if(boundary>0.0) hi=travel; else lo=travel;
    float slope=dot(gradient,ray);
    float next=travel-boundary/max(slope,.0001);
    travel=slope>.0001 && next>lo && next<hi ? next : (lo+hi)*.5;
  }
  normal=normalize(gradient);
  return travel;
}
vec3 internalUnderlight(vec2 localPixel, vec3 surface, vec3 normal,
  float radius, float thickness, float volume) {
  vec2 b=uRect.zw*.5;
  vec3 point=vec3(localPixel-b,surface.z*volume);
  // Trace camera -> glass -> luminous underside. Fresnel splits the energy at
  // every interface; retained energy follows up to two internal reflections.
  vec3 ray=refract(vec3(0,0,-1),normal,1.0/uGlass.x);
  float energy=1.0-internalFresnel(normal.z,1.0,uGlass.x);
  vec3 radiance=vec3(0.0);
  for(int bounce=0;bounce<3;bounce++) {
    point+=ray*.04;
    vec3 exitNormal;
    float path=soapRayExit(point,ray,b,radius,thickness,volume,exitNormal);
    point+=ray*path;
    // Beer-Lambert attenuation depends on the actual distance inside the glass.
    energy*=exp(-.055*path/max(thickness,1.0));
    float reflected=internalFresnel(dot(ray,exitNormal),uGlass.x,1.0);
    vec3 outgoing=refract(ray,-exitNormal,uGlass.x);
    if(outgoing.z<-.02 && reflected<1.0) {
      float toLamp=(-thickness*volume*1.6-point.z)/outgoing.z;
      if(toLamp>0.0) {
        vec2 source=point.xy+outgoing.xy*toLamp;
        float lamp=1.0-smoothstep(-max(2.0,thickness*.15),0.0,boxSDF(source,b,radius));
        float level=underlightLevel(source+b,uRect.zw,uCoatingOrigin,uUnderlight.y)*uUnderlight.x;
        radiance+=underlightTransmission(uTint,level)*level*lamp*energy*(1.0-reflected);
      }
    }
    energy*=reflected;
    if(energy<.002) break;
    ray=reflect(ray,exitNormal);
  }
  // Radiance is transported, never amplified by a curvature multiplier. The
  // refracted source footprint compresses/stretches across the curved shoulder.
  return radiance*(.138*1.15)*smoothstep(.2,1.0,volume);
}
vec3 underlightSpill(vec2 pixel, float depth) {
  // A near-field area-light approximation. Each receiver samples the actual
  // emitting field at its nearest source point, never an independent glow.
  vec2 inset=min(vec2(12),uSpillRect.zw*.25);
  vec2 sourcePoint=clamp(pixel-uSpillRect.xy,inset,uSpillRect.zw-inset);
  float distanceToSource=length(pixel-(uSpillRect.xy+sourcePoint));
  float level=underlightLevel(sourcePoint,uSpillRect.zw,uSpillOrigin,uSpill.y)*uSpill.x;
  float radiance=level*smoothstep(.35,.75,level)*uSpill.z;
  float attenuation=1.0/(1.0+pow(distanceToSource/90.0,2.0));
  float rim=exp(-depth/5.0)*(1.0-smoothstep(18.0,26.0,depth));
  return underlightTransmission(uSpillTint,level)*radiance*attenuation*rim*(.07*1.15);
}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x/uDPR, (uResolution.y-gl_FragCoord.y)/uDPR);
  vec2 halfSize = uRect.zw*.5;
  vec2 p = pixel-uRect.xy-halfSize;
  // A soap volume needs a broad shoulder and rolled corners, rather than the
  // narrow fillet of the original flat slab. Keep its bounding rectangle fixed.
  float radius = min(min(halfSize.x,halfSize.y)*.95,max(uRadius*1.75,24.0));
  float d = boxSDF(p,halfSize,radius);
  float aa = 1.25/uDPR;
  float coverage = 1.0-smoothstep(-aa,0.0,d);
  if (coverage <= 0.0) discard;
  float depth = -d;
  float thickness = min(uGlass.y*2.1, min(halfSize.x,halfSize.y)*.50);
  // Keep the exact rounded silhouette, but move all optical shading onto a
  // continuous face blend before the box SDF reaches its diagonal medial axes.
  float normalSoftness = max(9.0,thickness*1.35);
  float blendEnd = max(3.0,min(radius*.55,thickness*.5));
  float interiorBlend = smoothstep(.75,blendEnd,depth);
  vec2 surfaceNormal = roundedSurfaceNormal(p,halfSize,radius);
  float opticalDepth = mix(depth,continuousInnerDepth(p,halfSize,normalSoftness),interiorBlend);
  float bevel = exp(-opticalDepth/max(thickness,1.0));
  // A stable, low-frequency liquid normal varies the optical path, not the DOM.
  vec2 materialPixel=p+halfSize;
  float phaseA = materialPixel.x*.018+sin(materialPixel.y*.023)*1.4;
  float phaseB = materialPixel.y*.016+materialPixel.x*.009;
  // The height field is fixed in space: its gradient bends the local normal.
  vec2 waveGradient = vec2(
    .018*cos(phaseA)*sin(phaseB)+.009*sin(phaseA)*cos(phaseB),
    .0322*cos(materialPixel.y*.023)*cos(phaseA)*sin(phaseB)+.016*sin(phaseA)*cos(phaseB)
  );
  // Differentiate the actual height in CSS pixels. Face, sides and corners use
  // one surface; the analytic gradient avoids four extra geometry evaluations.
  vec3 surface = soapSurface(p,halfSize,radius,thickness);
  // Stage one is a planar polished sheet. Stage two grows the actual height
  // field and its analytic normal; DOM geometry and card optics stay unchanged.
  float volume = uCoating.y>.5 ? uCoating.w : 1.0;
  float surfaceHeight = mix(.6,surface.z,volume);
  // Preserve the existing stationary liquid microstructure, fading it smoothly
  // into the vertical sides so it cannot cut a crease into the outer silhouette.
  vec2 normalXY = -surface.xy + waveGradient*3.2*bevel*smoothstep(0.0,thickness*.4,depth);
  vec3 N = normalize(vec3(normalXY*volume,1.0));
  vec3 V = vec3(0,0,1);
  vec3 delta = vec3(uLight.xy-pixel,max(uEnergy.z-surfaceHeight,1.0));
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
  // A parallel source produces an edge-parallel, straight spectral band.
  // Only the difference between local Snell paths and that parallel reference
  // bends it. There is no UV/noise curve or distance-driven bend animation.
  vec3 referenceL=normalize(vec3(uLight.xy-uRect.xy-halfSize,max(uEnergy.z-mix(.6,uCrownHeight,volume),1.0)));
  vec3 referenceR=refract(-referenceL,N,1.0/(uGlass.x-uOptics.y));
  vec3 referenceG=refract(-referenceL,N,1.0/uGlass.x);
  vec3 referenceB=refract(-referenceL,N,1.0/(uGlass.x+uOptics.y));
  vec2 tangent=vec2(-surfaceNormal.y,surfaceNormal.x);
  float shear=dot(transmittedG-referenceG,vec3(surfaceNormal,0));
  float bend=.42*shear/sqrt(.64+shear*shear);
  float focus=depth/thickness+bend;
  float referenceIncidence=dot(referenceL.xy,tangent);
  float spread=uOptics.y*4.2*exp(-depth/thickness)*(.25+.75*referenceIncidence);
  vec3 differentialR=(transmittedR-transmittedG)-(referenceR-referenceG);
  vec3 differentialB=(transmittedB-transmittedG)-(referenceB-referenceG);
  vec3 focalDepth=vec3(.42+spread+dot(differentialR,N)*.3,
    .42,.42-spread+dot(differentialB,N)*.3);
  float bandWidth=.15+.018*shear*shear/(.04+shear*shear);
  // One reflection, from overlapping white to the existing dispersed RGB.
  // Evaluate proximity at the surface, so only the nearby part becomes glossy;
  // the distant band retains its exact Snell paths, width and colour balance.
  float separation=smoothstep(uEnergy.z*1.25,uEnergy.z*4.0,length(delta));
  // A brief, source-dependent spectral split accompanies the material coating.
  // Ordinary cards keep their exact existing optical paths and parameters.
  separation=max(separation,uCoating.y*sin(clamp(uCoating.x,0.0,1.0)*3.14159265)*.85);
  focalDepth=mix(vec3(.42),focalDepth,separation);
  float reflectionWidth=bandWidth*mix(.72,1.0,separation);
  // Normalize the narrower channel profiles, rather than placing an unrelated
  // white glow over the coloured material.
  vec3 caustic = exp(-pow((vec3(focus)-focalDepth)/reflectionWidth,vec3(2.0)))
    *(bandWidth/reflectionWidth);
  // A sharper neutral crest grows only where the same RGB paths overlap.
  // Keep the soft reflection and all three spectral fringes underneath it.
  vec3 channelOverlap=caustic*(reflectionWidth/bandWidth);
  float polishedCore=pow(channelOverlap.r*channelOverlap.g*channelOverlap.b,1.5)
    *(1.0-separation)*(1.0-separation);
  float facing = .11+.89*max(dot(N.xy,normalize(delta.xy+vec2(.001))),0.0);
  float light = attenuation*uEnergy.y*facing;
  float alongEdge = dot(delta.xy,tangent);
  float spectralFocus = exp(-pow(alongEdge/(uEnergy.z*1.8),2.0));
  float rim=exp(-depth/max(1.5,thickness*.07));
  // Keep the white reflection on the rim as a broad streak, without isolated
  // GGX dots on the front or rounded shoulders of neighbouring cards.
  float whiteCore=pow(attenuation,4.2)*spectralFocus*exp(-depth/max(2.0,thickness*.14));
  vec3 tint = mix(vec3(.48,.70,1.0),uTint,.22);
  vec3 absorption = exp(-vec3(.09,.06,.035)*thickness*.12);
  // The existing environment is reflected by the same convex surface, rather
  // than by a flat UV-based direction unrelated to the material's geometry.
  vec3 ambient = environment(reflect(-V,N));
  float frontSpread = attenuation*(.20+.80*max(dot(N,L),0.0));
  vec3 face = ambient*(1.75+.35*(1.0-bevel)) + uTint*.018;
  face += refracted*frontSpread*(.12+.18*(1.0-bevel))*absorption;
  face += mix(vec3(.32,.53,.78),uTint,.25)*attenuation*exp(-opticalDepth/(thickness*3.3))*.20;
  face += mix(vec3(.23,.36,.54),uTint,.45)*light*exp(-opticalDepth/(thickness*4.8))*.14;
  face += vec3(.63,.76,.92)*attenuation*(1.0-bevel)*.035;
  vec3 edgeLight = light*(vec3(.93,.96,1.0)*specular*rim + tint*shoulder*.18);
  float spectralReach = exp(-opticalDepth/(thickness*1.55));
  edgeLight += light*caustic*spectralReach*spectralFocus*uOptics.z*.92;
  edgeLight += vec3(1.0)*light*polishedCore*spectralReach*spectralFocus*uOptics.z*.55;
  edgeLight += vec3(.92,.98,1.0)*whiteCore*.31;
  edgeLight += light*tint*edge*uOptics.w*.08;
  if(uCoating.y>.5) {
    // Keep the original control hue throughout the glass and lightly filter its
    // existing reflection, without flattening the spectral separation to one hue.
    vec3 pigment=uTint/max(max(uTint.r,uTint.g),max(uTint.b,.001));
    float faceLuminance=dot(face,vec3(.2126,.7152,.0722));
    face=mix(face,vec3(faceLuminance)*mix(vec3(1.0),pigment,.72)+uTint*.025,.92);
    edgeLight*=mix(vec3(1.0),pigment,.25);
    // The flat sheet uses the same incident light/specular calculation; the
    // curved optical shoulder emerges only when the volume grows.
    edgeLight=mix(vec3(.93,.96,1.0)*mix(vec3(1.0),pigment,.25)
      *attenuation*uEnergy.y*specular*.18,edgeLight,volume);
  }
  vec3 color = face + edgeLight*(.32+.68*edge);
  color *= .72 + uOptics.x*fresnel;
  // Reduce only the material's coverage. Preserve the existing premultiplied
  // reflection radiance, so clarity does not dim or reshape the spectral rim.
  float opticalAlpha=clamp((.24+max(max(color.r,color.g),color.b)*uGlass.w)*coverage,0.0,.72);
  float alpha=mix(uBodyOpacity*coverage,opticalAlpha,exp(-depth/(thickness*.45)));
  vec3 body=face*(.72+uOptics.x*fresnel);
  outColor=vec4(color*opticalAlpha-body*(opticalAlpha-alpha),alpha);
  if(uSpill.w>.5 && depth<26.0) outColor.rgb+=underlightSpill(pixel,depth)*coverage;
  if(uUnderlight.x>0.0 && uCoating.y>.5) {
    vec3 illumination=softUnderlight(materialPixel,depth,fresnel,volume);
    float shoulderTransport=smoothstep(.02,.18,1.0-N.z);
    if(shoulderTransport>.001 && volume>.2) {
      vec3 transported=internalUnderlight(materialPixel,surface,N,radius,thickness,volume);
      illumination=mix(illumination,transported,shoulderTransport);
    }
    // Only the underlight changes: preserve alpha, the cursor's RGB reflection,
    // the material geometry and the crisp interface above the optical layer.
    outColor.rgb+=illumination*coverage;
  }
  if(uCoating.y>.5) {
    vec2 origin=uCoatingOrigin*uRect.zw;
    // CSS-pixel distance keeps the spreading front circular on wide controls.
    float reach=length(max(origin,uRect.zw-origin));
    float feather=2.5;
    float front=mix(-feather,reach+feather,uCoating.x);
    float coat=1.0-smoothstep(front-feather,front+feather,length(materialPixel-origin));
    outColor*=coat*uCoating.z;
  }
}`;
