export type GlassRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type Beam = { x: number; y: number; dx: number; dy: number; energy: number };

const unit = (x: number, y: number) => { const n = Math.hypot(x,y) || 1; return { x:x/n, y:y/n }; };
const smoothstep = (a:number,b:number,value:number) => {
  const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
  return t*t*(3-2*t);
};
function normal(x:number,y:number,r:GlassRect) {
  const left=Math.abs(x-r.left),right=Math.abs(x-r.right),top=Math.abs(y-r.top),bottom=Math.abs(y-r.bottom);
  const nearest=Math.min(left,right,top,bottom);
  const softness=Math.max(9,Math.min(r.width,r.height)*.12);
  const wl=Math.exp(-(left-nearest)/softness),wr=Math.exp(-(right-nearest)/softness);
  const wt=Math.exp(-(top-nearest)/softness),wb=Math.exp(-(bottom-nearest)/softness);
  return unit(wr-wl,wb-wt);
}
function crossingConfidence(x:number,y:number,dx:number,dy:number,r:GlassRect) {
  const left=Math.abs(x-r.left),right=Math.abs(x-r.right),top=Math.abs(y-r.top),bottom=Math.abs(y-r.bottom);
  const vertical=Math.min(left,right)<Math.min(top,bottom);
  const cornerDistance=vertical ? Math.min(Math.abs(y-r.top),Math.abs(r.bottom-y)) : Math.min(Math.abs(x-r.left),Math.abs(r.right-x));
  const cornerFade=Math.max(12,Math.min(r.width,r.height)*.14);
  const n=normal(x,y,r);
  const incidence=Math.abs(dx*n.x+dy*n.y);
  return smoothstep(0,cornerFade,cornerDistance)*smoothstep(.035,.18,incidence);
}
function refract(dx:number,dy:number,nx:number,ny:number,ior:number) {
  const cosine=-(dx*nx+dy*ny);
  const k=1-ior*ior*(1-cosine*cosine);
  if(k<0)return unit(dx,dy);
  return unit(ior*dx+(ior*cosine-Math.sqrt(k))*nx,ior*dy+(ior*cosine-Math.sqrt(k))*ny);
}

// Screen-space slab approximation. The forward ray crosses up to maxBounces
// different glass cards; its exit face bends its direction before the next hit.
function crossing(x: number, y: number, dx: number, dy: number, r: GlassRect) {
  const safeX=Math.abs(dx)<.0001 ? (dx<0 ? -.0001 : .0001) : dx;
  const safeY=Math.abs(dy)<.0001 ? (dy<0 ? -.0001 : .0001) : dy;
  const invX = 1/safeX;
  const invY = 1/safeY;
  const tx1=(r.left-x)*invX, tx2=(r.right-x)*invX;
  const ty1=(r.top-y)*invY, ty2=(r.bottom-y)*invY;
  const enter=Math.max(Math.min(tx1,tx2),Math.min(ty1,ty2),0);
  const exit=Math.min(Math.max(tx1,tx2),Math.max(ty1,ty2));
  return exit>enter && exit>0 ? {enter,exit,x:x+dx*exit,y:y+dy*exit} : null;
}

export function secondaryBeam(pointer: {x:number;y:number}, target: GlassRect, surfaces: GlassRect[], maxBounces = 2): Beam | null {
  const center=unit(target.left+target.width*.5-pointer.x,target.top+target.height*.5-pointer.y);
  let x=pointer.x,y=pointer.y,dx=center.x,dy=center.y,energy=1,through=0;
  const visited=new Set<GlassRect>();
  for(let step=0;step<=maxBounces;step++) {
    const hits=surfaces.flatMap(r=>{
      if(visited.has(r))return [];
      const hit=crossing(x,y,dx,dy,r);
      return hit ? [{r,...hit}] : [];
    }).sort((a,b)=>a.enter-b.enter);
    const hit=hits[0];
    if(!hit)return null;
    if(hit.r===target)return through>0 ? {x,y,dx,dy,energy} : null;
    if(step===maxBounces)return null;
    visited.add(hit.r);through++;
    // Snell at entry and exit of the projected volume, with rounded-face
    // normals and absorption before the next card receives the emergent ray.
    const entryX=x+dx*hit.enter,entryY=y+dy*hit.enter;
    const entrance=normal(entryX,entryY,hit.r);
    const entranceConfidence=crossingConfidence(entryX,entryY,dx,dy,hit.r);
    const inside=refract(dx,dy,entrance.x,entrance.y,1/1.5);
    const insideHit=crossing(entryX+inside.x*.5,entryY+inside.y*.5,inside.x,inside.y,hit.r);
    if(!insideHit)return null;
    const out=normal(insideHit.x,insideHit.y,hit.r);
    const exitConfidence=crossingConfidence(insideHit.x,insideHit.y,inside.x,inside.y,hit.r);
    const turn=refract(inside.x,inside.y,-out.x,-out.y,1.5);
    dx=turn.x;dy=turn.y;
    const path=insideHit.exit;
    energy*=.62*Math.exp(-path/Math.max(hit.r.width,hit.r.height))*entranceConfidence*exitConfidence;
    x=insideHit.x+dx*1.5;y=insideHit.y+dy*1.5;
  }
  return null;
}
