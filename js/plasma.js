/**
 * Minimal purple wireframe ribbon under the lockup, on pure black.
 * Skipped when prefers-reduced-motion is set.
 */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.matches) return;

  const canvas = document.getElementById("plasma");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) {
    canvas.classList.add("plasma--fallback");
    return;
  }
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[plasma]", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function link(vsSrc, fsSrc) {
    const prog = gl.createProgram();
    const vsh = compile(gl.VERTEX_SHADER, vsSrc);
    const fsh = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vsh || !fsh) return null;
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[plasma]", gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  const bgProg = link(
    `attribute vec2 a;
     void main(){ gl_Position = vec4(a, 0.0, 1.0); }`,
    `precision mediump float;
     void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`
  );

  const meshProg = link(
    `precision mediump float;
     attribute vec2 a_uv;
     uniform float u_t;
     uniform vec2 u_res;
     varying float v_shade;
     varying float v_fog;
     varying vec2 v_uv;

     float surfY(vec2 xz, float t){
       float x = xz.x;
       float z = xz.y;
       return
         0.34 * sin(x * 0.75 + t * 0.35) * cos(z * 0.45 - t * 0.12) +
         0.18 * sin(x * 1.2 - z * 0.7 + t * 0.4) +
         0.10 * sin(z * 1.4 + x * 0.3 - t * 0.22);
     }

     void main(){
       float x = (a_uv.x - 0.5) * 11.5;
       float z = (a_uv.y - 0.5) * 3.8;
       float y = surfY(vec2(x, z), u_t) - 1.15;

       vec3 pos = vec3(x * 0.95 + z * 0.12, y, z);

       vec3 eye = vec3(0.0, 0.55, 4.4);
       vec3 target = vec3(0.0, -1.05, 0.0);
       vec3 forward = normalize(target - eye);
       vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
       vec3 up = cross(right, forward);
       vec3 rel = pos - eye;
       vec3 view = vec3(dot(rel, right), dot(rel, up), dot(rel, forward));

       float aspect = u_res.x / max(u_res.y, 1.0);
       float fov = 1.05;
       float pz = max(view.z, 0.08);
       vec2 ndc = view.xy / (pz * fov);
       ndc.x /= aspect;
       ndc.y -= 0.28;

       gl_Position = vec4(ndc * pz, pz * 0.12, pz);

       float e = 0.1;
       float y0 = surfY(vec2(x, z), u_t);
       float yx = surfY(vec2(x + e, z), u_t) - y0;
       float yz = surfY(vec2(x, z + e), u_t) - y0;
       vec3 N = normalize(vec3(-yx / e, 1.0, -yz / e));
       v_shade = 0.55 + 0.45 * clamp(dot(N, normalize(vec3(0.2, 0.85, 0.3))), 0.0, 1.0);
       v_fog = clamp((pz - 1.8) / 4.5, 0.0, 1.0);
       v_uv = a_uv;
     }`,
    `precision mediump float;
     varying float v_shade;
     varying float v_fog;
     varying vec2 v_uv;
     uniform float u_t;

     // Hue in [0,1] → RGB
     vec3 hsv2rgb(float h, float s, float v){
       vec3 p = abs(fract(h + vec3(0.0, 1.0/3.0, 2.0/3.0)) * 6.0 - 3.0);
       return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s);
     }

     void main(){
       float band = smoothstep(0.0, 0.12, v_uv.x) * smoothstep(1.0, 0.88, v_uv.x);
       band *= smoothstep(0.0, 0.14, v_uv.y) * smoothstep(1.0, 0.86, v_uv.y);

       // Rainbow sweep across the mesh + slow global drift.
       float hue = fract(u_t * 0.06 + v_uv.x * 0.55 + v_uv.y * 0.18);
       vec3 deep = hsv2rgb(hue, 0.72, 0.62);
       vec3 soft = hsv2rgb(fract(hue + 0.04), 0.55, 0.95);
       vec3 wire = mix(deep, soft, v_shade);
       float alpha = (0.28 + 0.22 * v_shade) * band * (1.0 - v_fog * 0.5);
       gl_FragColor = vec4(wire, alpha);
     }`
  );

  if (!bgProg || !meshProg) {
    canvas.classList.add("plasma--fallback");
    return;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const SEG_X = 64;
  const SEG_Z = 36;
  const verts = new Float32Array((SEG_X + 1) * (SEG_Z + 1) * 2);
  let vi = 0;
  for (let j = 0; j <= SEG_Z; j++) {
    for (let i = 0; i <= SEG_X; i++) {
      verts[vi++] = i / SEG_X;
      verts[vi++] = j / SEG_Z;
    }
  }

  const lines = [];
  const stride = SEG_X + 1;
  for (let j = 0; j <= SEG_Z; j++) {
    for (let i = 0; i < SEG_X; i++) {
      const a = j * stride + i;
      lines.push(a, a + 1);
    }
  }
  for (let i = 0; i <= SEG_X; i++) {
    for (let j = 0; j < SEG_Z; j++) {
      const a = j * stride + i;
      lines.push(a, a + stride);
    }
  }
  const lineIdx = new Uint16Array(lines);

  const meshBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineIdx, gl.STATIC_DRAW);

  const bgA = gl.getAttribLocation(bgProg, "a");
  const meshA = gl.getAttribLocation(meshProg, "a_uv");
  const meshRes = gl.getUniformLocation(meshProg, "u_res");
  const meshT = gl.getUniformLocation(meshProg, "u_t");

  let w = 0;
  let h = 0;
  let raf = 0;
  const t0 = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(window.innerWidth * dpr));
    h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function frame(now) {
    resize();
    const t = (now - t0) * 0.001;
    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(bgProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(bgA);
    gl.vertexAttribPointer(bgA, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.useProgram(meshProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.enableVertexAttribArray(meshA);
    gl.vertexAttribPointer(meshA, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(meshRes, w, h);
    gl.uniform1f(meshT, t);
    gl.drawElements(gl.LINES, lineIdx.length, gl.UNSIGNED_SHORT, 0);

    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
  }

  reduce.addEventListener("change", (e) => {
    if (e.matches) {
      stop();
      canvas.remove();
    }
  });

  window.addEventListener("resize", resize, { passive: true });
  resize();
  raf = requestAnimationFrame(frame);
})();
