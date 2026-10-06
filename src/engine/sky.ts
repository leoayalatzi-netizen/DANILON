import { Effect, MeshBuilder, Scene, ShaderMaterial, Mesh, Texture } from "@babylonjs/core";
Effect.ShadersStore["skyVertexShader"] = `precision highp float;
attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 vP;
void main(){ vP=position; gl_Position=worldViewProjection*vec4(position,1.0); }`;
Effect.ShadersStore["skyFragmentShader"] = `precision highp float;
varying vec3 vP; uniform vec3 top,hor,sunDir,sunCol; uniform float stars,t,aur,cloud;
uniform sampler2D skyN,skyS,skyO,skyM; uniform vec4 tx; uniform vec3 tn,ts,to;
vec2 eq(vec3 d,float uo,float vo){ return vec2(atan(d.x,d.z)*.15915494+.5+uo, .5+(asin(clamp(d.y,-1.0,1.0))-vo)*.31830989); }
vec3 lin(vec3 c){ return pow(c,vec3(2.2)); }
float h(vec3 p){ p=fract(p*.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h2(i),h2(i+vec2(1.0,0.0)),f.x),mix(h2(i+vec2(0.0,1.0)),h2(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float s=0.0; float a=.5; for(int i=0;i<4;i++){ s+=a*n2(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }
void main(){
  vec3 d=normalize(vP); float y=max(d.y,0.0);
  vec3 c=mix(hor,top,pow(y,.45));
  if(tx.x>.001) c=mix(c,lin(texture2D(skyN,eq(d,0.0,0.0)).rgb)*tn,tx.x);
  if(tx.y>.001) c=mix(c,lin(texture2D(skyS,eq(d,-.024,.06)).rgb)*ts,tx.y);
  if(tx.z>.001) c=mix(c,lin(texture2D(skyO,eq(d,0.0,0.0)).rgb)*to,tx.z);
  if(tx.w>.001) c+=lin(texture2D(skyM,eq(d,.1,0.0)).rgb)*tx.w*smoothstep(-.05,.2,d.y);
  float s=max(dot(d,sunDir),0.0);
  float disc=smoothstep(.9987,.9996,s)*(1.0-tx.y*.85);
  c+=sunCol*(pow(s,18.0)*.22+pow(s,300.0)*.55)+mix(sunCol,vec3(1.0),.6)*disc*1.6;
  float cov=0.0;
  if(d.y>.02){
    vec2 uv=d.xz/(d.y+.12)*.9+vec2(t*.012,t*.004);
    float cl=fbm(uv*1.3);
    cov=smoothstep(.5-.25*cloud,.9,cl)*smoothstep(.02,.25,d.y);
    float lit=pow(s,3.0)*.8+.25;
    vec3 cc=(mix(hor,top,.3)*.6+sunCol*lit*.6)*(1.0-.3*cloud);
    c=mix(c,cc,cov*.85);
  }
  vec3 g=floor(d*420.0); float st=step(.9975,h(g));
  float tw=.6+.4*sin(t*2.0+h(g+3.0)*40.0);
  c+=vec3(.9,.95,1.)*st*tw*stars*smoothstep(.0,.35,d.y)*(1.0-cov);
  float band=exp(-pow(dot(d,normalize(vec3(.3,.8,.5))),2.0)*18.0);
  c+=vec3(.5,.4,.8)*band*.12*stars*(.5+h(floor(d*90.0)))*(1.0-cov);
  float av=smoothstep(.2,.55,d.y)*(1.0-smoothstep(.6,.95,d.y));
  float w=sin(d.x*5.0+fbm(d.xz*2.5+t*.05)*5.0+t*.2)*.5+.5;
  vec3 ac=mix(vec3(.15,1.0,.55),vec3(.55,.25,1.0),clamp(d.z*.5+.5+fbm(d.xz*3.0)*.3,0.0,1.0));
  c+=ac*pow(w,4.0)*av*aur*(.4+.6*fbm(vec2(d.x*6.0,t*.08)))*(1.0-cov);
  gl_FragColor=vec4(c,1.0);
}`;
export function createSky(scene: Scene, base = "/") {
  const mesh = MeshBuilder.CreateSphere("sky", { diameter: 2400, segments: 32, sideOrientation: 1 }, scene);
  const mat = new ShaderMaterial("skyMat", scene, "sky", {
    attributes: ["position"], uniforms: ["worldViewProjection", "top", "hor", "sunDir", "sunCol", "stars", "t", "aur", "cloud", "tx", "tn", "ts", "to"], samplers: ["skyN", "skyS", "skyO", "skyM"] });
  mat.backFaceCulling = false; mat.disableDepthWrite = true;
  const T = (f: string) => new Texture(base + "sky/" + f, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  for (const [n, f] of [["skyN", "night.jpg"], ["skyS", "sunset.jpg"], ["skyO", "overcast.jpg"], ["skyM", "milky.jpg"]]) {
    const t = T(f); t.wrapU = Texture.WRAP_ADDRESSMODE; t.wrapV = Texture.CLAMP_ADDRESSMODE; mat.setTexture(n, t);
  }
  mesh.material = mat; mesh.infiniteDistance = true; mesh.isPickable = false; mesh.applyFog = false;
  return { mesh: mesh as Mesh, mat };
}
