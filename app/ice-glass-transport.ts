import { add, dot, unit, snell, soapSample, intersectScene, intersectVolume, type GlassVolume, type Vec3 } from "./ice-glass-volume.ts";

export const PHOTON_TILE = { width: 96, height: 64, columns: 4 } as const;
export type TransportOptions = { ior: number; dispersion: number; intensity: number; lightHeight: number; roughness: number; maxBounces: number; debug?: boolean };
export type RaySegment = { from: Vec3; to: Vec3; energy: number; channel: number; card: number; kind: "incident"|"internal"|"secondary" };
export type TransportStats = { emitted: number; intercepted: number; escaped: number; absorbed: number; deposited: number; terminated: number; entries: number[]; exits: number[]; secondary: number[]; internalReflections: number; segments: RaySegment[] };
export type PhotonAtlas = { data: Float32Array; width: number; height: number; stats: TransportStats };
type Path = { origin: Vec3; direction: Vec3; energy: number; medium: number; interactions: number; last: number; steps: number };

export function traceGlassLight(pointer: {x:number;y:number},volumes:GlassVolume[],options:TransportOptions):PhotonAtlas {
  const {width:tw,height:th,columns}=PHOTON_TILE,width=tw*columns,height=th*Math.max(1,Math.ceil(volumes.length/columns));
  const data=new Float32Array(width*height*4),source:Vec3=[pointer.x,pointer.y,options.lightHeight];
  // Flux per solid angle. Dilution follows the sampled angle and receiving
  // footprint; distance is not applied a second time on every air segment.
  const power=options.intensity*options.lightHeight*options.lightHeight;
  const stats:TransportStats={emitted:4*Math.PI*power,intercepted:0,escaped:0,absorbed:0,deposited:0,terminated:0,entries:volumes.map(()=>0),exits:volumes.map(()=>0),secondary:volumes.map(()=>0),internalReflections:0,segments:[]};
  const scatter=options.roughness*options.roughness;
  const kernelIndices=new Int32Array(36),kernelWeights=new Float64Array(36);
  const deposit=(card:number,p:Vec3,energy:number,channel:number)=>{
    const r=volumes[card].surface.rect,cx=(p[0]-r.left)/r.width*tw-.5,cy=(p[1]-r.top)/r.height*th-.5;
    const tileX=card%columns*tw,tileY=Math.floor(card/columns)*th,countStart=0;
    let sum=0,count=countStart;
    // Normalized reconstruction estimates photon flux / surface area. More
    // rays in a smaller footprint brighten it without increasing energy.
    for(let y=Math.max(0,Math.ceil(cy-2.5));y<=Math.min(th-1,Math.floor(cy+2.5));y++)for(let x=Math.max(0,Math.ceil(cx-2.5));x<=Math.min(tw-1,Math.floor(cx+2.5));x++) {
      const px=(x+.5)/tw*r.width-r.width*.5,py=(y+.5)/th*r.height-r.height*.5;
      const qx=Math.abs(px)-r.width*.5+volumes[card].radius,qy=Math.abs(py)-r.height*.5+volumes[card].radius;
      if(Math.min(Math.max(qx,qy),0)+Math.hypot(Math.max(qx,0),Math.max(qy,0))>volumes[card].radius)continue;
      const w=Math.exp(-((x-cx)**2+(y-cy)**2)*.65);sum+=w;kernelIndices[count]=((tileY+y)*width+tileX+x)*4+channel;kernelWeights[count++]=w;
    }
    if(!sum) { stats.escaped+=energy;return; }
    const pixelArea=r.width*r.height/(tw*th);
    for(let i=0;i<count;i++)data[kernelIndices[i]]+=energy*kernelWeights[i]/(sum*pixelArea);
    stats.deposited+=energy;
  };
  // Surface quadrature importance-samples one isotropic point source. Only the
  // nearest visible surface owns a solid angle; no target-centre beam is used.
  const seeds:{card:number;point:Vec3;normal:Vec3;direction:Vec3;solidAngle:number}[]=[];
  let totalAngle=0;
  for(let card=0;card<volumes.length;card++)for(const triangle of volumes[card].triangles) {
    const delta=add(triangle.center,source,-1),distance=Math.hypot(...delta),direction=unit(delta);
    const volume=volumes[card],r=volume.surface.rect;
    const sample=soapSample(triangle.center[0]-r.left-r.width*.5,triangle.center[1]-r.top-r.height*.5,r.width*.5,r.height*.5,volume.radius,volume.thickness);
    const normal=unit([-sample[0],-sample[1],triangle.center[2]>=0 ? 1 : -1]);
    const cosine=-dot(direction,normal);
    if(cosine<=0)continue;
    const blocker=intersectScene(source,direction,volumes,-1,distance-.04);
    if(blocker)continue;
    const solidAngle=cosine*triangle.area/(distance*distance);
    totalAngle+=solidAngle;seeds.push({card,point:triangle.center,normal,direction,solidAngle});
  }
  const normalization=Math.min(1,4*Math.PI/Math.max(totalAngle,1e-10));
  for(const seed of seeds)for(let channel=0;channel<3;channel++) {
    const energy=power*seed.solidAngle*normalization/3;
    stats.intercepted+=energy;
    const ior=options.ior+(channel-1)*options.dispersion;
    const paths:Path[]=[{origin:source,direction:seed.direction,energy,medium:-1,interactions:0,last:-1,steps:0}];
    let first=true;
    while(paths.length) {
      const path=paths.pop()!;
      if(path.steps>=7 || (path.medium<0 && path.interactions>=options.maxBounces+1) || path.energy<1e-6) { stats.terminated+=path.energy;continue; }
      const hit=first ? {point:seed.point,normal:seed.normal,volume:seed.card,distance:Math.hypot(...add(seed.point,source,-1))}
        : path.medium>=0 ? intersectVolume(path.origin,path.direction,volumes[path.medium],path.medium)
        : intersectScene(path.origin,path.direction,volumes,path.last);
      first=false;
      if(!hit) { stats.escaped+=path.energy;continue; }
      const inside=path.medium>=0;
      if(options.debug && stats.segments.length<6000)stats.segments.push({from:path.origin,to:hit.point,energy:path.energy,channel,card:hit.volume,kind:inside ? "internal" : path.interactions ? "secondary" : "incident"});
      let incoming=path.energy;
      if(inside) { incoming*=Math.exp(-[.09,.06,.035][channel]*.12*hit.distance);stats.absorbed+=path.energy-incoming;stats.exits[hit.volume]++; }
      else { stats.entries[hit.volume]++;if(path.interactions)stats.secondary[hit.volume]++; }
      const n=inside ? hit.normal.map(v=>-v) as Vec3 : hit.normal;
      const optical=snell(path.direction,n,inside ? ior : 1,inside ? 1 : ior);
      const reflected=unit(add(path.direction,n,-2*dot(path.direction,n)));
      let rEnergy=incoming*optical.reflectance,tEnergy=incoming-rEnergy;
      // Direct highlights stay untouched. Only scattering at exits or at later
      // receivers contributes to this atlas, deducted from the outgoing flux.
      if(inside || path.interactions>0) {
        const diffuse=(rEnergy+tEnergy*.5)*scatter;
        deposit(hit.volume,hit.point,diffuse,channel);
        rEnergy*=1-scatter;tEnergy*=1-scatter*.5;
      }
      if(!optical.direction)stats.internalReflections++;
      const interactions=path.interactions+(inside ? 0 : 1),steps=path.steps+1;
      if(optical.direction) {
        // Match the bounded GPU solver: follow transmission and remove the
        // untraced reflected branch from its energy budget.
        stats.terminated+=rEnergy;
        paths.push({origin:add(hit.point,optical.direction,.04),direction:optical.direction,energy:tEnergy,medium:inside ? -1 : hit.volume,interactions,last:hit.volume,steps});
      } else paths.push({origin:add(hit.point,reflected,.04),direction:reflected,energy:rEnergy,medium:path.medium,interactions,last:hit.volume,steps});
    }
  }
  stats.escaped+=stats.emitted-stats.intercepted;
  return {data,width,height,stats};
}
