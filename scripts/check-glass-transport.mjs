// node --no-warnings --experimental-strip-types scripts/check-glass-transport.mjs
import assert from "node:assert/strict";
import { buildVolumes, soapSample, snell, unit } from "../app/ice-glass-volume.ts";
import { PHOTON_TILE, traceGlassLight } from "../app/ice-glass-transport.ts";
import { ICE_GLASS as config } from "../app/ice-glass-config.ts";

const options={ior:config.glassIOR,dispersion:config.chromaticDispersion,intensity:config.lightIntensity,
  lightHeight:config.lightHeight,roughness:config.glassRoughness,maxBounces:config.maxBounces,debug:true};
const volumes=buildVolumes([0,1,2].map(i=>({rect:{left:20+i*230,top:180,right:230+i*230,bottom:320,width:210,height:140},radius:24})),config.glassThickness);
// Snell at both interfaces, including total internal reflection.
const incident=unit([.6,0,-.8]),entry=snell(incident,[0,0,1],1,1.5);
assert.ok(Math.abs(entry.direction[0]-.4)<1e-12);
const exit=snell(entry.direction,[0,0,1],1.5,1);
assert.ok(Math.hypot(...exit.direction.map((x,i)=>x-incident[i]))<1e-12);
assert.equal(snell(unit([.9,0,.2]),[0,0,-1],1.5,1).direction,null);
// The transport normals differentiate the unchanged convex optical geometry.
for(const [x,y] of [[0,0],[40,20],[80,10],[60,40],[-70,-30]]) {
  const v=volumes[0],args=[105,70,v.radius,v.thickness],e=.001,s=soapSample(x,y,...args);
  const dx=(soapSample(x+e,y,...args)[2]-soapSample(x-e,y,...args)[2])/(2*e);
  const dy=(soapSample(x,y+e,...args)[2]-soapSample(x,y-e,...args)[2])/(2*e);
  assert.ok(Math.hypot(s[0]-dx,s[1]-dy)<1e-5);
}
const cases=[];
for(const pointer of [{x:-20,y:250},{x:120,y:250},{x:240,y:250},{x:130,y:120}]) {
  const atlas=traceGlassLight(pointer,volumes,options),s=atlas.stats;
  const balance=s.escaped+s.absorbed+s.deposited+s.terminated;
  assert.ok(Math.abs(balance-s.emitted)/s.emitted<1e-10,"Transport created/lost unaccounted energy");
  assert.ok(s.intercepted<=s.emitted && s.entries[0]>0 && s.exits[0]>0);
  assert.ok(s.secondary.some(x=>x>0),"No light reached a second card");
  let integral=0;
  for(let c=0;c<volumes.length;c++)for(let y=0;y<PHOTON_TILE.height;y++)for(let x=0;x<PHOTON_TILE.width;x++) {
    const i=((Math.floor(c/4)*64+y)*atlas.width+c%4*96+x)*4;
    integral+=(atlas.data[i]+atlas.data[i+1]+atlas.data[i+2])*210*140/(96*64);
  }
  assert.ok(Math.abs(integral-s.deposited)/s.deposited<1e-6,"Photon reconstruction changed flux");
  const directOnly=traceGlassLight(pointer,volumes,{...options,maxBounces:0});
  assert.equal(directOnly.stats.secondary.reduce((a,b)=>a+b),0);
  cases.push({pointer,secondary:s.secondary,absorbed:s.absorbed,deposited:s.deposited,energyError:balance-s.emitted});
}
const near=traceGlassLight({x:-20,y:250},[volumes[0]],options),far=traceGlassLight({x:-600,y:250},[volumes[0]],options);
assert.ok(near.stats.intercepted>far.stats.intercepted,"No distance dilution");
assert.ok(cases.some((c,i)=>i && c.deposited!==cases[0].deposited),"Static light distribution");
console.log(JSON.stringify({ok:true,cases,distance:{near:near.stats.intercepted,far:far.stats.intercepted}},null,2));
