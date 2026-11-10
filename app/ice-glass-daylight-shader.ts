import { glassGeometry, glassVertex } from "./ice-glass-shader";
import { DAYLIGHT } from "./ice-glass-daylight";

// Forward ray mesh: each triangle carries an incident patch of sunlight to the
// receiver plane. The Jacobian in the fragment shader measures its compression.
export const daylightTraceVertex = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uDPR;
uniform vec4 uRect;
uniform float uRadius;
uniform float uLift;
out vec2 vSource;
out vec3 vEnergy;
out vec2 vBase;
out vec2 vSlope;
${glassGeometry}
void main() {
  const int nx=40, ny=24;
  int triangle=gl_VertexID/6, corner=gl_VertexID%6;
  ivec2 corners[6]=ivec2[6](ivec2(0,0),ivec2(1,0),ivec2(0,1),ivec2(0,1),ivec2(1,0),ivec2(1,1));
  vec2 uv=vec2(ivec2(triangle%nx,triangle/nx)+corners[corner])/vec2(nx,ny);
  vec2 b=uRect.zw*.5;
  float r=min(min(b.x,b.y)*.95,max(uRadius*1.75,24.0));
  float t=min(${DAYLIGHT.thickness.toFixed(1)},min(b.x,b.y)*.5);
  float center=soapSurface(vec2(0),b,r,t).z;
  float y=(uv.y*2.0-1.0)*(b.y-.35);
  float cornerY=max(abs(y)-(b.y-r),0.0);
  float span=b.x-r+sqrt(max(r*r-cornerY*cornerY,.01));
  vec2 p=vec2((uv.x*2.0-1.0)*(span-.35),y);
  vec3 top=soapSurface(p,b,r,t);
  vec3 n=normalize(vec3(-top.xy,1));
  vec3 sun=normalize(vec3(.85,1.1,-.85));
  int channel=gl_InstanceID%3;
  int sampleIndex=gl_InstanceID/3;
  // A small angular solar aperture softens fold singularities. These samples
  // change incident direction, not the shape of a decorative noise texture.
  sun=normalize(sun+vec3(sampleIndex==0 ? -.008 : .008,sampleIndex==0 ? .006 : -.006,0));
  float ior=${DAYLIGHT.ior.toFixed(3)}+float(channel-1)*${DAYLIGHT.dispersion.toFixed(4)};
  vec3 inside=refract(sun,n,1.0/ior);
  float lo=0.0,hi=(top.z+center)/max(-inside.z,.01);
  for(int i=0;i<12;i++) {
    float m=(lo+hi)*.5;
    vec3 s=soapSurface(p+inside.xy*m,b,r,t);
    if(top.z+inside.z*m > -s.z)lo=m;else hi=m;
  }
  float travel=(lo+hi)*.5;
  vec2 q=p+inside.xy*travel;
  vec3 bottom=soapSurface(q,b,r,t);
  vec3 exitNormal=normalize(vec3(bottom.xy,1));
  vec3 outgoing=refract(inside,exitNormal,ior);
  float valid=step(.001,dot(outgoing,outgoing))*step(.001,bottom.z)*step(.03,-outgoing.z);
  // Fresnel losses at both interfaces, no colour tint or curvature gain.
  float f0=pow((ior-1.0)/(ior+1.0),2.0);
  float f1=f0+(1.0-f0)*pow(1.0-max(dot(-sun,n),0.0),5.0);
  float f2=f0+(1.0-f0)*pow(1.0-max(dot(-inside,exitNormal),0.0),5.0);
  valid*=step(0.0,dot(-sun,n));
  vSource=p-sun.xy*(top.z/sun.z);
  vEnergy=vec3(channel==0 ? 1.0 : 0.0,channel==1 ? 1.0 : 0.0,channel==2 ? 1.0 : 0.0)
    *(1.0-f1)*(1.0-f2)*valid*.5;
  vBase=q+outgoing.xy/max(-outgoing.z,.03)*(center-bottom.z+${DAYLIGHT.gap.toFixed(2)});
  vSlope=outgoing.xy/max(-outgoing.z,.03)*${DAYLIGHT.lift.toFixed(1)};
  // A rejected ray must not pull neighbouring triangles out across the base.
  vBase=mix(p,vBase,valid);vSlope*=valid;
  gl_Position=vec4(0,0,0,1);
}`;
export const daylightCausticVertex = `#version 300 es
precision highp float;
layout(location=0) in vec2 aBase;
layout(location=1) in vec2 aSlope;
layout(location=2) in vec2 aSource;
layout(location=3) in vec3 aEnergy;
uniform vec2 uResolution;
uniform float uDPR;
uniform vec4 uRect;
uniform float uLift;
out vec2 vSource;
out vec3 vEnergy;
void main() {
  vec2 pixel=uRect.xy+uRect.zw*.5+aBase+aSlope*uLift;
  vec2 clip=pixel*uDPR/uResolution*2.0-1.0;
  gl_Position=vec4(clip.x,-clip.y,0,1);
  vSource=aSource;vEnergy=aEnergy;
}`;
export const daylightCausticFragment = `#version 300 es
precision highp float;
in vec2 vSource;
in vec3 vEnergy;
out vec4 outColor;
uniform float uDPR;
void main() {
  vec2 dx=dFdx(vSource)*uDPR,dy=dFdy(vSource)*uDPR;
  float concentration=abs(dx.x*dy.y-dx.y*dy.x);
  // Only extra irradiance above the unperturbed daylight is added to the base.
  outColor=vec4(vEnergy*min(max(concentration-1.0,0.0)*.10,.42),0);
}`;
export const daylightCompositeVertex = glassVertex;
export const daylightCompositeFragment = `#version 300 es
precision highp float;
uniform sampler2D uCaustics;
uniform vec2 uResolution;
out vec4 outColor;
void main() {
  vec2 uv=gl_FragCoord.xy/uResolution;
  vec3 energy=texture(uCaustics,uv).rgb;
  float peak=max(max(energy.r,energy.g),energy.b);
  // Natural light is mostly white; dispersion is visible only at a focus edge.
  vec3 colour=mix(vec3(1.0,.995,.975),energy/max(peak,.0001),.10);
  float alpha=(1.0-exp(-peak*2.4))*.88;
  outColor=vec4(colour*alpha,alpha);
}`;
