// CPU companion of soapSurface in ice-glass-shader.ts. The transport mesh is
// cached; the visible material and its analytic normals are not changed.
export type Vec3 = [number, number, number];
export type GlassRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type GlassSurface = { rect: GlassRect; radius: number };
type Vertex = { p: Vec3; n: Vec3 };
export type Triangle = { a: Vertex; b: Vertex; c: Vertex; area: number; center: Vec3; normal: Vec3; e1: Vec3; e2: Vec3 };
type Bounds = { min: Vec3; max: Vec3 };
type Node = Bounds & { children?: [Node, Node]; triangles?: Triangle[] };
export type GlassVolume = { surface: GlassSurface; radius: number; thickness: number; triangles: Triangle[]; tree: Node };
export type Hit = { distance: number; point: Vec3; normal: Vec3; volume: number };
export const add = (a: Vec3, b: Vec3, scale = 1): Vec3 => [a[0]+b[0]*scale,a[1]+b[1]*scale,a[2]+b[2]*scale];
export const dot = (a: Vec3,b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a: Vec3,b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit = (a: Vec3): Vec3 => { const d = Math.hypot(...a) || 1; return [a[0]/d,a[1]/d,a[2]/d]; };
const clamp = (x: number) => Math.max(0,Math.min(1,x));
export function soapSample(x: number,y: number,bx: number,by: number,r: number,t: number): Vec3 {
  const qx=Math.abs(x)-bx+r,qy=Math.abs(y)-by+r;
  const depth=Math.max(0,-(Math.min(Math.max(qx,qy),0)+Math.hypot(Math.max(qx,0),Math.max(qy,0))-r));
  const softness=Math.max(1,Math.min(r*.28,t*.5));
  const ox=Math.exp(-2*Math.abs(x)/softness),oy=Math.exp(-2*Math.abs(y)/softness);
  const ax=bx-Math.abs(x)-softness*Math.log(1+ox),ay=by-Math.abs(y)-softness*Math.log(1+oy);
  const gx=-Math.sign(x)*(1-ox)/(1+ox),gy=-Math.sign(y)*(1-oy)/(1+oy);
  const nearest=Math.min(ax,ay),wx=Math.exp(-(ax-nearest)/softness),wy=Math.exp(-(ay-nearest)/softness),sum=wx+wy;
  const inner=nearest-softness*Math.log(sum),join=Math.max(1,Math.min(r*.85,Math.min(bx,by)*.7));
  const u=clamp((depth-join*.18)/(join*.82)),blend=u*u*(3-2*u),db=6*u*(1-u)/(join*.82);
  const nx=qx>0 && qy>0 ? qx/Math.hypot(qx,qy)*Math.sign(x) : qx>qy ? Math.sign(x) : 0;
  const ny=qx>0 && qy>0 ? qy/Math.hypot(qx,qy)*Math.sign(y) : qx>qy ? 0 : Math.sign(y);
  const body=Math.max(depth+(inner-depth)*blend,0);
  const dx=-nx*(1-blend)+gx*wx/sum*blend-(inner-depth)*db*nx;
  const dy=-ny*(1-blend)+gy*wy/sum*blend-(inner-depth)*db*ny;
  const roll=Math.max(t*2.2,r*1.1),decay=Math.exp(-2*body/roll),cap=Math.sqrt(Math.max(1-decay,0));
  const ux=x/Math.max(bx,1),uy=y/Math.max(by,1),cx=Math.max(1-ux*ux,0),cy=Math.max(1-uy*uy,0);
  const crown=cx*cy,factor=decay/(roll*Math.max(cap,.001));
  return [t*(dx*factor*(1+.30*crown)-cap*.60*ux/Math.max(bx,1)*cy),
    t*(dy*factor*(1+.30*crown)-cap*.60*uy/Math.max(by,1)*cx),t*cap*(1+.30*crown)];
}
function bounds(triangles: Triangle[]): Bounds {
  const min: Vec3=[Infinity,Infinity,Infinity],max: Vec3=[-Infinity,-Infinity,-Infinity];
  for(const tr of triangles) for(const v of [tr.a,tr.b,tr.c]) for(let k=0;k<3;k++) { min[k]=Math.min(min[k],v.p[k]);max[k]=Math.max(max[k],v.p[k]); }
  return {min,max};
}
function buildTree(triangles: Triangle[]): Node {
  const box=bounds(triangles);
  if(triangles.length<=8)return {...box,triangles};
  const lengths=box.max.map((v,k)=>v-box.min[k]),axis=lengths.indexOf(Math.max(...lengths));
  const sorted=[...triangles].sort((a,b)=>a.center[axis]-b.center[axis]),mid=sorted.length>>1;
  return {...box,children:[buildTree(sorted.slice(0,mid)),buildTree(sorted.slice(mid))]};
}
export function buildVolumes(surfaces: GlassSurface[],nominalThickness: number): GlassVolume[] {
  return surfaces.map(surface=>{
    const {rect}=surface,bx=rect.width*.5,by=rect.height*.5;
    const radius=Math.min(Math.min(bx,by)*.95,Math.max(surface.radius*1.75,24));
    const thickness=Math.min(nominalThickness*2.1,Math.min(bx,by)*.50);
    const triangles: Triangle[]=[];
    const vertex=(x:number,y:number,side:number):Vertex=>{
      const h=soapSample(x,y,bx,by,radius,thickness);
      return {p:[x+rect.left+bx,y+rect.top+by,side*h[2]],n:unit([-h[0],-h[1],side])};
    };
    const triangle=(a:Vertex,b:Vertex,c:Vertex)=>{
      const cr=cross(add(b.p,a.p,-1),add(c.p,a.p,-1)),area=Math.hypot(...cr)*.5;
      if(area<1e-7)return;
      triangles.push({a,b,c,area,e1:add(b.p,a.p,-1),e2:add(c.p,a.p,-1),center:[(a.p[0]+b.p[0]+c.p[0])/3,(a.p[1]+b.p[1]+c.p[1])/3,(a.p[2]+b.p[2]+c.p[2])/3],normal:unit(add(add(a.n,b.n),c.n))});
    };
    // Uniform contour arc length avoids oversampling corners of wide cards.
    const perimeter=4*(bx+by-2*radius)+2*Math.PI*radius,segments=40;
    const contour: [number,number][]=[];
    const parts=[2*(bx-radius),Math.PI*radius/2,2*(by-radius),Math.PI*radius/2,2*(bx-radius),Math.PI*radius/2,2*(by-radius),Math.PI*radius/2];
    for(let i=0;i<segments;i++) {
      let distance=i/segments*perimeter,part=0;
      while(part<7 && distance>parts[part])distance-=parts[part++];
      const angle=distance/radius;
      const points: [number,number][]=[[-bx+radius+distance,-by],[bx-radius+radius*Math.sin(angle),-by+radius-radius*Math.cos(angle)],
        [bx,-by+radius+distance],[bx-radius+radius*Math.cos(angle),by-radius+radius*Math.sin(angle)],
        [bx-radius-distance,by],[-bx+radius-radius*Math.sin(angle),by-radius+radius*Math.cos(angle)],
        [-bx,by-radius-distance],[-bx+radius-radius*Math.cos(angle),-by+radius-radius*Math.sin(angle)]];
      contour.push(points[part]);
    }
    for(const side of [1,-1]) {
      let previous=contour.map(()=>vertex(0,0,side));
      for(const scale of [.36,.65,.83,.94,.985,1]) {
        const ring=contour.map(([x,y])=>vertex(x*scale,y*scale,side));
        for(let i=0;i<segments;i++) { const j=(i+1)%segments;triangle(previous[i],ring[i],ring[j]);triangle(previous[i],ring[j],previous[j]); }
        previous=ring;
      }
    }
    return {surface,radius,thickness,triangles,tree:buildTree(triangles)};
  });
}
function intersectsBox(o:Vec3,d:Vec3,box:Bounds,limit:number) {
  let near=0,far=limit;
  for(let k=0;k<3;k++) {
    if(Math.abs(d[k])<1e-10) { if(o[k]<box.min[k] || o[k]>box.max[k])return false;continue; }
    const a=(box.min[k]-o[k])/d[k],b=(box.max[k]-o[k])/d[k];
    near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near)return false;
  }
  return true;
}
export function intersectVolume(origin:Vec3,direction:Vec3,volume:GlassVolume,index:number,limit=Infinity):Hit|null {
  if(!intersectsBox(origin,direction,volume.tree,limit))return null;
  let closest=limit,found=false;
  const [ox,oy,oz]=origin,[dx,dy,dz]=direction;
  const visit=(node:Node)=>{
    if(!intersectsBox(origin,direction,node,closest))return;
    if(node.children) { visit(node.children[0]);visit(node.children[1]);return; }
    for(const tr of node.triangles!) {
      const [ax,ay,az]=tr.e1,[bx,by,bz]=tr.e2;
      const px=dy*bz-dz*by,py=dz*bx-dx*bz,pz=dx*by-dy*bx,det=ax*px+ay*py+az*pz;
      if(Math.abs(det)<1e-9)continue;
      const tx=ox-tr.a.p[0],ty=oy-tr.a.p[1],tz=oz-tr.a.p[2];
      const u=(tx*px+ty*py+tz*pz)/det;
      if(u<0 || u>1)continue;
      const qx=ty*az-tz*ay,qy=tz*ax-tx*az,qz=tx*ay-ty*ax;
      const v=(dx*qx+dy*qy+dz*qz)/det;
      if(v<0 || u+v>1)continue;
      const distance=(bx*qx+by*qy+bz*qz)/det;
      if(distance<.015 || distance>=closest)continue;
      closest=distance;found=true;
    }
  };
  visit(volume.tree);
  if(!found)return null;
  const point=add(origin,direction,closest),r=volume.surface.rect;
  const sample=soapSample(point[0]-r.left-r.width*.5,point[1]-r.top-r.height*.5,r.width*.5,r.height*.5,volume.radius,volume.thickness);
  return {distance:closest,point,normal:unit([-sample[0],-sample[1],point[2]>=0 ? 1 : -1]),volume:index};
}
export function intersectScene(o:Vec3,d:Vec3,volumes:GlassVolume[],exclude=-1,limit=Infinity):Hit|null {
  let hit:Hit|null=null;
  for(let i=0;i<volumes.length;i++)if(i!==exclude) {
    const candidate=intersectVolume(o,d,volumes[i],i,hit?.distance ?? limit);
    if(candidate)hit=candidate;
  }
  return hit;
}
export function snell(direction:Vec3,normal:Vec3,n1:number,n2:number) {
  const cosine=Math.max(0,Math.min(1,-dot(direction,normal))),eta=n1/n2,k=1-eta*eta*(1-cosine*cosine);
  if(k<0)return {direction:null,reflectance:1};
  const ct=Math.sqrt(k),rs=(n1*cosine-n2*ct)/(n1*cosine+n2*ct),rp=(n2*cosine-n1*ct)/(n2*cosine+n1*ct);
  return {direction:unit(add(direction.map(v=>v*eta) as Vec3,normal,eta*cosine-ct)),reflectance:(rs*rs+rp*rp)*.5};
}

// Flatten the same cached scene into a GPU-readable BVH. Three texels per
// node/triangle; a leaf stores triangle start/count instead of child indices.
export function packScene(volumes:GlassVolume[]) {
  const tagged=volumes.flatMap((v,card)=>v.triangles.map(triangle=>({triangle,card})));
  const nodes:number[][]=[],triangles:number[][]=[];
  const build=(items:typeof tagged):number=>{
    const box=bounds(items.map(x=>x.triangle)),index=nodes.length;nodes.push([]);
    if(items.length<=6) {
      const start=triangles.length;
      for(const {triangle:t,card} of items)triangles.push([...t.a.p,card,...t.b.p,0,...t.c.p,0]);
      nodes[index]=[...box.min,-1,...box.max,-1,start,items.length,0,0];
    } else {
      const lengths=box.max.map((v,k)=>v-box.min[k]),axis=lengths.indexOf(Math.max(...lengths));
      items.sort((a,b)=>a.triangle.center[axis]-b.triangle.center[axis]);const mid=items.length>>1;
      const left=build(items.slice(0,mid)),right=build(items.slice(mid));
      nodes[index]=[...box.min,left,...box.max,right,0,0,0,0];
    }
    return index;
  };
  if(tagged.length)build(tagged);
  const offset=nodes.length*3,values=[...nodes.flat(),...triangles.flat()];
  const width=1024,height=Math.max(1,Math.ceil(values.length/(width*4))),data=new Float32Array(width*height*4);data.set(values);
  return {data,width,height,triangleOffset:offset};
}
