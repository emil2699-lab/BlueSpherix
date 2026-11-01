// A closed rounded dielectric volume. HTML stays above the optical scene.
export const volumeGlassFragment = `#version 300 es
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
float slabThickness() {
  return min(uGlass.y,min(uRect.z,uRect.w)*.125);
}
vec3 liquidHeight(vec2 p) {
  // Height and its analytic gradient describe the SAME stable geometry.
  float a=p.x*.018+sin(p.y*.023)*1.4;
  float b=p.y*.016+p.x*.009;
  float amplitude=slabThickness()*.018;
  vec3 wave=amplitude*vec3(sin(a)*sin(b),
    .018*cos(a)*sin(b)+.009*sin(a)*cos(b),
    .0322*cos(p.y*.023)*cos(a)*sin(b)+.016*sin(a)*cos(b));
  float depth=-boxSDF(p,uRect.zw*.5,uRadius);
  float start=slabThickness()*.75,span=slabThickness()*1.75;
  float t=clamp((depth-start)/span,0.0,1.0);
  float envelope=1.0-t*t*(3.0-2.0*t);
  vec2 envelopeGradient=roundedSurfaceNormal(p,uRect.zw*.5,uRadius)*6.0*t*(1.0-t)/span;
  return vec3(wave.x*envelope,wave.yz*envelope+wave.x*envelopeGradient);
}
float slabDistance(vec3 point, out vec3 normal) {
  float halfHeight=slabThickness()*.5;
  float bevelRadius=min(halfHeight*.85,uRadius*.8);
  vec3 warp=liquidHeight(point.xy);
  float z=point.z-warp.x;
  vec2 halfSize=uRect.zw*.5-vec2(bevelRadius);
  float radius=max(uRadius-bevelRadius,0.0);
  float side=boxSDF(point.xy,halfSize,radius);
  vec2 q=vec2(side,abs(z)-(halfHeight-bevelRadius));
  vec2 outer=max(q,vec2(0));
  float len=length(outer);
  vec2 sectionNormal=len>.00001 ? outer/len :
    (q.x>q.y ? vec2(1,0) : vec2(0,1));
  normal=vec3(roundedSurfaceNormal(point.xy,halfSize,radius)*sectionNormal.x,
    sectionNormal.y*(z<0.0 ? -1.0 : 1.0));
  normal.xy-=normal.z*warp.yz;
  normal=normalize(normal);
  return length(outer)+min(max(q.x,q.y),0.0)-bevelRadius;
}
vec3 slabFront(vec2 p) {
  float halfHeight=slabThickness()*.5;
  float bevelRadius=min(halfHeight*.85,uRadius*.8);
  float depth=max(0.0,-boxSDF(p,uRect.zw*.5,uRadius));
  float radial=max(bevelRadius-depth,0.0);
  float height=halfHeight-bevelRadius+
    sqrt(max(bevelRadius*bevelRadius-radial*radial,0.0));
  return vec3(p,height+liquidHeight(p).x);
}
float dielectricFresnel(float cosine, float n1, float n2) {
  float ci=clamp(abs(cosine),0.0,1.0);
  float sinSquared=(n1/n2)*(n1/n2)*(1.0-ci*ci);
  if(sinSquared>=1.0) return 1.0; // Total internal reflection.
  float ct=sqrt(max(0.0,1.0-sinSquared));
  float rs=(n1*ci-n2*ct)/max(n1*ci+n2*ct,.00001);
  float rp=(n2*ci-n1*ct)/max(n2*ci+n1*ct,.00001);
  return .5*(rs*rs+rp*rp);
}
float wavelengthIOR(float wavelength) {
  // Cauchy dispersion, wavelengths in micrometres, calibrated at 550 nm.
  return uGlass.x+uOptics.y*.14*(1.0/(wavelength*wavelength)-1.0/(.55*.55));
}
bool nextBoundary(vec3 origin, vec3 direction, out vec3 hit, out vec3 normal) {
  // Away from the bevel this volume has two parallel, gently warped faces.
  // Intersect those directly; reserve the bracketed solver for rounded walls.
  float thickness=slabThickness();
  float depth=-boxSDF(origin.xy,uRect.zw*.5,uRadius);
  if(depth>thickness*1.4 && abs(direction.z)>.2) {
    float side=direction.z<0.0 ? -1.0 : 1.0;
    float t=(side*thickness*.5+liquidHeight(origin.xy).x-origin.z)/direction.z;
    for(int k=0;k<3;k++) {
      hit=origin+direction*t;
      vec3 warp=liquidHeight(hit.xy);
      float residual=hit.z-warp.x-side*thickness*.5;
      t-=residual/(direction.z-dot(warp.yz,direction.xy));
    }
    hit=origin+direction*t;
    slabDistance(hit,normal);
    return t>0.0;
  }
  // Bracket the EXIT using the enclosing 3D box. Safeguarded Newton steps
  // converge on the far surface without walking along the whole interior.
  vec3 extent=vec3(uRect.zw*.5,thickness*.518);
  vec3 bounds=(extent-sign(direction)*origin)/max(abs(direction),vec3(.00001));
  float high=max(.0001,min(bounds.x,min(bounds.y,bounds.z)));
  float low=0.0,travel=high;
  for(int k=0;k<8;k++) {
    hit=origin+direction*travel;
    float distance=slabDistance(hit,normal);
    if(abs(distance)<.008) return true;
    if(distance>0.0) high=travel; else low=travel;
    float next=travel-distance/max(dot(normal,direction),.00001);
    travel=next>low && next<high ? next : (low+high)*.5;
  }
  hit=origin+direction*travel;
  if(abs(slabDistance(hit,normal))<.04) return true;
  // Unresolved energy is discarded, never turned into an invented reflection.
  return false;
}
struct SlabTrace {
  vec3 energy;
  vec2 landing0;
  vec2 landing1;
  vec2 landing2;
  float radiance;
  float remaining;
  float escaped;
  float absorbed;
};
SlabTrace emptyTrace(vec2 p) {
  SlabTrace result;
  result.energy=vec3(0);
  result.landing0=p;
  result.landing1=p;
  result.landing2=p;
  result.radiance=0.0;
  result.remaining=0.0;
  result.escaped=0.0;
  result.absorbed=0.0;
  return result;
}
SlabTrace traceSlab(vec3 entry, vec3 normal, vec3 incident, float ior, float absorption, int channel) {
  SlabTrace result=emptyTrace(entry.xy);
  float entryF=dielectricFresnel(-dot(incident,normal),1.0,ior);
  result.escaped=entryF;
  result.absorbed=0.0;
  float throughput=1.0-entryF;
  vec3 direction=refract(incident,normal,1.0/ior);
  vec3 origin=entry+direction*.03;
  // Three boundary encounters: transmitted branch plus up to two internal
  // reflections. Fresnel partitions energy; Beer-Lambert uses travelled length.
  for(int bounce=0;bounce<3;bounce++) {
    vec3 hit,boundaryNormal;
    if(!nextBoundary(origin,direction,hit,boundaryNormal)) break;
    float arriving=throughput*exp(-absorption*length(hit-origin));
    result.absorbed+=throughput-arriving;
    throughput=arriving;
    float f=dielectricFresnel(dot(direction,boundaryNormal),ior,1.0);
    vec3 outgoing=refract(direction,-boundaryNormal,ior);
    float transmitted=throughput*(1.0-f);
    result.escaped+=transmitted;
    // The exit ray is sampled only if transmission is physically possible.
    // A zero vector from refract at TIR never becomes a spurious environment ray.
    if(transmitted>0.0) result.radiance+=transmitted*environment(outgoing)[channel];
    float towardReceiver=smoothstep(.0,.15,-outgoing.z);
    float travel=max(0.0,(hit.z+slabThickness()*1.5)/max(-outgoing.z,.015));
    vec2 landing=hit.xy+outgoing.xy*travel;
    result.energy[bounce]=transmitted*towardReceiver;
    if(bounce==0) result.landing0=landing;
    else if(bounce==1) result.landing1=landing;
    else result.landing2=landing;
    throughput*=f;
    direction=reflect(direction,boundaryNormal);
    origin=hit+direction*.03;
  }
  result.remaining=throughput;
  return result;
}
float parallelPlate(vec3 view, float ior, float absorption, int channel) {
  // Exact parallel-face solution sums the internal reflection series. Used
  // only where the volume geometry is flat, avoiding unnecessary ray marches.
  float f=dielectricFresnel(view.z,1.0,ior);
  vec3 inside=refract(-view,vec3(0,0,1),1.0/ior);
  float absorb=exp(-absorption*slabThickness()/max(-inside.z,.001));
  float series=1.0/max(1.0-f*f*absorb*absorb,.0001);
  float transmission=(1.0-f)*(1.0-f)*absorb*series;
  float reflection=(1.0-f)*(1.0-f)*f*absorb*absorb*series;
  return transmission*environment(-view)[channel]+
    reflection*environment(reflect(-view,vec3(0,0,1)))[channel];
}
float rayConcentration(vec2 landing, float energy) {
  // This local ray-footprint estimate is still a screen-space approximation
  // of the irradiance on the receiver, rather than a global photon gather.
  vec2 dx = dFdx(landing)*uDPR;
  vec2 dy = -dFdy(landing)*uDPR;
  float determinant = dx.x*dy.y-dx.y*dy.x;
  float footprint = dot(dx,dx)+dot(dy,dy);
  float aperture = .16 + uGlass.z*.35;
  return energy*exp(-determinant*determinant/(aperture*aperture)) /
    sqrt(1.0+footprint*.12);
}
float traceConcentration(SlabTrace ray) {
  return rayConcentration(ray.landing0,ray.energy.x)+
    rayConcentration(ray.landing1,ray.energy.y)+
    rayConcentration(ray.landing2,ray.energy.z);
}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x/uDPR, (uResolution.y-gl_FragCoord.y)/uDPR);
  vec2 halfSize = uRect.zw*.5;
  vec2 p = pixel-uRect.xy-halfSize;
  float d = boxSDF(p,halfSize,uRadius);
  float aa = 1.25/uDPR;
  float coverage = 1.0-smoothstep(-aa,0.0,d);
  float depth = -d;
  float thickness = slabThickness();
  // Keep the exact rounded silhouette, but move all optical shading onto a
  // continuous face blend before the box SDF reaches its diagonal medial axes.
  float normalSoftness = max(9.0,thickness*1.35);
  float blendEnd = max(3.0,min(uRadius*.55,thickness*.5));
  float interiorBlend = smoothstep(.75,blendEnd,depth);
  float opticalDepth = mix(depth,continuousInnerDepth(p,halfSize,normalSoftness),interiorBlend);
  float bevel = exp(-opticalDepth/max(thickness,1.0));
  // A stable, low-frequency liquid normal varies the optical path, not the DOM.
  float phaseA = p.x*.018+sin(p.y*.023)*1.4;
  float phaseB = p.y*.016+p.x*.009;
  float wave = sin(phaseA)*sin(phaseB);
  vec3 entry=slabFront(p);
  vec3 N;
  slabDistance(entry,N);
  // A distant observer gives a gentle perspective, stable under page zoom.
  vec3 V = normalize(vec3(uResolution/uDPR*.5-pixel,2400.0));
  vec3 delta = vec3(uLight.xy-pixel,uEnergy.z-entry.z);
  float distanceXY = length(delta.xy);
  vec3 L = normalize(delta);
  vec3 H = normalize(L+V);
  float attenuation = 1.0/(1.0+pow(distanceXY/uEnergy.w,2.0)*3.0);
  attenuation *= 1.0-smoothstep(uEnergy.w*1.75,uEnergy.w*2.75,distanceXY);
  attenuation *= uLight.z;
  float ndl = max(dot(N,L),0.0);
  float ndh = max(dot(N,H),0.0);
  float fresnel = dielectricFresnel(dot(N,V),1.0,uGlass.x);
  float a2 = pow(uGlass.z,4.0);
  float denominator = ndh*ndh*(a2-1.0)+1.0;
  float ggx = a2/max(3.141593*denominator*denominator,.0000001);
  float ndv=max(dot(N,V),.001);
  float smithL=2.0*ndl/max(ndl+sqrt(a2+(1.0-a2)*ndl*ndl),.001);
  float smithV=2.0*ndv/(ndv+sqrt(a2+(1.0-a2)*ndv*ndv));
  float reflectionF=dielectricFresnel(dot(H,V),1.0,uGlass.x);
  float specular=ggx*smithL*smithV*reflectionF/max(4.0*ndl*ndv,.001);
  vec3 absorption=mix(vec3(.018),vec3(.005),uTint)*uGlass.w;
  vec3 ior=vec3(wavelengthIOR(.65),wavelengthIOR(.55),wavelengthIOR(.45));
  SlabTrace lightR=emptyTrace(entry.xy),lightG=emptyTrace(entry.xy),lightB=emptyTrace(entry.xy);
  vec3 refracted;
  if(depth<thickness*2.5) {
    lightR=traceSlab(entry,N,-L,ior.r,absorption.r,0);
    lightG=traceSlab(entry,N,-L,ior.g,absorption.g,1);
    lightB=traceSlab(entry,N,-L,ior.b,absorption.b,2);
    SlabTrace viewR=traceSlab(entry,N,-V,ior.r,absorption.r,0);
    SlabTrace viewG=traceSlab(entry,N,-V,ior.g,absorption.g,1);
    SlabTrace viewB=traceSlab(entry,N,-V,ior.b,absorption.b,2);
    refracted=vec3(viewR.radiance,viewG.radiance,viewB.radiance);
  } else {
    refracted=vec3(parallelPlate(V,ior.r,absorption.r,0),
      parallelPlate(V,ior.g,absorption.g,1),parallelPlate(V,ior.b,absorption.b,2));
  }
  vec3 caustic=vec3(traceConcentration(lightR),traceConcentration(lightG),traceConcentration(lightB));
  if (coverage <= 0.0) discard;
  float facing = .11+.89*max(dot(N.xy,normalize(delta.xy+vec2(.001))),0.0);
  float light = attenuation*uEnergy.y*facing;
  vec2 secondaryDelta=pixel-uSecondary.xy;
  float travel=dot(secondaryDelta,uSecondary.zw);
  float deviation=abs(secondaryDelta.x*uSecondary.w-secondaryDelta.y*uSecondary.z);
  float beamWidth=14.0+max(travel,0.0)*.045+wave*3.0;
  float bounced=uSecondaryEnergy*uLight.z*smoothstep(-beamWidth,beamWidth,travel)*
    exp(-pow(deviation/max(beamWidth,2.0),2.0))*exp(-max(travel,0.0)/360.0);
  vec3 face = refracted + uTint*.008;
  face += environment(reflect(-V,N))*fresnel;
  face += mix(vec3(.34,.55,.77),uTint,.35)*bounced*(.12+.24*bevel);
  vec3 edgeLight = vec3(1.0)*attenuation*uEnergy.y*specular*ndl;
  float spectralReach = exp(-opticalDepth/(thickness*1.55));
  edgeLight += light*caustic*spectralReach*uOptics.z*1.15;
  edgeLight += bounced*caustic*spectralReach*.34;
  vec3 color = face + edgeLight;
  // Premultiplied, full-card material: no CSS-like stroke or external glow.
  float alpha = clamp((.24 + max(max(color.r,color.g),color.b)*uGlass.w)*coverage,0.0,.72);
  outColor = vec4(color*alpha,alpha);
}`;
