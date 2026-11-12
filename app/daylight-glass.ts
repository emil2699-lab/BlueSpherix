/** Today material: a shallow clear slab and one shared, finite daylight source. */
export const DAYLIGHT_GLASS = {
  lift: 48,
  perspective: 900,
  labelRatio: .5,
  thickness: 8,
  clearance: 5,
  // Direction to a distant area source, in page XY / viewer-facing Z space.
  sun: [-.38, -.56, 1.4] as const,
  angularRadius: .045,
  meshColumns: 56,
  meshRows: 40,
} as const;

export function daylightPlanes(progress: number) {
  const glassZ = Math.max(0, Math.min(1, progress)) * DAYLIGHT_GLASS.lift;
  const labelZ = glassZ * DAYLIGHT_GLASS.labelRatio;
  const project = (z: number) => DAYLIGHT_GLASS.perspective / (DAYLIGHT_GLASS.perspective - z);
  return { glassZ, labelZ, glassScale: project(glassZ), labelScale: project(labelZ) };
}

/** Included after glassGeometry. No noise or time-dependent material normals. */
export const daylightMaterial = `
uniform float uReferenceGlass;
uniform vec3 uSun;
vec4 referenceGlass(vec2 pixel) {
  vec2 halfSize=uRect.zw*.5;
  vec2 base=pixel-uRect.xy-halfSize;
  vec2 p=base/uProjection;
  float radius=min(uRadius,min(halfSize.x,halfSize.y)*.95);
  float d=boxSDF(p,halfSize,radius);
  float aa=1.1/(uDPR*uProjection);
  float coverage=1.0-smoothstep(-aa,aa,d);
  float depth=max(-d,0.0);
  float thickness=min(${DAYLIGHT_GLASS.thickness.toFixed(1)},min(halfSize.x,halfSize.y)*.4);
  float elevation=${DAYLIGHT_GLASS.clearance.toFixed(1)}+uLift*uLiftDistance;
  vec3 L=normalize(uSun);
  // Clear dielectric blocks only a small fraction of light: broad transmission
  // loss, not an opaque rectangle. Penumbra expands with the same elevation.
  vec2 shadowShift=-L.xy/L.z*(elevation+thickness*.55);
  float shadowD=boxSDF(base-shadowShift,halfSize,radius);
  float penumbra=3.5+elevation*.16;
  float shadowCoverage=1.0-smoothstep(-penumbra,penumbra*2.0,shadowD);
  float shadowRim=exp(-pow(shadowD/(penumbra*1.35),2.0));
  float shadowAlpha=shadowCoverage*.028+shadowRim*(.088-.018*uLift);
  vec4 result=vec4(vec3(.12,.22,.24)*shadowAlpha,shadowAlpha);
  if(coverage<.001) return result;
  vec3 surface=soapSurface(p,halfSize,radius,thickness);
  vec3 N=normalize(vec3(-surface.xy,1.0));
  vec2 edgeNormal=roundedSurfaceNormal(p,halfSize,radius);
  vec3 R=reflect(vec3(0,0,-1),N);
  float f0=pow((uGlass.x-1.0)/(uGlass.x+1.0),2.0);
  float fresnel=f0+(1.0-f0)*pow(1.0-max(N.z,0.0),5.0);
  float facing=dot(edgeNormal,normalize(L.xy));
  float lit=.5+.5*facing;
  // Narrow absorbing seam, clear polished interface, then the broad rolled
  // shoulder. Each follows the same rounded contour and its changing normals.
  float seam=exp(-pow((depth-1.15)/.88,2.0));
  float innerSeam=exp(-pow((depth-4.2)/.72,2.0));
  float polish=exp(-pow((depth-2.65)/.80,2.0));
  float innerPolish=exp(-pow((depth-5.7)/1.1,2.0));
  float shoulder=exp(-pow((depth-10.5)/5.2,2.0));
  float absorption=(seam*(.48+.28*lit)+innerSeam*.20)*coverage;
  float faceAlpha=(.018+.024*fresnel+.014*shoulder)*coverage;
  float materialAlpha=clamp(absorption+faceAlpha,0.0,.78);
  vec3 material=mix(vec3(.36,.72,.72),vec3(.035,.28,.30),seam*.86);
  vec3 radiance=material*materialAlpha;
  float window=exp(-pow((R.y+.56)/.24,2.0))*(.52+.48*lit);
  float reflection=(polish*(.25+.62*lit)+innerPolish*(.14+.35*(1.0-lit))
    +shoulder*window*.18)*coverage;
  float reflectionAlpha=clamp(reflection,0.0,.85);
  radiance=radiance*(1.0-reflectionAlpha)+vec3(.96,1.0,.99)*reflectionAlpha;
  materialAlpha=reflectionAlpha+materialAlpha*(1.0-reflectionAlpha);
  // Very broad, low-opacity reflection on the convex face; no white frosting.
  float faceReflection=pow(max(dot(N,normalize(L+vec3(0,0,1))),0.0),18.0)*.024*coverage;
  radiance+=vec3(.78,.94,.97)*faceReflection;
  return vec4(radiance+result.rgb*(1.0-materialAlpha),
    materialAlpha+result.a*(1.0-materialAlpha));
}
`;

export const daylightCausticVertex = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uDPR;
uniform vec4 uRect;
uniform float uRadius;
uniform float uElevation;
uniform float uIOR;
uniform vec3 uSun;
out vec2 vSource;
out float vTransmission;
out vec2 vSize;
flat out float vRadius;
__GEOMETRY__
void main() {
  const int columns=${DAYLIGHT_GLASS.meshColumns};
  const int rows=${DAYLIGHT_GLASS.meshRows};
  const int vertices=columns*rows*6;
  int sampleIndex=gl_VertexID/vertices;
  int index=gl_VertexID%vertices;
  int cell=index/6;
  ivec2 corner[6]=ivec2[6](ivec2(0,0),ivec2(1,0),ivec2(0,1),ivec2(0,1),ivec2(1,0),ivec2(1,1));
  vec2 uv=(vec2(cell%columns,cell/columns)+vec2(corner[index%6]))/vec2(columns,rows);
  vec2 t=uv*2.0-1.0;
  // Spend more vertices on the rolled shoulder where the normals change fast.
  vec2 p=sign(t)*(1.0-pow(1.0-abs(t),vec2(1.65)))*uRect.zw*.5;
  vec2 b=uRect.zw*.5;
  float thickness=min(${DAYLIGHT_GLASS.thickness.toFixed(1)},min(b.x,b.y)*.4);
  vec3 surface=soapSurface(p,b,uRadius,thickness);
  vec3 N=normalize(vec3(-surface.xy,1.0));
  vec2 aperture[3]=vec2[3](vec2(-.866,-.5),vec2(.866,-.5),vec2(0,1));
  vec3 L=normalize(uSun+vec3(aperture[sampleIndex]*${DAYLIGHT_GLASS.angularRadius.toFixed(3)},0));
  vec3 inside=refract(-L,N,1.0/uIOR);
  float path=surface.z/max(-inside.z,.01);
  vec2 exitPoint=p+inside.xy*path;
  vec3 outgoing=refract(inside,vec3(0,0,1),uIOR);
  float valid=step(.01,-outgoing.z);
  vec2 target=exitPoint+outgoing.xy*(uElevation/max(-outgoing.z,.01));
  float f0=pow((uIOR-1.0)/(uIOR+1.0),2.0);
  float reflected=f0+(1.0-f0)*pow(1.0-max(dot(N,L),0.0),5.0);
  vTransmission=(1.0-reflected)*(1.0-f0)*exp(-.003*path)*valid/3.0;
  vSource=p;
  vSize=b;
  vRadius=uRadius;
  vec2 pixel=uRect.xy+b+target;
  vec2 clip=pixel*uDPR/uResolution*2.0-1.0;
  gl_Position=vec4(clip.x,-clip.y,0,1);
}`;

export const daylightCausticFragment = `#version 300 es
precision highp float;
uniform float uDPR;
in vec2 vSource;
in float vTransmission;
in vec2 vSize;
flat in float vRadius;
out vec4 outColor;
void main() {
  vec2 q=abs(vSource)-vSize+vRadius;
  float d=min(max(q.x,q.y),0.0)+length(max(q,0.0))-vRadius;
  if(d>-.7 || vTransmission<=0.0) discard;
  vec2 dx=dFdx(vSource)*uDPR,dy=dFdy(vSource)*uDPR;
  float flux=abs(dx.x*dy.y-dx.y*dy.x);
  // Source area / receiver area transports concentrated flux. Normal flat
  // transmission is left to the transparent material, not painted as a glow.
  float focused=max(flux-1.06,0.0)*vTransmission;
  float intensity=(1.0-exp(-focused*.22))*.19;
  float edgeFade=smoothstep(.7,2.4,-d);
  intensity*=edgeFade;
  if(intensity<.0001) discard;
  float alpha=intensity*.30;
  outColor=vec4(vec3(alpha)+vec3(.72,.91,.86)*intensity,alpha);
}`;

/** Extra pass in the existing context; no additional canvas or animation loop. */
export function createDaylightCaustics(gl: WebGL2RenderingContext, geometry: string) {
  const shaders: WebGLShader[] = [];
  const programs: WebGLProgram[] = [];
  const compile = (vertex: string, fragment: string) => {
    const program = gl.createProgram();
    if (!program) throw new Error("Daylight glass: program unavailable");
    programs.push(program);
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader=gl.createShader(type);
      if (!shader) throw new Error("Daylight glass: shader unavailable");
      shaders.push(shader); gl.shaderSource(shader,source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Caustic compilation failed");
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Caustic link failed");
    return program;
  };
  let rays: WebGLProgram, composite: WebGLProgram;
  try {
    rays=compile(daylightCausticVertex.replace("__GEOMETRY__", geometry),daylightCausticFragment);
    composite=compile(`#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uDPR;
uniform vec4 uQuad;
out vec2 vUV;
void main(){
  vec2 uv[6]=vec2[6](vec2(0,0),vec2(1,0),vec2(0,1),vec2(0,1),vec2(1,0),vec2(1,1));
  vUV=uv[gl_VertexID];
  vec2 clip=(uQuad.xy+vUV*uQuad.zw)*uDPR/uResolution*2.0-1.0;
  gl_Position=vec4(clip.x,-clip.y,0,1);
}`,`#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uBlur;
in vec2 vUV;
out vec4 outColor;
void main(){
  vec2 uv=vec2(vUV.x,1.0-vUV.y);
  vec4 core=texture(uField,uv);
  vec4 soft=core*.25;
  soft+=(texture(uField,uv+vec2(uBlur.x,0))+texture(uField,uv-vec2(uBlur.x,0))
    +texture(uField,uv+vec2(0,uBlur.y))+texture(uField,uv-vec2(0,uBlur.y)))*.125;
  soft+=(texture(uField,uv+uBlur)+texture(uField,uv-uBlur)
    +texture(uField,uv+vec2(uBlur.x,-uBlur.y))+texture(uField,uv+vec2(-uBlur.x,uBlur.y)))*.0625;
  outColor=core*.35+soft*.65;
}`);
  } catch (error) {
    shaders.forEach(shader=>gl.deleteShader(shader)); programs.forEach(program=>gl.deleteProgram(program)); throw error;
  }
  const framebuffer=gl.createFramebuffer();
  if (!framebuffer) {
    shaders.forEach(shader=>gl.deleteShader(shader)); programs.forEach(program=>gl.deleteProgram(program));
    throw new Error("Daylight glass: framebuffer unavailable");
  }
  const cache=new Map<HTMLElement,{texture: WebGLTexture; key: string; width: number; height: number}>();
  const locations=new Map<WebGLProgram,Map<string,WebGLUniformLocation | null>>();
  const uniform=(program: WebGLProgram,name: string) => {
    if(!locations.has(program)) locations.set(program,new Map());
    const map=locations.get(program)!;
    if(!map.has(name)) map.set(name,gl.getUniformLocation(program,name));
    return map.get(name)!;
  };
  type Rect={left: number; top: number; width: number; height: number};
  return {
    draw(element: HTMLElement,width: number,height: number,dpr: number,rect: Rect,drawRect: Rect,radius: number,lift: number,ior: number) {
      const pad=96, quality=Math.min(.65,1024/(rect.width+pad*2),1024/(rect.height+pad*2));
      const tw=Math.ceil((rect.width+pad*2)*quality),th=Math.ceil((rect.height+pad*2)*quality);
      const elevation=DAYLIGHT_GLASS.clearance+DAYLIGHT_GLASS.lift*lift;
      const key=[tw,th,rect.width,rect.height,radius,elevation.toFixed(2),ior].join(":");
      let entry=cache.get(element);
      if(!entry) {
        const texture=gl.createTexture();
        if(!texture) return;
        entry={texture,key:"",width:0,height:0};cache.set(element,entry);
      }
      if(entry.key!==key) {
        gl.bindTexture(gl.TEXTURE_2D,entry.texture);
        if(entry.width!==tw || entry.height!==th) {
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tw,th,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,entry.texture,0);
        gl.viewport(0,0,tw,th);gl.scissor(0,0,tw,th);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(rays);
        gl.uniform2f(uniform(rays,"uResolution"),tw,th);gl.uniform1f(uniform(rays,"uDPR"),quality);
        gl.uniform4f(uniform(rays,"uRect"),pad,pad,rect.width,rect.height);
        gl.uniform1f(uniform(rays,"uRadius"),Math.min(radius,rect.width*.475,rect.height*.475));
        gl.uniform1f(uniform(rays,"uElevation"),elevation);gl.uniform1f(uniform(rays,"uIOR"),ior);
        gl.uniform3f(uniform(rays,"uSun"),...DAYLIGHT_GLASS.sun);
        gl.drawArrays(gl.TRIANGLES,0,DAYLIGHT_GLASS.meshColumns*DAYLIGHT_GLASS.meshRows*6*3);
        entry.key=key;entry.width=tw;entry.height=th;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);
      const left=Math.max(0,Math.floor(drawRect.left*dpr)),bottom=Math.max(0,Math.floor(height-(drawRect.top+drawRect.height)*dpr));
      gl.scissor(left,bottom,Math.max(0,Math.min(width,Math.ceil((drawRect.left+drawRect.width)*dpr))-left),Math.max(0,Math.min(height,Math.ceil(height-drawRect.top*dpr))-bottom));
      gl.useProgram(composite);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,entry.texture);
      gl.uniform1i(uniform(composite,"uField"),0);
      gl.uniform2f(uniform(composite,"uResolution"),width,height);gl.uniform1f(uniform(composite,"uDPR"),dpr);
      gl.uniform4f(uniform(composite,"uQuad"),rect.left-pad,rect.top-pad,tw/quality,th/quality);
      const blur=(1.3+elevation*DAYLIGHT_GLASS.angularRadius)*quality;
      gl.uniform2f(uniform(composite,"uBlur"),blur/tw,blur/th);
      gl.drawArrays(gl.TRIANGLES,0,6);
    },
    retain(elements: Set<HTMLElement>) {
      for(const [element,entry] of cache) if(!elements.has(element)) {gl.deleteTexture(entry.texture);cache.delete(element);}
    },
    dispose() {
      for(const entry of cache.values())gl.deleteTexture(entry.texture);
      cache.clear();gl.deleteFramebuffer(framebuffer);
      shaders.forEach(shader=>gl.deleteShader(shader));programs.forEach(program=>gl.deleteProgram(program));
    },
  };
}
