import { Effect, MeshBuilder, Scene, ShaderMaterial, Mesh } from "@babylonjs/core";
Effect.ShadersStore["skyVertexShader"] = `precision highp float;
attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 vP;
void main(){ vP=position; gl_Position=worldViewProjection*vec4(position,1.0); }`;
Effect.ShadersStore["skyFragmentShader"] = `precision highp float;
varying vec3 vP; uniform vec3 top,hor,sunDir,sunCol; uniform float stars,t;
float h(vec3 p){ p=fract(p*.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 d=normalize(vP); float y=max(d.y,0.0);
  vec3 c=mix(hor,top,pow(y,.45));
  float s=max(dot(d,sunDir),0.0);
  float disc=smoothstep(.9987,.9996,s); c+=sunCol*(pow(s,18.0)*.22+pow(s,300.0)*.55)+mix(sunCol,vec3(1.),.6)*disc*1.6;
  vec3 g=floor(d*420.0); float st=step(.9975,h(g));
  float tw=.6+.4*sin(t*2.0+h(g+3.0)*40.0);
  c+=vec3(.9,.95,1.)*st*tw*stars*smoothstep(.0,.35,d.y);
  // banda tenue tipo vía láctea
  float band=exp(-pow(dot(d,normalize(vec3(.3,.8,.5))),2.0)*18.0);
  c+=vec3(.5,.4,.8)*band*.12*stars*(.5+h(floor(d*90.0)));
  gl_FragColor=vec4(c,1.0);
}`;
export function createSky(scene: Scene) {
  const mesh = MeshBuilder.CreateSphere("sky", { diameter: 2400, segments: 32, sideOrientation: 1 }, scene);
  const mat = new ShaderMaterial("skyMat", scene, "sky", {
    attributes: ["position"], uniforms: ["worldViewProjection", "top", "hor", "sunDir", "sunCol", "stars", "t"] });
  mat.backFaceCulling = false; mat.disableDepthWrite = true;
  mesh.material = mat; mesh.infiniteDistance = true; mesh.isPickable = false; mesh.applyFog = false;
  return { mesh: mesh as Mesh, mat };
}
