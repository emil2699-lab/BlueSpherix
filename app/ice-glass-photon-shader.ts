import { glassGeometry } from "./ice-glass-shader";

// Forward surface photon mapping in the same WebGL context. Transform feedback
// carries actual emergent positions/directions/flux between optical interfaces.
export const photonVertex = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec4 aOriginEnergy;
layout(location=1) in vec4 aDirectionMedium;
layout(location=2) in vec4 aMeta;
out vec4 nextOriginEnergy;
out vec4 nextDirectionMedium;
out vec4 nextMeta;
out vec3 vFlux;
flat out ivec2 vTile;
uniform sampler2D uScene;
uniform int uTriangleOffset;
uniform vec4 uCards[64];
uniform vec2 uShape[64];
uniform vec3 uSource;
uniform vec4 uTransport; // IOR, existing dispersion, roughness, source power
uniform ivec2 uAtlasSize;
uniform int uInitialize;
uniform int uMaxCards;
${glassGeometry}
vec4 dataAt(int i) { return texelFetch(uScene,ivec2(i%1024,i/1024),0); }
bool boxHit(vec3 o,vec3 d,vec3 lo,vec3 hi,float limit) {
  vec3 safeD=mix(vec3(1e-10),d,greaterThan(abs(d),vec3(1e-10)));
  vec3 a=(lo-o)/safeD,b=(hi-o)/safeD;
  vec3 mn=min(a,b),mx=max(a,b);
  return max(max(mn.x,mn.y),max(mn.z,0.0))<=min(min(mx.x,mx.y),min(mx.z,limit));
}
bool sceneHit(vec3 o,vec3 d,int medium,int previous,float limit,out vec3 hit,out int card) {
  int stack[48];int count=1;stack[0]=0;bool found=false;float closest=limit;
  for(int iteration=0;iteration<768;iteration++) {
    if(count==0)break;
    int node=stack[--count]*3;vec4 lo=dataAt(node),hi=dataAt(node+1),leaf=dataAt(node+2);
    if(!boxHit(o,d,lo.xyz,hi.xyz,closest))continue;
    if(lo.w>=0.0) { if(count<46) { stack[count++]=int(lo.w);stack[count++]=int(hi.w); } continue; }
    for(int j=0;j<6;j++) {
      if(j>=int(leaf.y))break;
      int address=uTriangleOffset+(int(leaf.x)+j)*3;
      vec4 a=dataAt(address);int c=int(a.w);
      if((medium>=0 && c!=medium) || (medium<0 && c==previous))continue;
      vec3 e1=dataAt(address+1).xyz-a.xyz,e2=dataAt(address+2).xyz-a.xyz;
      vec3 p=cross(d,e2);float determinant=dot(e1,p);
      if(abs(determinant)<1e-8)continue;
      vec3 t=o-a.xyz;float u=dot(t,p)/determinant;
      if(u<0.0 || u>1.0)continue;
      vec3 q=cross(t,e1);float v=dot(d,q)/determinant;
      if(v<0.0 || u+v>1.0)continue;
      float distance=dot(e2,q)/determinant;
      if(distance<=.015 || distance>=closest)continue;
      closest=distance;card=c;found=true;
    }
  }
  hit=o+d*closest;return found;
}
vec3 surfaceNormal(vec3 p,int card) {
  vec4 r=uCards[card];vec2 shape=uShape[card];
  vec3 surface=soapSurface(p.xy-r.xy-r.zw*.5,r.zw*.5,shape.x,shape.y);
  return normalize(vec3(-surface.xy,p.z>=0.0 ? 1.0 : -1.0));
}
float fresnel(vec3 d,vec3 n,float n1,float n2,out vec3 transmitted) {
  float ci=clamp(-dot(d,n),0.0,1.0),eta=n1/n2,k=1.0-eta*eta*(1.0-ci*ci);
  if(k<0.0) { transmitted=vec3(0);return 1.0; }
  float ct=sqrt(k),rs=(n1*ci-n2*ct)/max(n1*ci+n2*ct,1e-8),rp=(n2*ci-n1*ct)/max(n2*ci+n1*ct,1e-8);
  transmitted=normalize(eta*d+(eta*ci-ct)*n);
  return (rs*rs+rp*rp)*.5;
}
void main() {
  nextOriginEnergy=aOriginEnergy;nextDirectionMedium=aDirectionMedium;nextMeta=aMeta;
  gl_Position=vec4(2,2,0,1);gl_PointSize=7.0;vFlux=vec3(0);vTile=ivec2(0);
  int channel=int(aMeta.x);float ior=uTransport.x+(float(channel)-1.0)*uTransport.y;
  if(uInitialize==1) {
    vec3 delta=aOriginEnergy.xyz-uSource,d=normalize(delta);int card=int(aDirectionMedium.w)-1;
    vec3 n=surfaceNormal(aOriginEnergy.xyz,card);float cosine=max(-dot(d,n),0.0);
    float energy=uTransport.w*cosine*aOriginEnergy.w/max(dot(delta,delta),1.0)/3.0;
    vec3 blocker;int blockerCard;
    if(cosine<=0.0 || sceneHit(uSource,d,-1,-1,length(delta)-.04,blocker,blockerCard))energy=0.0;
    vec3 transmitted;float f=fresnel(d,n,1.0,ior,transmitted);
    nextOriginEnergy=vec4(aOriginEnergy.xyz+transmitted*.04,energy*(1.0-f));
    nextDirectionMedium=vec4(transmitted,float(card+1));nextMeta=vec4(channel,1,card+1,0);return;
  }
  float energy=aOriginEnergy.w;if(energy<1e-6)return;
  int medium=int(aDirectionMedium.w)-1,previous=int(aMeta.z)-1;
  if(medium<0 && int(aMeta.y)>=uMaxCards) { nextOriginEnergy.w=0.0;return; }
  vec3 hit;int card;
  if(!sceneHit(aOriginEnergy.xyz,aDirectionMedium.xyz,medium,previous,1e7,hit,card)) { nextOriginEnergy.w=0.0;return; }
  bool inside=medium>=0;
  if(inside)energy*=exp(-vec3(.09,.06,.035)[channel]*.12*distance(hit,aOriginEnergy.xyz));
  vec3 n=surfaceNormal(hit,card)*(inside ? -1.0 : 1.0),transmitted;
  float f=fresnel(aDirectionMedium.xyz,n,inside ? ior : 1.0,inside ? 1.0 : ior,transmitted);
  float scatter=uTransport.z*uTransport.z;
  float deposited=energy*(f+(1.0-f)*.5)*scatter;
  vec3 outgoing=f>=1.0 ? reflect(aDirectionMedium.xyz,n) : transmitted;
  // The bounded forward solver follows transmission (or total internal
  // reflection). The remaining reflected flux is removed, never added again.
  float outgoingEnergy=f>=1.0 ? energy*(1.0-scatter) : energy*(1.0-f)*(1.0-scatter*.5);
  nextOriginEnergy=vec4(hit+outgoing*.04,outgoingEnergy);
  nextDirectionMedium=vec4(outgoing,f>=1.0 ? float(medium+1) : inside ? 0.0 : float(card+1));
  nextMeta=vec4(channel,aMeta.y+(inside ? 0.0 : 1.0),card+1,aMeta.w+1.0);
  vTile=ivec2(card%4*96,card/4*64);
  vec4 rect=uCards[card];vec2 pixel=vec2(vTile)+(hit.xy-rect.xy)/rect.zw*vec2(96,64);
  gl_Position=vec4(pixel/vec2(uAtlasSize)*2.0-1.0,0,1);
  float pixelArea=rect.z*rect.w/(96.0*64.0);
  // A finite, normalized reconstruction kernel, not a luminous beam profile.
  vFlux[channel]=deposited/max(pixelArea,1e-6);
}`;

export const photonFragment = `#version 300 es
precision highp float;
precision highp int;
in vec3 vFlux;
flat in ivec2 vTile;
out vec4 outColor;
void main() {
  ivec2 local=ivec2(gl_FragCoord.xy)-vTile;
  if(any(lessThan(local,ivec2(0))) || any(greaterThanEqual(local,ivec2(96,64))))discard;
  vec2 delta=(gl_PointCoord-.5)*7.0;
  // Discrete 7x7 Gaussian integrates to approximately one; clipping can only
  // discard flux, so the reconstruction never creates transport energy.
  float weight=exp(-dot(delta,delta)*.65)/4.834;
  outColor=vec4(vFlux*weight,0);
}`;
