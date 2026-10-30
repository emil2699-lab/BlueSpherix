export type GlassRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type Beam = { x: number; y: number; dx: number; dy: number; energy: number };

const unit = (x: number, y: number) => { const n = Math.hypot(x,y) || 1; return { x:x/n, y:y/n }; };
function normal(x:number,y:number,r:GlassRect) {
  const left=Math.abs(x-r.left),right=Math.abs(x-r.right),top=Math.abs(y-r.top),bottom=Math.abs(y-r.bottom);
  const nearest=Math.min(left,right,top,bottom);
  const nx=nearest===left?-1:nearest===right?1:0;
  const ny=nearest===top?-1:nearest===bottom?1:0;
  const cx=r.left+r.width*.5,cy=r.top+r.height*.5;
  const curve=nx ? (y-cy)/r.height : (x-cx)/r.width;
  return unit(nx+(ny ? curve*.16:0),ny+(nx ? curve*.16:0));
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
  const invX = 1/(Math.abs(dx)<.0001 ? .0001 : dx);
  const invY = 1/(Math.abs(dy)<.0001 ? .0001 : dy);
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
    const inside=refract(dx,dy,entrance.x,entrance.y,1/1.5);
    const insideHit=crossing(entryX+inside.x*.5,entryY+inside.y*.5,inside.x,inside.y,hit.r);
    if(!insideHit)return null;
    const out=normal(insideHit.x,insideHit.y,hit.r);
    const turn=refract(inside.x,inside.y,-out.x,-out.y,1.5);
    dx=turn.x;dy=turn.y;
    const path=insideHit.exit;
    energy*=.62*Math.exp(-path/Math.max(hit.r.width,hit.r.height));
    x=insideHit.x+dx*1.5;y=insideHit.y+dy*1.5;
  }
  return null;
}
