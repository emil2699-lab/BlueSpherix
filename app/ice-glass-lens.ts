import { snell, soapSample, unit } from "./ice-glass-volume.ts";

export type LensProfile = { width: number; height: number; radius: number; thickness: number; ior: number; distance: number };
export type LensField = { width: number; height: number; padding: number; range: number; data: Uint8ClampedArray; offsets: Float32Array; gain: number };
const clamp = (x: number, low: number, high: number) => Math.max(low,Math.min(high,x));

/** Backwards camera ray through both curved soap interfaces; slopes in air. */
export function soapLensSlope(x: number, y: number, profile: LensProfile): [number,number] {
  const bx=profile.width*.5, by=profile.height*.5;
  const qx=Math.abs(x)-bx+profile.radius, qy=Math.abs(y)-by+profile.radius;
  const depth=profile.radius-Math.min(Math.max(qx,qy),0)-Math.hypot(Math.max(qx,0),Math.max(qy,0));
  if(depth<=0 || profile.ior===1) return [0,0];
  const top=soapSample(x,y,bx,by,profile.radius,profile.thickness);
  const inside=snell([0,0,-1],unit([-top[0],-top[1],1]),1,profile.ior).direction;
  if(!inside) return [0,0];
  // Intersect z=-h(x,y), using the analytic derivatives of the same surface.
  let path=2*top[2]/-inside[2];
  for(let i=0;i<5;i++) {
    const bottom=soapSample(x+inside[0]*path,y+inside[1]*path,bx,by,profile.radius,profile.thickness);
    const error=top[2]+inside[2]*path+bottom[2];
    const derivative=inside[2]+bottom[0]*inside[0]+bottom[1]*inside[1];
    if(Math.abs(derivative)<.01) return [0,0];
    path=clamp(path-error/derivative,0,profile.thickness*6);
  }
  const bottom=soapSample(x+inside[0]*path,y+inside[1]*path,bx,by,profile.radius,profile.thickness);
  const outgoing=snell(inside,unit([bottom[0],bottom[1],1]),profile.ior,1).direction;
  if(!outgoing || outgoing[2]>=-.2) return [0,0];
  // The grazing shoulder is not a readable lens. Taper its transmitted image
  // into the undistorted DOM instead of showing TIR or a discontinuous fold.
  const edge=clamp((depth-6)/18,0,1), transmission=edge*edge*(3-2*edge);
  return [outgoing[0]/-outgoing[2]*transmission,outgoing[1]/-outgoing[2]*transmission];
}

/** A cached inverse ray map. Only its SVG displacement scale changes per frame. */
export function buildLensField(profile: LensProfile): LensField {
  const padding=24;
  const extentX=profile.width+padding*2, extentY=profile.height+padding*2;
  const odd=(size: number) => Math.max(65,Math.min(193,Math.round(size)|1));
  const width=odd(193*extentX/Math.max(extentX,extentY));
  const height=odd(193*extentY/Math.max(extentX,extentY));
  const stepX=extentX/width, stepY=extentY/height;
  const midX=(width-1)/2, midY=(height-1)/2;
  const offsets=new Float32Array(width*height*2);
  const maxOffset=Math.min(18,Math.min(profile.width,profile.height)*.12);
  // Mirror one quadrant: these normals and the viewing direction are symmetric.
  for(let y=midY;y<height;y++) for(let x=midX;x<width;x++) {
    const px=(x-midX)*stepX, py=(y-midY)*stepY;
    const slope=soapLensSlope(px,py,profile);
    const dx=maxOffset*Math.tanh(profile.distance*slope[0]/maxOffset);
    const dy=maxOffset*Math.tanh(profile.distance*slope[1]/maxOffset);
    offsets[(y*width+x)*2]=dx;
    offsets[(y*width+x)*2+1]=dy;
  }
  // Keep the inverse image upright before the local focal plane is reached.
  // Anchoring the scan at the optical centre preserves symmetry and centring.
  for(let y=midY;y<height;y++) {
    let previous=0;
    for(let x=midX+1;x<width;x++) {
      const i=(y*width+x)*2, px=(x-midX)*stepX;
      previous=Math.min(px,Math.max(px+offsets[i],previous+stepX*.82));
      offsets[i]=previous-px;
    }
  }
  for(let x=midX;x<width;x++) {
    let previous=0;
    for(let y=midY+1;y<height;y++) {
      const i=(y*width+x)*2+1, py=(y-midY)*stepY;
      previous=Math.min(py,Math.max(py+offsets[i],previous+stepY*.82));
      offsets[i]=previous-py;
    }
  }
  for(let y=midY;y<height;y++) for(let x=midX;x<width;x++) {
    const i=(y*width+x)*2, dx=offsets[i],dy=offsets[i+1];
    for(const [xx,sx] of [[x,1],[width-1-x,-1]]) for(const [yy,sy] of [[y,1],[height-1-y,-1]]) {
      const j=(yy*width+xx)*2; offsets[j]=dx*sx; offsets[j+1]=dy*sy;
    }
  }
  // Bound the smallest eigenvalue of the symmetric displacement Jacobian,
  // including cross-axis curvature, rather than merely clamping each channel.
  let minimum=0;
  for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++) {
    const i=(y*width+x)*2;
    const a=(offsets[i+2]-offsets[i-2])/(stepX*2);
    const d=(offsets[i+width*2+1]-offsets[i-width*2+1])/(stepY*2);
    const cross=((offsets[i+width*2]-offsets[i-width*2])/(stepY*2)
      +(offsets[i+3]-offsets[i-1])/(stepX*2))*.5;
    minimum=Math.min(minimum,(a+d)*.5-Math.hypot((a-d)*.5,cross));
  }
  const gain=minimum<-.32 ? -.32/minimum : 1;
  let range=1;
  for(let i=0;i<offsets.length;i++) { offsets[i]*=gain; range=Math.max(range,Math.abs(offsets[i])); }
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++) {
    data[i*4]=Math.round(128+127*offsets[i*2]/range);
    data[i*4+1]=Math.round(128+127*offsets[i*2+1]/range);
    data[i*4+2]=128; data[i*4+3]=255;
  }
  return {width,height,padding,range,data,offsets,gain};
}

type LensEntry = { key: string; id: string; filter: SVGFilterElement; style: SVGStyleElement; image: SVGFEImageElement; displacement: SVGFEDisplacementMapElement; range: number; padding: number; active: boolean; scale: string; projection: number };
const SVG_NS="http://www.w3.org/2000/svg";
let nextLens=0;

/** DOM optics share the existing renderer's lift clock; there is no new loop. */
export function createGlassLenses(definitions: SVGDefsElement) {
  const entries=new Map<HTMLElement,LensEntry>();
  const maps=new Map<string,{href: string; padding: number; range: number}>();
  const bitmap=document.createElement("canvas");
  const context=bitmap.getContext("2d");
  const node=<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string,string | number> = {}) => {
    const element=document.createElementNS(SVG_NS,tag);
    for(const [name,value] of Object.entries(attributes)) element.setAttribute(name,String(value));
    return element;
  };
  const remove=(element: HTMLElement) => {
    const entry=entries.get(element);
    entry?.filter.remove(); entry?.style.remove();
    delete element.dataset.iceLensActive;
    entries.delete(element);
  };
  const update=(element: HTMLElement, profile: LensProfile, lift: number, projection=1) => {
    let entry=entries.get(element);
    if(lift<=0 || !context) {
      if(entry?.active) { delete element.dataset.iceLensActive; entry.active=false; }
      return;
    }
    const key=[profile.width,profile.height,profile.radius,profile.thickness,profile.ior,profile.distance].map(n=>n.toFixed(2)).join(":");
    if(entry?.key!==key) {
      remove(element);
      // Bound retained filters/textures across long dashboard sessions.
      if(entries.size>=16) {
        const idle=Array.from(entries).find(([,value])=>!value.active);
        if(idle) remove(idle[0]);
      }
      let field=maps.get(key);
      if(!field) {
        const rays=buildLensField(profile);
        bitmap.width=rays.width; bitmap.height=rays.height;
        const pixels=context.createImageData(rays.width,rays.height); pixels.data.set(rays.data); context.putImageData(pixels,0,0);
        field={href:bitmap.toDataURL(),padding:rays.padding,range:rays.range};
        if(maps.size>=16) maps.delete(maps.keys().next().value!);
        maps.set(key,field);
      }
      const id=`ice-glass-lens-${++nextLens}`;
      const filter=node("filter",{id,filterUnits:"userSpaceOnUse",primitiveUnits:"userSpaceOnUse",
        x:-field.padding,y:-field.padding,width:profile.width+field.padding*2,height:profile.height+field.padding*2,"color-interpolation-filters":"sRGB"});
      const image=node("feImage",{href:field.href,x:-field.padding,y:-field.padding,
        width:profile.width+field.padding*2,height:profile.height+field.padding*2,preserveAspectRatio:"none",result:"lensRays"});
      filter.append(image);
      // PNG's neutral byte 128 must decode to exactly 0.5, not 128/255.
      const channels=node("feComponentTransfer",{in:"lensRays",result:"lensCoordinates"});
      for(const channel of ["feFuncR","feFuncG"] as const) channels.append(node(channel,{type:"linear",slope:255/254,intercept:-1/254}));
      const displacement=node("feDisplacementMap",{in:"SourceGraphic",in2:"lensCoordinates",scale:0,xChannelSelector:"R",yChannelSelector:"G"});
      filter.append(channels,displacement);
      const style=node("style");
      style.textContent=`html[data-theme="light"] .content[data-ice-glass="ready"] [data-ice-lens-active="${id}"] { filter: url("#${id}"); }`;
      definitions.append(filter,style);
      entry={key,id,filter,style,image,displacement,range:field.range,padding:field.padding,active:false,scale:"0",projection:1};
      entries.set(element,entry);
    }
    const scale=(entry.range*2*lift).toFixed(4);
    if(scale!==entry.scale) { entry.displacement.setAttribute("scale",scale); entry.scale=scale; }
    if(projection!==entry.projection) {
      const width=(profile.width+entry.padding*2)*projection,height=(profile.height+entry.padding*2)*projection;
      entry.image.setAttribute("x",String((profile.width-width)*.5)); entry.image.setAttribute("y",String((profile.height-height)*.5));
      entry.image.setAttribute("width",String(width)); entry.image.setAttribute("height",String(height));
      entry.projection=projection;
    }
    if(!entry.active) { element.dataset.iceLensActive=entry.id; entry.active=true; }
  };
  return {
    update,
    retain(elements: Set<HTMLElement>) { for(const element of entries.keys()) if(!elements.has(element)) remove(element); },
    clear() { for(const element of entries.keys()) remove(element); maps.clear(); },
  };
}
