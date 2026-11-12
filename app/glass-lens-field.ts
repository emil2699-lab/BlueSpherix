import { snell, soapSample, unit } from "./ice-glass-volume.ts";

export type LensProfile = { width: number; height: number; radius: number; thickness: number; ior: number; distance: number; paraxial?: number; left?: number; top?: number };
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
  // The paraxial component can move pixels farther than the traced shoulder.
  // Include that travel in the SVG filter region so wide Today cards do not
  // crop their magnified text at the polished rim.
  const padding=Math.ceil(Math.max(24,Math.max(profile.width,profile.height)*(profile.paraxial ?? 0)*.5+12));
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
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*2;
    // A shallow paraxial inverse map exposes the magnification of a convex
    // lens without replacing the traced curved-surface distortion. Fade that
    // term through the rolled shoulder, where transmitted content must merge
    // back into the fixed DOM instead of being cut off by the silhouette.
    const px=(x-midX)*stepX,py=(y-midY)*stepY;
    const qx=Math.abs(px)-profile.width*.5+profile.radius;
    const qy=Math.abs(py)-profile.height*.5+profile.radius;
    const depth=profile.radius-Math.min(Math.max(qx,qy),0)-Math.hypot(Math.max(qx,0),Math.max(qy,0));
    // Finish the merge inside the optical lip. Letting this transition cross
    // the content area would locally compress glyphs even though the map never
    // mathematically folds.
    const shoulder=clamp((depth-3)/15,0,1);
    const transmission=shoulder*shoulder*(3-2*shoulder);
    offsets[i]=offsets[i]*gain-px*(profile.paraxial ?? 0)*transmission;
    offsets[i+1]=offsets[i+1]*gain-py*(profile.paraxial ?? 0)*transmission;
  }
  // The shoulder taper contributes its own derivative. Re-evaluate the whole
  // inverse map after combining traced and paraxial terms, then uniformly
  // reduce it if needed so glyphs can enlarge without folding or pinching.
  let combinedMinimum=0;
  for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++) {
    const i=(y*width+x)*2;
    const a=(offsets[i+2]-offsets[i-2])/(stepX*2);
    const d=(offsets[i+width*2+1]-offsets[i-width*2+1])/(stepY*2);
    const cross=((offsets[i+width*2]-offsets[i-width*2])/(stepY*2)
      +(offsets[i+3]-offsets[i-1])/(stepX*2))*.5;
    combinedMinimum=Math.min(combinedMinimum,(a+d)*.5-Math.hypot((a-d)*.5,cross));
  }
  const readabilityGain=combinedMinimum<-.42 ? -.42/combinedMinimum : 1;
  for(let i=0;i<offsets.length;i++) {
    offsets[i]*=readabilityGain;
    range=Math.max(range,Math.abs(offsets[i]));
  }
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++) {
    data[i*4]=Math.round(128+127*offsets[i*2]/range);
    data[i*4+1]=Math.round(128+127*offsets[i*2+1]/range);
    data[i*4+2]=128; data[i*4+3]=255;
  }
  return {width,height,padding,range,data,offsets,gain:gain*readabilityGain};
}
