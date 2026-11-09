// 一筆花火 2 — 描画。WebGL2。HDR で描いて、残像・光のにじみ・水面の映り込み・町への光を足す。
const VS_QUAD = `#version 300 es
in vec2 p; out vec2 v; void main(){ v = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;

const FS_COPY = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D t; uniform float k; void main(){ o = texture(t,v)*k; }`;

// 空: 焼いておいた夜空（rgb）と雲の濃さ（a）に、花火の光を足す
const LIGHTS = `
uniform vec4 uL[8]; uniform vec3 uLc[8]; uniform vec2 uView;
vec3 lightAt(vec2 w, float spread){ vec3 c = vec3(0.); for(int i=0;i<8;i++){ if(uL[i].z<=0.) continue; vec2 d=(w-uL[i].xy)/(uL[i].w*spread); c += uLc[i]*uL[i].z*exp(-dot(d,d)); } return c; }`;

const FS_SKY = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D sky; uniform float time; ${LIGHTS}
void main(){ vec2 uv = vec2(v.x, 1.-v.y); vec4 s = texture(sky, uv);
  vec2 w = vec2(v.x, 1.-v.y)*uView;
  vec3 L = lightAt(w, 1.);
  vec3 c = s.rgb + L*(0.018 + s.a*0.2);
  o = vec4(c,1.); }`;

// 帯（町）: night + flash×光。上のシーンの水面に映り込みを描く
const FS_COMP = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D scene, night, flash, fxT; uniform float time, waterY; uniform vec4 bandRect; uniform float parallax; ${LIGHTS}
void main(){
  float y = 1.-v.y; // 上が 0
  vec3 c;
  if (y > waterY) {
    float d = (y-waterY)/(1.-waterY);
    float wob = sin(y*260.+time*2.4)*0.0016*(0.4+d*2.) + sin(y*92.-time*1.5+v.x*18.)*0.0028*(0.4+d*2.);
    vec2 m = vec2(v.x+wob, 1.-(waterY-(y-waterY)*1.15));
    vec4 mf = texture(fxT, m); vec3 r = mf.rgb + texture(scene, m).rgb*(1.-mf.a);
    float fres = mix(0.42,0.75,d);
    c = r*fres + vec3(0.006,0.012,0.03);
  } else {
    c = texture(scene, v).rgb;
  }
  // 帯
  vec2 w = vec2(v.x, y)*uView;
  vec2 b = (vec2(v.x,y)-bandRect.xy)/bandRect.zw;
  if (b.x>=0.&&b.x<=1.&&b.y>=0.&&b.y<=1.) {
    vec2 uv = b;
    vec4 n = texture(night, uv), f = texture(flash, uv);
    vec3 L = lightAt(w, 1.8);
    vec3 lit = pow(n.rgb,vec3(2.2))*.8 + pow(f.rgb,vec3(2.2))*L*.62;
    c = mix(c, lit, n.a);
  }
  // 花火・玉・線は、町より手前に置く（低い所でひらいても隠れない）
  vec4 f0 = texture(fxT, v); c = f0.rgb + c*(1.-f0.a);
  o = vec4(c,1.); }`;

const FS_DOWN = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D t; uniform vec2 px;
void main(){ vec3 c = texture(t,v).rgb*4.; c += texture(t,v+px*vec2(-1,-1)).rgb; c += texture(t,v+px*vec2(1,-1)).rgb; c += texture(t,v+px*vec2(-1,1)).rgb; c += texture(t,v+px*vec2(1,1)).rgb; o = vec4(min(c/8.,vec3(40.)),1.); }`;
const FS_UP = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D t; uniform vec2 px; uniform float k;
void main(){ vec3 c = texture(t,v+px*vec2(-1,0)*2.).rgb; c+=texture(t,v+px*vec2(1,0)*2.).rgb; c+=texture(t,v+px*vec2(0,-1)*2.).rgb; c+=texture(t,v+px*vec2(0,1)*2.).rgb; c+=(texture(t,v+px*vec2(-1,-1)).rgb+texture(t,v+px*vec2(1,-1)).rgb+texture(t,v+px*vec2(-1,1)).rgb+texture(t,v+px*vec2(1,1)).rgb)*2.; o=vec4(c/12.*k,1.); }`;
const FS_FINAL = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D t, bl; uniform float time, flash, heat, bloom, grain, ca;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
float rnd(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+time)*43758.5453); }
void main(){ vec2 d=v-.5; float r2=dot(d,d);
  vec3 c = vec3(texture(t,v+d*ca*r2).r, texture(t,v).g, texture(t,v-d*ca*r2).b);
  vec3 b = texture(bl,v).rgb;
  c += b*bloom; c += vec3(1.,.93,.82)*flash;
  float vg = smoothstep(.95,.18,r2*1.5); c*=mix(.62,1.,vg);
  c += vec3(1.,.28,.06)*heat*smoothstep(.12,.5,r2)*.32;
  float mx=max(max(c.r,c.g),c.b); vec3 hp = mx>0.0001 ? c/mx*aces(vec3(mx)) : c; c = mix(aces(c), hp, .72);
  c = pow(c, vec3(1./2.2));
  c += (rnd(v)-.5)*grain;
  o = vec4(c,1.); }`;

// 粒: 速さの向きに伸ばした四角。足し算で重ねる
const VS_PART = `#version 300 es
in vec2 q; in vec4 a; in vec4 b; in float sz; out vec2 uv; out vec4 col; uniform vec2 uView; uniform float streak; uniform vec3 cam;
void main(){ vec2 vel=a.zw; float sp=length(vel); vec2 dir= sp>1. ? vel/sp : vec2(1.,0.); vec2 nor=vec2(-dir.y,dir.x);
  float L = sz + sp*streak; vec2 w = a.xy + dir*q.x*L + nor*q.y*sz;
  w = (w-uView*.5)*cam.z+uView*.5+cam.xy;
  uv=q; col=b; gl_Position=vec4(w.x/uView.x*2.-1., 1.-w.y/uView.y*2.,0.,1.); }`;
const FS_PART = `#version 300 es
precision highp float; in vec2 uv; in vec4 col; out vec4 o;
void main(){ float r2=dot(uv,uv); if(r2>=1.) discard; float g=(exp(-r2*3.2)-.0408)/.9592; float core=exp(-r2*22.); o=vec4(col.rgb*(g+core*1.8)*col.a,0.); }`; // 縁で 0 にする（明るい粒が四角く切れて見えないように）

// 煙: 周りの光で色づく
const VS_SMOKE = `#version 300 es
in vec2 q; in vec4 a; in vec4 b; in float sz; out vec2 uv; out vec4 col; uniform float uRot; ${LIGHTS} uniform vec3 cam;
void main(){ float ca=cos(b.x), sa=sin(b.x); vec2 w=a.xy+vec2(q.x*ca-q.y*sa,q.x*sa+q.y*ca)*sz; vec3 L=lightAt(a.xy,1.2); w=(w-uView*.5)*cam.z+uView*.5+cam.xy;
  col=vec4(vec3(.05,.055,.085)+L*.32, b.a); uv=q; gl_Position=vec4(w.x/uView.x*2.-1.,1.-w.y/uView.y*2.,0.,1.); }`;
const FS_SMOKE = `#version 300 es
precision highp float; in vec2 uv; in vec4 col; out vec4 o; uniform sampler2D n;
void main(){ float r=length(uv); float m=smoothstep(1.,.15,r); float t=texture(n,uv*.5+.5).r; float al=m*t*col.a; o=vec4(col.rgb*al,al); }`;

// 玉の絵
const VS_SPR = `#version 300 es
in vec2 q; in vec4 a; in vec4 b; out vec2 uv; out float gl; out float al; uniform vec2 uView; uniform vec3 cam; uniform vec2 cell;
void main(){ vec2 w=a.xy+q*a.z; w=(w-uView*.5)*cam.z+uView*.5+cam.xy; uv=(q*.5+.5+vec2(b.x,b.y))*cell; gl=b.z; al=b.w; gl_Position=vec4(w.x/uView.x*2.-1.,1.-w.y/uView.y*2.,0.,1.); }`;
const FS_SPR = `#version 300 es
precision highp float; in vec2 uv; in float gl; in float al; out vec4 o; uniform sampler2D t;
void main(){ vec4 c=texture(t,uv); c.rgb=pow(c.rgb,vec3(2.2)); float a=c.a*al; o=vec4(c.rgb*(1.+gl*2.4)*a,a); }`;

// 導火線: s（線の長さの位置）で、燃えた所・燃えている所・これから燃える所を塗り分ける
const VS_FUSE = `#version 300 es
in vec2 p; in vec2 ls; out vec2 l; uniform vec2 uView; uniform vec3 cam;
void main(){ l=ls; vec2 w=(p-uView*.5)*cam.z+uView*.5+cam.xy; gl_Position=vec4(w.x/uView.x*2.-1.,1.-w.y/uView.y*2.,0.,1.); }`;
const FS_FUSE = `#version 300 es
precision highp float; in vec2 l; out vec4 o; uniform float flameS, len, time, heat, on;
void main(){ float s=l.x, e=abs(l.y); float edge=smoothstep(1.,.45,e);
  float rope = .75+.25*sin(s*.55+e*2.5);
  vec3 c; float a=edge;
  if (s>flameS || on<.5) { // これから燃える線: 金の筆
    float tip = smoothstep(len-160.,len,s);
    c = mix(vec3(1.05,.68,.22),vec3(1.5,1.1,.5),tip)*rope*(1.1+.25*sin(time*7.-s*.03));
    a*=.95;
  } else { // 燃えたあと: 赤い燠が冷えて消える
    float age=(flameS-s);
    float ember=exp(-age/190.);
    float flick=.6+.4*sin(s*.8+time*13.);
    c = mix(vec3(.05,.03,.03), vec3(2.6,.7,.12)*flick, ember);
    a*=mix(.0,1.,smoothstep(1300.,60.,age)*.9+.05);
  }
  float head=exp(-pow((s-flameS)/28.,2.))*on; c+=vec3(4.,2.4,1.)*head*(1.+heat);
  o=vec4(c*a,a); }`;

const FS_BAKE = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform vec3 top, mid, hor, cloud; uniform vec2 moon; uniform float aspect, seed, moonR, stars;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)+seed); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<6;i++){ s+=a*n2(p); p=mat2(1.6,1.2,-1.2,1.6)*p; a*=.5; } return s; }
void main(){ vec2 uv=vec2(v.x*aspect, v.y); float y=v.y; // y: 0 = 上
  vec3 c = mix(top, mid, smoothstep(0.,.6,y)); c = mix(c, hor, smoothstep(.45,.82,y));
  // 天の川
  vec2 m = uv*2.2+vec2(.3,1.); float band = exp(-pow((uv.y-.28-(uv.x-aspect*.5)*.28)/.17,2.));
  float mw = fbm(m*2.2+fbm(m*1.1)*1.6);
  c += vec3(.030,.028,.058)*band*smoothstep(.38,.9,mw);
  // 星: 格子ごとに 1 つ、明るさはべき乗
  float st=0.; for(int k=0;k<3;k++){ float sc= k==0?110.:(k==1?220.:420.); vec2 g=uv*sc; vec2 id=floor(g), f=fract(g)-.5; float r=h21(id+float(k)*7.); vec2 off=vec2(h21(id+3.),h21(id+9.))-.5; float d=length(f-off*.8); float th=k==0?.965:(k==1?.95:.93); float b=smoothstep(th,1.,r)*smoothstep(.13,.0,d); st+=b*(k==0?1.6:.7); }
  st*=stars*smoothstep(.86,.28,y)*(1.+band*.7);
  c += vec3(.92,.95,1.)*st;
  // 雲（横に伸びた層）
  vec2 cp=vec2(uv.x*1.25,uv.y*4.2); float warp=fbm(cp*.7+4.); float d=fbm(cp+warp*1.25+vec2(1.7,9.2));
  float dens=smoothstep(.46,.76,d)*smoothstep(.02,.28,y)*smoothstep(.98,.55,y);
  // 月
  vec2 mm=(uv-vec2(moon.x*aspect,moon.y)); float mr=length(mm);
  float disk=smoothstep(moonR,moonR-.0035,mr);
  float crater=fbm(mm*34.+3.)*.34+fbm(mm*11.+8.)*.3;
  vec3 moonC=mix(vec3(.78,.70,.52),vec3(.34,.30,.24),smoothstep(.2,.62,crater))*.82;
  float halo=exp(-mr*mr/(moonR*moonR*5.))*.05+exp(-mr*mr/(moonR*moonR*40.))*.016;
  c += vec3(.75,.70,.56)*halo;
  c = mix(c, moonC, disk);
  // 雲は月の光を受ける
  float lit=clamp(exp(-mr*mr/.16),0.,1.);
  vec3 cc = cloud*(.32+d*.5) + vec3(.09,.08,.065)*lit*.6;
  c = mix(c, cc, dens*.62*(1.-disk*.8));
  o = vec4(c, clamp(dens*1.1+.08,0.,1.)); }`;

function compile(gl, vs, fs, attribs) {
  const p = gl.createProgram();
  for (const [src, type] of [[vs, gl.VERTEX_SHADER], [fs, gl.FRAGMENT_SHADER]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src.slice(0, 200));
    gl.attachShader(p, s);
  }
  attribs?.forEach((n, i) => gl.bindAttribLocation(p, i, n));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); const name = a.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

export function createRenderer(canvas, { quality = 'high' } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return null;
  const floatOk = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  const IFMT = floatOk ? gl.RGBA16F : gl.RGBA8, FMT = gl.RGBA, TY = floatOk ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const P = {
    copy: compile(gl, VS_QUAD, FS_COPY, ['p']), sky: compile(gl, VS_QUAD, FS_SKY, ['p']), comp: compile(gl, VS_QUAD, FS_COMP, ['p']),
    down: compile(gl, VS_QUAD, FS_DOWN, ['p']), up: compile(gl, VS_QUAD, FS_UP, ['p']), fin: compile(gl, VS_QUAD, FS_FINAL, ['p']),
    part: compile(gl, VS_PART, FS_PART, ['q', 'a', 'b', 'sz']), smoke: compile(gl, VS_SMOKE, FS_SMOKE, ['q', 'a', 'b', 'sz']),
    spr: compile(gl, VS_SPR, FS_SPR, ['q', 'a', 'b']), fuse: compile(gl, VS_FUSE, FS_FUSE, ['p', 'ls']),
  };
  const fb = (w, h) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, IFMT, w, h, 0, FMT, TY, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { f, t, w, h };
  };
  let W = 1280, H = 720, RW = 0, RH = 0, scene, comp, fxL, trailA, trailB, mips = [];
  const R = {
    gl, floatOk, lights: [], flash: 0, heat: 0, shake: 0, zoom: 1, camX: 0, camY: 0, bloom: 0.95, trailFade: 0.885,
    waterY: 0.84, band: null, skyTex: null, grain: 0.022, time: 0,
    get view() { return { w: W, h: H }; },
  };
  const destroyFb = (b) => { if (b) { gl.deleteTexture(b.t); gl.deleteFramebuffer(b.f); } };
  R.resize = (cssW, cssH, dpr, viewW, viewH) => {
    W = viewW; H = viewH;
    const w = Math.max(2, Math.round(cssW * dpr)), h = Math.max(2, Math.round(cssH * dpr));
    canvas.width = w; canvas.height = h;
    if (w === RW && h === RH) return;
    RW = w; RH = h;
    [scene, comp, fxL, trailA, trailB, ...mips].forEach(destroyFb); mips = [];
    scene = fb(w, h); comp = fb(w, h); fxL = fb(w, h);
    const tw = Math.ceil(w / 1.5), th = Math.ceil(h / 1.5);
    trailA = fb(tw, th); trailB = fb(tw, th);
    let mw = w, mh = h;
    for (let i = 0; i < 6; i++) { mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1); mips.push(fb(mw, mh)); }
    for (const b of [trailA, trailB]) { gl.bindFramebuffer(gl.FRAMEBUFFER, b.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  };

  // テクスチャ
  R.texture = (src, { linear = true, repeat = false } = {}) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    return t;
  };

  // 粒のバッファ: x y vx vy | r g b a | size
  const MAX_P = quality === 'low' ? 7000 : 26000, MAX_S = 260, MAX_SPR = 220;
  const pBuf = gl.createBuffer(), sBuf = gl.createBuffer(), sprBuf = gl.createBuffer(), fuseBuf = gl.createBuffer();
  const pData = new Float32Array(MAX_P * 9), sData = new Float32Array(MAX_S * 9), sprData = new Float32Array(MAX_SPR * 8);
  gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, pData.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, sBuf); gl.bufferData(gl.ARRAY_BUFFER, sData.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf); gl.bufferData(gl.ARRAY_BUFFER, sprData.byteLength, gl.DYNAMIC_DRAW);
  const mkVao = (buf, stride, layout) => {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    for (const [i, n, off] of layout) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride, off); gl.vertexAttribDivisor(i, 1); }
    gl.bindVertexArray(null); return v;
  };
  const vaoP = mkVao(pBuf, 36, [[1, 4, 0], [2, 4, 16], [3, 1, 32]]);
  const vaoS = mkVao(sBuf, 36, [[1, 4, 0], [2, 4, 16], [3, 1, 32]]);
  const vaoSpr = mkVao(sprBuf, 32, [[1, 4, 0], [2, 4, 16]]);
  const vaoQ = gl.createVertexArray(); gl.bindVertexArray(vaoQ); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const vaoF = gl.createVertexArray(); gl.bindVertexArray(vaoF); gl.bindBuffer(gl.ARRAY_BUFFER, fuseBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);

  const setLights = (prog) => {
    const L = new Float32Array(32), C = new Float32Array(24);
    R.lights.slice(0, 8).forEach((l, i) => { L.set([l.x, l.y, l.i, l.r], i * 4); C.set(l.c, i * 3); });
    gl.uniform4fv(prog.u.uL, L); gl.uniform3fv(prog.u.uLc, C); gl.uniform2f(prog.u.uView, W, H);
  };
  const full = (prog, target, w, h) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : RW, target ? target.h : RH);
    gl.useProgram(prog.p); gl.bindVertexArray(vaoQ);
  };
  const tex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
  const blit = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const drawParticles = (fx, cam, streak) => {
    gl.useProgram(P.part.p); gl.bindVertexArray(vaoP);
    gl.uniform2f(P.part.u.uView, W, H); gl.uniform1f(P.part.u.streak, streak); gl.uniform3f(P.part.u.cam, cam.x, cam.y, cam.z);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, fx.count);
  };

  R.render = (dt, fx, draws) => {
    R.time += dt;
    const shX = (Math.sin(R.time * 71) + Math.sin(R.time * 47)) * R.shake, shY = (Math.cos(R.time * 63) + Math.sin(R.time * 53)) * R.shake;
    const cam = { x: shX + R.camX, y: shY + R.camY, z: R.zoom };
    // 粒を上げる
    fx.fill(pData, MAX_P, sData, MAX_S);
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pData, 0, fx.count * 9);
    gl.bindBuffer(gl.ARRAY_BUFFER, sBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, sData, 0, fx.smokeCount * 9);

    gl.disable(gl.DEPTH_TEST);
    // 残像: 前のコマを薄くして粒を足す
    full(P.copy, trailB); gl.disable(gl.BLEND); tex(0, trailA.t, P.copy.u.t); gl.uniform1f(P.copy.u.k, R.trailFade); blit();
    gl.enable(gl.BLEND); drawParticles(fx, cam, 0.018);
    [trailA, trailB] = [trailB, trailA];

    // 空
    full(P.sky, scene); gl.disable(gl.BLEND); tex(0, R.skyTex, P.sky.u.sky); gl.uniform1f(P.sky.u.time, R.time); setLights(P.sky); blit();
    gl.enable(gl.BLEND);
    // 煙
    gl.useProgram(P.smoke.p); gl.bindVertexArray(vaoS); setLights(P.smoke); gl.uniform3f(P.smoke.u.cam, cam.x, cam.y, cam.z);
    tex(0, R.noiseTex, P.smoke.u.n); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (fx.smokeCount) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, fx.smokeCount);
    // 花火の層: 残像・粒・玉・線を別に描く
    full(P.copy, fxL); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); tex(0, trailA.t, P.copy.u.t); gl.uniform1f(P.copy.u.k, 0.30); gl.blendFunc(gl.ONE, gl.ONE); blit();
    drawParticles(fx, cam, 0.03);
    draws && draws({ gl, cam, P, vaoSpr, vaoF, sprBuf, sprData, fuseBuf, tex, W, H, MAX_SPR });

    // 町と水面
    full(P.comp, comp); gl.disable(gl.BLEND);
    const b = R.band;
    tex(0, scene.t, P.comp.u.scene); tex(1, b.night, P.comp.u.night); tex(2, b.flash, P.comp.u.flash); tex(3, fxL.t, P.comp.u.fxT);
    gl.uniform1f(P.comp.u.time, R.time); gl.uniform1f(P.comp.u.waterY, b.waterY); gl.uniform4f(P.comp.u.bandRect, b.rect[0], b.rect[1], b.rect[2], b.rect[3]);
    setLights(P.comp); blit();

    // 光のにじみ
    let src = comp;
    for (let i = 0; i < mips.length; i++) {
      full(P.down, mips[i]); tex(0, src.t, P.down.u.t); gl.uniform2f(P.down.u.px, 1 / src.w, 1 / src.h); blit(); src = mips[i];
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = mips.length - 1; i > 0; i--) {
      full(P.up, mips[i - 1]); tex(0, mips[i].t, P.up.u.t); gl.uniform2f(P.up.u.px, 1 / mips[i].w, 1 / mips[i].h); gl.uniform1f(P.up.u.k, 0.85); blit();
    }
    gl.disable(gl.BLEND);
    full(P.fin, null);
    tex(0, comp.t, P.fin.u.t); tex(1, mips[0].t, P.fin.u.bl);
    gl.uniform1f(P.fin.u.time, R.time % 10); gl.uniform1f(P.fin.u.flash, R.flash); gl.uniform1f(P.fin.u.heat, R.heat); gl.uniform1f(P.fin.u.bloom, R.bloom * 0.062); gl.uniform1f(P.fin.u.grain, R.grain); gl.uniform1f(P.fin.u.ca, 0.006);
    blit();
  };
  // 空を焼く（1 回だけ。a に雲の濃さを入れて、花火の光で雲を照らす）
  R.bakeSky = (theme, aspect) => {
    const prog = compile(gl, VS_QUAD, FS_BAKE, ['p']);
    const w = aspect >= 1 ? 1920 : 1080, h = aspect >= 1 ? Math.round(1920 / aspect) : Math.round(1080 / aspect);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, floatOk ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, floatOk ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.useProgram(prog.p); gl.bindVertexArray(vaoQ); gl.disable(gl.BLEND);
    const U = prog.u;
    gl.uniform3fv(U.top, theme.top); gl.uniform3fv(U.mid, theme.mid); gl.uniform3fv(U.hor, theme.hor); gl.uniform3fv(U.cloud, theme.cloud);
    gl.uniform2fv(U.moon, theme.moon); gl.uniform1f(U.aspect, aspect); gl.uniform1f(U.seed, theme.seed ?? 0.37); gl.uniform1f(U.moonR, theme.moonR ?? 0.06); gl.uniform1f(U.stars, theme.stars ?? 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.deleteFramebuffer(f); gl.deleteProgram(prog.p);
    if (R.skyTex) gl.deleteTexture(R.skyTex);
    R.skyTex = t;
  };
  return R;
}
