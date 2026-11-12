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
  // Restore only the visible soap profile from 3f3fcd6. Keep the approved
  // transmission footprint for the shadow and the separate caustic pass.
  float radius=min(56.0,min(halfSize.x,halfSize.y)*.95);
  float d=boxSDF(p,halfSize,radius);
  float aa=1.25/(uDPR*uProjection);
  float coverage=1.0-smoothstep(-aa,0.0,d);
  float depth=-d;
  float thickness=min(${DAYLIGHT_GLASS.thickness.toFixed(1)},min(halfSize.x,halfSize.y)*.4);
  float elevation=${DAYLIGHT_GLASS.clearance.toFixed(1)}+uLift*uLiftDistance;
  vec3 L=normalize(uSun);
  // Clear dielectric blocks only a small fraction of light: broad transmission
  // loss, not an opaque rectangle. Penumbra expands with the same elevation.
  vec2 shadowShift=-L.xy/L.z*(elevation+thickness*.55);
  float shadowRadius=min(uRadius,min(halfSize.x,halfSize.y)*.95);
  float shadowD=boxSDF(base-shadowShift,halfSize,shadowRadius);
  float penumbra=3.5+elevation*.16;
  float shadowCoverage=1.0-smoothstep(-penumbra,penumbra*2.0,shadowD);
  float shadowRim=exp(-pow(shadowD/(penumbra*1.35),2.0));
  float shadowAlpha=shadowCoverage*.028+shadowRim*(.088-.018*uLift);
  vec4 result=vec4(vec3(.12,.22,.24)*shadowAlpha,shadowAlpha);
  if(coverage<=0.0) return result;
  // Material equations from 3f3fcd6, without its old shadow, lift or DOM lens.
  vec2 referenceNormal=roundedSurfaceNormal(p,halfSize,radius);
  float outerRim=exp(-depth/2.2);
  float innerShoulder=exp(-pow((depth-7.0)/5.5,2.0));
  vec2 crownSlope=-p/max(halfSize,vec2(1.0))*.10;
  vec3 referenceN=normalize(vec3(-referenceNormal*outerRim*1.25+crownSlope,1.0));
  vec2 referenceDirection=normalize(vec2(-.42,-.72));
  float referenceF0=pow((uGlass.x-1.0)/(uGlass.x+1.0),2.0);
  float referenceFresnel=referenceF0+(1.0-referenceF0)*pow(1.0-max(referenceN.z,0.0),5.0);
  float sunRim=pow(max(dot(referenceNormal,referenceDirection),0.0),1.22);
  float counterRim=pow(max(dot(referenceNormal,-referenceDirection),0.0),1.45);
  float broadTop=exp(-pow((p.y+halfSize.y*.82)/max(13.0,halfSize.y*.22),2.0))
    *exp(-pow((p.x+halfSize.x*.34)/max(54.0,halfSize.x*.70),2.0));
  float lowerReflection=exp(-pow((p.y-halfSize.y*.78)/max(13.0,halfSize.y*.24),2.0))
    *exp(-pow((p.x-halfSize.x*.42)/max(48.0,halfSize.x*.58),2.0));
  float referenceAlpha=clamp((.010+referenceFresnel*.020
    +outerRim*(.055+.075*sunRim+.045*counterRim)
    +innerShoulder*(.018+.025*counterRim))*coverage,0.0,.19);
  vec3 referenceRadiance=vec3(.86,.97,.98)*(.010+referenceFresnel*.012)*coverage;
  referenceRadiance+=mix(vec3(.018,.105,.115),vec3(.10,.31,.32),counterRim)
    *outerRim*(.055+.075*counterRim);
  referenceRadiance+=vec3(.82,1.0,1.0)*outerRim*sunRim*.22;
  referenceRadiance+=vec3(.54,.90,.92)*innerShoulder*(.018+.040*counterRim);
  referenceRadiance+=vec3(.88,1.0,1.0)*(broadTop*.055+lowerReflection*.040)
    *(1.0-.18*uLift);
  float upperLip=pow(max(-referenceNormal.y,0.0),1.5)*.52;
  float sideLip=max(-referenceNormal.x,0.0)*.12;
  float polish=exp(-pow((depth-1.8)/3.0,2.0))*(upperLip+sideLip)*coverage;
  vec4 glass=vec4(vec3(polish)+referenceRadiance*(1.0-polish),
    polish+referenceAlpha*(1.0-polish));
  return glass+result*(1.0-glass.a);
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
