import assert from "node:assert/strict";
import { buildLensField, soapLensSlope } from "../app/ice-glass-lens.ts";
import { soapSample } from "../app/ice-glass-volume.ts";

const profile=(width,height,ior=1.5) => ({width,height,ior,radius:Math.min(28,width*.475,height*.475),thickness:Math.min(12,width*.25,height*.25),distance:48});
const close=(a,b,tolerance=1e-6) => assert(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);

// An index-matched volume cannot focus light; the optical axis cannot drift.
assert.deepEqual(soapLensSlope(120,40,profile(400,200,1)),[0,0]);
assert.deepEqual(soapLensSlope(0,0,profile(400,200)),[0,0]);
const air=buildLensField(profile(400,200,1));
assert(air.offsets.every(value=>value===0));
assert(air.data.every((value,index)=>value===(index%4===3 ? 255 : 128)));

// In the paraxial limit a symmetric thin biconvex lens has power 2(n-1)/R.
// Compare the traced outgoing rays with curvature measured independently from
// the surface heights, rather than asserting hard-coded displacement pixels.
const large=profile(1000,1000);
const h=x=>soapSample(x,0,500,500,large.radius,large.thickness)[2];
const curvature=-(h(1)-2*h(0)+h(-1));
const power=-(soapLensSlope(.5,0,large)[0]-soapLensSlope(-.5,0,large)[0]);
close(power/(2*(large.ior-1)*curvature),1,.015);

for(const [width,height] of [[369,134],[764,478],[1136,48],[280,540],[328,720],[2000,50]]) {
  const p=profile(width,height),field=buildLensField(p);
  const {data,offsets,width:nx,height:ny,range,padding}=field;
  const sx=(width+2*padding)/nx,sy=(height+2*padding)/ny;
  const decode=(x,y,channel)=>(data[(y*nx+x)*4+channel]-128)/127*range;
  assert(offsets.every(Number.isFinite)); assert(range<=18);
  // Symmetry is essential to a lens: moving the mouse must not translate text.
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    const i=(y*nx+x)*2,j=(y*nx+nx-1-x)*2,k=((ny-1-y)*nx+x)*2;
    close(offsets[i],-offsets[j]);close(offsets[i+1],offsets[j+1]);
    close(offsets[i],offsets[k]);close(offsets[i+1],-offsets[k+1]);
  }
  let minJacobian=1;
  // Check the actual quantized map and bilinear interpolation at cell corners,
  // including cross-axis derivatives. An upright map has positive determinant.
  for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++)for(const u of [0,1])for(const v of [0,1]) {
    const dx=c=>((1-v)*(decode(x+1,y,c)-decode(x,y,c))+v*(decode(x+1,y+1,c)-decode(x,y+1,c)))/sx;
    const dy=c=>((1-u)*(decode(x,y+1,c)-decode(x,y,c))+u*(decode(x+1,y+1,c)-decode(x+1,y,c)))/sy;
    const a=1+dx(0),b=dy(0),c=dx(1),d=1+dy(1);
    assert(a*d-b*c>0,"The lens must never fold or mirror the image");
    minJacobian=Math.min(minJacobian,(a+d)/2-Math.hypot((a-d)/2,(b+c)/2));
  }
  assert(minJacobian>.5,"Keep the sampled content readable after quantization");
  const mid=((ny-1)/2*nx+(nx-1)/2)*2;
  const focalSlope=(offsets[mid+nx*2+1]-offsets[mid-nx*2+1])/(sy*2);
  const magnifications=[0,.25,.5,.75,1].map(lift=>1/(1+lift*focalSlope));
  close(magnifications[0],1);
  assert(magnifications.at(-1)>1,"Convex glass must enlarge, not shrink, the base");
  assert(magnifications.every((m,i)=>!i||m>=magnifications[i-1]),"Magnification grows with separation");
  console.log(JSON.stringify({width,height,minJacobian:+minJacobian.toFixed(3),magnificationY:+magnifications.at(-1).toFixed(3)}));
}
console.log("Glass lens: index matching, focal power, symmetry, magnification and non-folding maps passed.");
