// Cena 3D do topo: unhas postiças de verdade (malhas 3D), leves e nítidas.
// - Chegam voando ao abrir a página
// - Tocar numa unha: ela gira, solta brilhos e troca de esmalte
// - Tocar no fundo: uma onda espalha as unhas
// - Mover o dedo/mouse: elas desviam; inclinar o celular: elas acompanham
// Desempenho: nenhum arquivo extra, bordas suavizadas, densidade de pixels
// que se ajusta ao aparelho e pausa quando o topo sai da tela.
(function () {
  const canvas = document.getElementById('cena');
  const cartao = document.getElementById('hero-cartao');
  if (!canvas || !cartao) return;
  const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const semSuporte = () => cartao.classList.add('sem-3d');

  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return semSuporte();

  // ================================================================ matemática
  const perspectiva = (fov, asp, perto, longe) => {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (perto - longe);
    return new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (longe + perto) * nf, -1, 0, 0, 2 * longe * perto * nf, 0]);
  };
  function modelo(saida, px, py, pz, ax, ay, az, s) {
    const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
    saida[0] = cb * cc * s; saida[1] = (ca * sc + sa * sb * cc) * s; saida[2] = (sa * sc - ca * sb * cc) * s; saida[3] = 0;
    saida[4] = -cb * sc * s; saida[5] = (ca * cc - sa * sb * sc) * s; saida[6] = (sa * cc + ca * sb * sc) * s; saida[7] = 0;
    saida[8] = sb * s; saida[9] = -sa * cb * s; saida[10] = ca * cb * s; saida[11] = 0;
    saida[12] = px; saida[13] = py; saida[14] = pz; saida[15] = 1;
    return saida;
  }
  const CAM_Z = 5;
  const vista = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -CAM_Z, 1]);

  // ================================================================ malha da unha (gerada no código)
  // "superelipsoide": placa fina com borda arredondada e contorno quadrado-oval,
  // depois curvada (arco da unha) e afinando levemente na ponta (amendoado).
  const A = 0.2, B = 0.46, T = 0.045;
  const pot = (x, m) => Math.sign(x) * Math.pow(Math.abs(x), m);
  function pontoUnha(th, ph) {
    const cp = pot(Math.cos(ph), 0.22), sp = pot(Math.sin(ph), 0.22);
    let x = A * cp * pot(Math.cos(th), 0.7);
    const y = B * cp * pot(Math.sin(th), 0.7);
    let z = T * sp;
    x *= 1 - 0.22 * Math.pow(Math.max(y / B, 0), 2); // ponta mais fina
    z -= 1.1 * x * x; // arco da unha
    return [x, y, z];
  }
  function gerarMalha(nTh, nPh) {
    const pos = [], nor = [], idx = [];
    const eps = 1e-3;
    for (let j = 0; j <= nPh; j++) {
      const ph = -Math.PI / 2 + (Math.PI * j) / nPh;
      const phc = Math.min(Math.max(ph, -Math.PI / 2 + eps * 4), Math.PI / 2 - eps * 4);
      for (let i = 0; i <= nTh; i++) {
        const th = -Math.PI + (2 * Math.PI * i) / nTh;
        const p = pontoUnha(th, ph);
        const a = pontoUnha(th + eps, phc), b = pontoUnha(th - eps, phc);
        const c = pontoUnha(th, phc + eps), d = pontoUnha(th, phc - eps);
        const t1 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const t2 = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
        let n = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]];
        const l = Math.hypot(...n) || 1;
        n = n.map((v) => v / l);
        if (Math.abs(ph) > Math.PI / 2 - 0.01) n = [0, 0, Math.sign(ph)]; // polos (centro das faces)
        pos.push(...p);
        nor.push(...n);
      }
    }
    const linha = nTh + 1;
    for (let j = 0; j < nPh; j++) for (let i = 0; i < nTh; i++) {
      const a = j * linha + i, b = a + 1, c = a + linha, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
  }
  const malha = gerarMalha(48, 16);

  // ================================================================ shaders
  const VERT = `
attribute vec3 aPos; attribute vec3 aNor;
uniform mat4 uProj, uView, uModel;
varying vec3 vNor, vMundo, vLocal;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vMundo = w.xyz; vNor = mat3(uModel) * aNor; vLocal = aPos;
  gl_Position = uProj * uView * w;
}`;
  const FRAG = `
precision highp float;
varying vec3 vNor, vMundo, vLocal;
uniform vec3 uCor, uCor2;
uniform float uTipo, uTempo, uFlash;
uniform vec2 uLuz;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 ambiente(vec3 r) {
  vec3 c = mix(vec3(0.015, 0.013, 0.02), vec3(0.16, 0.14, 0.19), r.y * 0.5 + 0.5);
  c += vec3(1.0, 0.96, 0.98) * smoothstep(0.7, 0.96, r.y) * 1.4;
  c += vec3(1.0, 0.18, 0.5) * smoothstep(0.5, 0.92, r.x) * 1.1;
  c += vec3(0.5, 0.35, 1.0) * smoothstep(0.55, 0.95, -r.x) * 0.6;
  return c;
}
void main() {
  vec3 n = normalize(vNor);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vec3(0.0, 0.0, ${CAM_Z.toFixed(1)}) - vMundo);
  vec3 L = normalize(vec3(0.6 + uLuz.x * 1.4, 0.9 + uLuz.y * 1.1, 1.3));
  vec3 h = normalize(L + v);
  vec3 base = uCor;
  // 4 = francesinha: ponta clara com a linha "sorriso"
  if (uTipo > 3.5) base = mix(uCor, uCor2, smoothstep(-0.006, 0.006, vLocal.y - (0.25 + 1.6 * vLocal.x * vLocal.x)));
  float dif = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, h), 0.0), 120.0);
  float fre = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 r = reflect(-v, n);
  vec3 c;
  if (uTipo > 0.5 && uTipo < 1.5) c = base * ambiente(r) * 1.35 + spec * 1.6; // 1 = cromado
  else {
    // gel: cor cheia + reflexo branco de estúdio (sem tingir a cor)
    float softbox = smoothstep(0.55, 0.95, r.y) * 0.9 + smoothstep(0.6, 0.95, r.x) * 0.35;
    c = base * (0.3 + 0.85 * dif) + vec3(softbox) * (0.08 + 0.7 * fre) + spec * 1.6;
  }
  // 2 = glitter: flocos que acendem conforme o ângulo
  if (uTipo > 1.5 && uTipo < 2.5) {
    vec3 cel = floor(vLocal * 150.0);
    float r = hash(cel);
    vec3 dir = vec3(hash(cel + 1.3) - 0.5, hash(cel + 2.7) - 0.5, 0.0) * 1.4;
    float floco = step(0.7, r) * pow(max(dot(normalize(n + dir), h), 0.0), 24.0);
    c += uCor2 * floco * 2.6;
  }
  // 3 = olho de gato: faixa magnética que segue a luz
  if (uTipo > 2.5 && uTipo < 3.5) {
    float pos = vLocal.x * 0.8 + vLocal.y * 0.35 - (uLuz.x * 0.12 + sin(uTempo * 0.8) * 0.06);
    c += uCor2 * exp(-pos * pos * 90.0) * (0.5 + 0.9 * dif);
  }
  c += uFlash * vec3(1.0, 0.75, 0.88) * 0.7;
  c = 1.0 - exp(-c * 1.35);
  gl_FragColor = vec4(pow(c, vec3(0.4545)), 1.0);
}`;
  const VERT_BRILHO = `
attribute vec3 aPos; attribute float aVida; attribute float aTam;
uniform mat4 uProj, uView; uniform float uDpr;
varying float vVida;
void main() { vVida = aVida; gl_Position = uProj * uView * vec4(aPos, 1.0); gl_PointSize = aTam * uDpr * (0.4 + aVida) / gl_Position.w * 5.0; }`;
  const FRAG_BRILHO = `
precision mediump float;
varying float vVida;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float estrela = max(0.0, 1.0 - abs(p.x) * 6.0 - abs(p.y) * 0.9) + max(0.0, 1.0 - abs(p.y) * 6.0 - abs(p.x) * 0.9) + max(0.0, 1.0 - length(p) * 2.2);
  gl_FragColor = vec4(mix(vec3(1.0, 0.3, 0.6), vec3(1.0), estrela * 0.5) * estrela * vVida, 0.0);
}`;

  function programa(v, f) {
    const sh = (tipo, src) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, v));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
      const nome = gl.getActiveUniform(p, i).name;
      u[nome] = gl.getUniformLocation(p, nome);
    }
    return { p, u, a: (nome) => gl.getAttribLocation(p, nome) };
  }
  let progUnha, progBrilho;
  try {
    progUnha = programa(VERT, FRAG);
    progBrilho = programa(VERT_BRILHO, FRAG_BRILHO);
  } catch (e) {
    console.warn('Cena 3D desativada:', e.message);
    return semSuporte();
  }

  const buffer = (dados, alvo = gl.ARRAY_BUFFER, uso = gl.STATIC_DRAW) => {
    const b = gl.createBuffer();
    gl.bindBuffer(alvo, b);
    gl.bufferData(alvo, dados, uso);
    return b;
  };
  const bPos = buffer(malha.pos), bNor = buffer(malha.nor), bIdx = buffer(malha.idx, gl.ELEMENT_ARRAY_BUFFER);

  // ================================================================ esmaltes
  const lin = (hex) => [1, 3, 5].map((i) => Math.pow(parseInt(hex.slice(i, i + 2), 16) / 255, 2.2));
  const ESMALTES = [
    { tipo: 0, cor: '#ff3d8b', cor2: '#ffffff' }, // gel pink
    { tipo: 4, cor: '#f1d3c9', cor2: '#fbf8f6' }, // francesinha
    { tipo: 3, cor: '#3b1d6e', cor2: '#d9d2ff' }, // olho de gato roxo
    { tipo: 2, cor: '#111114', cor2: '#c9d6ff' }, // preto com glitter
    { tipo: 1, cor: '#dcdce6', cor2: '#ffffff' }, // cromado
    { tipo: 0, cor: '#b3123c', cor2: '#ffffff' }, // vermelho
    { tipo: 0, cor: '#0f5b3a', cor2: '#ffffff' }, // verde esmeralda
    { tipo: 2, cor: '#c9a24a', cor2: '#fff1c2' }, // dourado com glitter
    { tipo: 0, cor: '#b79cff', cor2: '#ffffff' }, // lilás
    { tipo: 3, cor: '#1d2c4a', cor2: '#bfe3ff' }, // olho de gato azul
  ].map((e) => ({ ...e, c1: lin(e.cor), c2: lin(e.cor2) }));

  const LAYOUT = [
    [-1.65, 0.55, -0.2], [-0.85, -0.45, 0.45], [-0.05, 0.62, 0.05], [0.8, -0.35, 0.5], [1.6, 0.45, -0.25],
    [1.95, -0.95, -0.6], [0.45, -1.05, -0.35], [1.15, 1.15, -0.7], [-0.75, 1.2, -0.8],
  ];
  const unhas = LAYOUT.map((b, i) => ({
    base: b,
    esmalte: i % ESMALTES.length,
    p: [b[0] * 2.4 + (i % 2 ? 2 : -2), b[1] * 2.4 - 3, -7 - i * 0.6], // começa longe (entrada voando)
    v: [0, 0, 0],
    extra: [0, 0, 0], // giro extra (pirueta) que volta ao normal
    w: [0, 0, 0],
    inclinacao: ((i * 53) % 100) / 100 * 2 - 1, // ângulo próprio no plano
    giro: [0.5 + (i % 3) * 0.15, 0.45 + (i % 2) * 0.2, 0.12 + (i % 4) * 0.05],
    fase: i * 1.7,
    escala: 1, vEscala: 0, tam: 0.85 + ((i * 37) % 30) / 100,
    flash: 0,
    atraso: 0.15 + i * 0.09,
    m: new Float32Array(16),
  }));

  // ================================================================ brilhos (partículas)
  const MAX_BRILHOS = 160;
  const brilhos = [];
  const dadosBrilho = new Float32Array(MAX_BRILHOS * 5);
  const bBrilho = buffer(dadosBrilho, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
  function soltarBrilhos(x, y, z, qtd) {
    for (let i = 0; i < qtd && brilhos.length < MAX_BRILHOS; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, vel = 1.2 + Math.random() * 2.2;
      brilhos.push({ p: [x, y, z], v: [Math.cos(a) * Math.cos(b) * vel, Math.sin(b) * vel + 0.6, Math.sin(a) * Math.cos(b) * vel], vida: 1, tam: 6 + Math.random() * 10 });
    }
  }

  // ================================================================ tamanho e qualidade
  let dpr = Math.min(devicePixelRatio || 1, 1.5);
  const NIVEIS = [2, 1.5, 1.25, 1];
  let largura = 0, altura = 0, aspecto = 1, proj = perspectiva(0.62, 1, 0.1, 40);
  function ajustarTamanho() {
    const r = cartao.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    aspecto = r.width / Math.max(r.height, 1);
    if (w !== largura || h !== altura) {
      largura = canvas.width = w;
      altura = canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    proj = perspectiva(0.62, aspecto, 0.1, 40);
  }

  // ================================================================ interação
  let tamTela = 1;
  let alvoX = 0, alvoY = 0, mouseX = 0, mouseY = 0, apontando = false, rolagem = 0, gx = 0, gy = 0, interagiu = false;
  const meiaAltura = CAM_Z * Math.tan(0.31); // metade da altura visível em z = 0
  const paraMundo = (cx, cy) => [cx * meiaAltura * aspecto, cy * meiaAltura];
  function coordenadas(e) {
    const r = cartao.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  }
  cartao.addEventListener('pointermove', (e) => {
    [alvoX, alvoY] = coordenadas(e);
    apontando = e.pointerType === 'mouse' || e.buttons > 0 || e.pointerType === 'touch';
  }, { passive: true });
  cartao.addEventListener('pointerleave', () => (apontando = false));
  cartao.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && (apontando = false));

  // qual unha está sob o dedo? (projeta o centro de cada uma na tela)
  function unhaSob(cx, cy) {
    let melhor = null, menor = Infinity;
    for (const o of unhas) {
      const z = CAM_Z - o.p[2];
      const sx = (o.p[0] / z) * (CAM_Z / meiaAltura) / aspecto;
      const sy = (o.p[1] / z) * (CAM_Z / meiaAltura);
      const raio = ((0.42 * o.tam * o.escala * tamTela) / z) * (CAM_Z / meiaAltura);
      const d = Math.hypot((sx - cx) * aspecto, sy - cy);
      if (d < raio * 1.15 && d < menor) { menor = d; melhor = o; }
    }
    return melhor;
  }
  cartao.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const [cx, cy] = coordenadas(e);
    marcarInteracao();
    pedirGiroscopio();
    const o = unhaSob(cx, cy);
    if (o) {
      // troca o esmalte, gira e solta brilhos
      o.esmalte = (o.esmalte + 1 + Math.floor(Math.random() * 3)) % ESMALTES.length;
      o.w[1] += 16 + Math.random() * 6; // pirueta
      o.w[0] += (Math.random() - 0.5) * 6;
      o.vEscala += 5;
      o.flash = 1;
      soltarBrilhos(o.p[0], o.p[1], o.p[2] + 0.2, 26);
      if (navigator.vibrate) navigator.vibrate(12);
    } else {
      // onda que espalha as unhas a partir do toque
      const [wx, wy] = paraMundo(cx, cy);
      for (const u of unhas) {
        const dx = u.p[0] - wx, dy = u.p[1] - wy, d = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 3 - d) * 2.4;
        u.v[0] += (dx / d) * f;
        u.v[1] += (dy / d) * f;
        u.v[2] += f * 0.5;
        u.w[2] += (Math.random() - 0.5) * f * 1.5;
        u.w[0] += (Math.random() - 0.5) * f;
      }
      soltarBrilhos(wx, wy, 0.3, 12);
    }
    if (!rodando && visivel && !menosMovimento) iniciar();
  });
  function marcarInteracao() {
    if (interagiu) return;
    interagiu = true;
    cartao.classList.add('interagiu');
  }

  // inclinar o celular move as unhas
  let giroscopioPedido = false;
  function ouvirGiroscopio() {
    addEventListener('deviceorientation', (e) => {
      if (e.beta == null) return;
      gx = Math.max(-1, Math.min(1, (e.gamma || 0) / 30));
      gy = Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 30));
    }, { passive: true });
  }
  function pedirGiroscopio() {
    if (giroscopioPedido || !('DeviceOrientationEvent' in window)) return;
    giroscopioPedido = true;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then((r) => r === 'granted' && ouvirGiroscopio()).catch(() => {});
    }
  }
  if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') ouvirGiroscopio();

  // ================================================================ física
  function atualizar(t, dt) {
    const suave = 1 - Math.exp(-dt * 6);
    mouseX += (alvoX - mouseX) * suave;
    mouseY += (alvoY - mouseY) * suave;
    const kx = Math.min(Math.max(aspecto / 1.75, 0.42), 1.05);
    const ky = aspecto < 1 ? 1.2 : 1;
    const sobe = aspecto < 1 ? 0.35 : 0.1; // deixa a parte de baixo livre para o texto
    tamTela = aspecto < 1 ? 0.78 : 1;
    const [px, py] = paraMundo(mouseX, mouseY);
    for (const o of unhas) {
      const ativo = t > o.atraso;
      const alvo = [
        o.base[0] * kx + Math.sin(t * 0.55 + o.fase) * 0.07 + gx * 0.35,
        o.base[1] * ky + sobe + Math.cos(t * 0.45 + o.fase) * 0.09 - gy * 0.3 + rolagem * 1.6,
        o.base[2] - rolagem * 1.2,
      ];
      const k = ativo ? 16 : 0, amort = ativo ? 4.5 : 0;
      for (let i = 0; i < 3; i++) {
        let f = (alvo[i] - o.p[i]) * k;
        if (apontando && i < 2) {
          const dx = o.p[0] - px, dy = o.p[1] - py, d = Math.hypot(dx, dy) || 1;
          f += ((i === 0 ? dx : dy) / d) * Math.max(0, 1.1 - d) * 30;
        }
        o.v[i] = (o.v[i] + f * dt) * Math.exp(-amort * dt);
        o.p[i] += o.v[i] * dt;
      }
      // pirueta: a velocidade extra diminui e uma "mola" leva de volta à frente (múltiplo de 360°)
      for (let i = 0; i < 3; i++) {
        const volta = Math.PI * 2;
        const alvoGiro = Math.round(o.extra[i] / volta) * volta;
        o.w[i] += ((alvoGiro - o.extra[i]) * 14 - o.w[i] * 4.2) * dt;
        o.extra[i] += o.w[i] * dt;
      }
      o.vEscala += (1 - o.escala) * 160 * dt;
      o.vEscala *= Math.exp(-10 * dt);
      o.escala += o.vEscala * dt;
      o.flash *= Math.exp(-5 * dt);
      const ax = Math.sin(t * o.giro[0] * 0.6 + o.fase) * 0.42 - mouseY * 0.35 - (o.p[1] - py) * 0.05;
      const ay = Math.cos(t * o.giro[1] * 0.6 + o.fase) * 0.5 + mouseX * 0.45;
      const az = o.inclinacao * 1.2 + Math.sin(t * o.giro[2] + o.fase) * 0.25;
      modelo(o.m, o.p[0], o.p[1], o.p[2], ax + o.extra[0], ay + o.extra[1], az + o.extra[2], o.tam * o.escala * tamTela);
    }
    for (let i = brilhos.length - 1; i >= 0; i--) {
      const b = brilhos[i];
      b.v[1] -= 2.2 * dt;
      for (let k = 0; k < 3; k++) { b.v[k] *= Math.exp(-1.8 * dt); b.p[k] += b.v[k] * dt; }
      b.vida -= dt * 1.1;
      if (b.vida <= 0) brilhos.splice(i, 1);
    }
  }

  // ================================================================ desenho
  function desenhar(t) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    const { p, u, a } = progUnha;
    gl.useProgram(p);
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniformMatrix4fv(u.uView, false, vista);
    gl.uniform2f(u.uLuz, mouseX, mouseY);
    gl.uniform1f(u.uTempo, t);
    const aPos = a('aPos'), aNor = a('aNor');
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bNor);
    gl.enableVertexAttribArray(aNor);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx);
    for (const o of unhas) {
      const e = ESMALTES[o.esmalte];
      gl.uniformMatrix4fv(u.uModel, false, o.m);
      gl.uniform3fv(u.uCor, e.c1);
      gl.uniform3fv(u.uCor2, e.c2);
      gl.uniform1f(u.uTipo, e.tipo);
      gl.uniform1f(u.uFlash, o.flash);
      gl.drawElements(gl.TRIANGLES, malha.idx.length, gl.UNSIGNED_SHORT, 0);
    }
    gl.disableVertexAttribArray(aNor);

    if (brilhos.length) {
      brilhos.forEach((b, i) => dadosBrilho.set([b.p[0], b.p[1], b.p[2], Math.max(b.vida, 0), b.tam], i * 5));
      const pb = progBrilho;
      gl.useProgram(pb.p);
      gl.uniformMatrix4fv(pb.u.uProj, false, proj);
      gl.uniformMatrix4fv(pb.u.uView, false, vista);
      gl.uniform1f(pb.u.uDpr, dpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, bBrilho);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dadosBrilho.subarray(0, brilhos.length * 5));
      const aP = pb.a('aPos'), aV = pb.a('aVida'), aT = pb.a('aTam');
      gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(aV); gl.vertexAttribPointer(aV, 1, gl.FLOAT, false, 20, 12);
      gl.enableVertexAttribArray(aT); gl.vertexAttribPointer(aT, 1, gl.FLOAT, false, 20, 16);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, brilhos.length);
      gl.disableVertexAttribArray(aV);
      gl.disableVertexAttribArray(aT);
    }
  }

  // ================================================================ laço com ajuste de qualidade
  let visivel = true, rodando = false, anterior = 0, tempo = 0, soma = 0, contagem = 0, folga = 0;
  let nivel = Math.max(0, NIVEIS.findIndex((n) => n <= dpr));
  window.__cena = { fps: 0, dpr: () => dpr };
  function quadro(agora) {
    if (!visivel || document.hidden) return (rodando = false);
    const dt = anterior ? Math.min((agora - anterior) / 1000, 0.05) : 1 / 60;
    anterior = agora;
    tempo += dt;
    atualizar(tempo, dt);
    desenhar(tempo);
    soma += dt;
    if (++contagem === 45) {
      const media = (soma / contagem) * 1000;
      window.__cena.fps = Math.round(1000 / media);
      // se o aparelho estiver sofrendo, reduz a densidade de pixels (continua nítido)
      if (media > 21 && nivel < NIVEIS.length - 1) {
        nivel++;
        dpr = Math.min(NIVEIS[nivel], devicePixelRatio || 1);
        ajustarTamanho();
      } else if (media < 17.5 && nivel > 0 && folga++ > 3) {
        // aparelho com folga: aumenta a nitidez
        nivel--;
        dpr = Math.min(NIVEIS[nivel], devicePixelRatio || 1);
        ajustarTamanho();
        folga = 0;
      }
      soma = contagem = 0;
    }
    requestAnimationFrame(quadro);
  }
  function iniciar() {
    if (rodando) return;
    rodando = true;
    anterior = 0;
    requestAnimationFrame(quadro);
  }

  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting;
    if (visivel && !menosMovimento) iniciar();
  }).observe(cartao);
  document.addEventListener('visibilitychange', () => !document.hidden && visivel && !menosMovimento && iniciar());
  addEventListener('scroll', () => {
    const r = cartao.getBoundingClientRect();
    rolagem = Math.min(Math.max(-r.top / Math.max(r.height, 1), 0), 1);
  }, { passive: true });
  let larguraJanela = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === larguraJanela && matchMedia('(max-width: 720px)').matches) return; // barra do navegador do celular
    larguraJanela = innerWidth;
    ajustarTamanho();
    if (menosMovimento) { atualizar(3, 0.016); desenhar(3); }
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); semSuporte(); });

  ajustarTamanho();
  cartao.classList.add('cena-pronta');
  if (menosMovimento) {
    // sem animação: mostra as unhas já no lugar
    unhas.forEach((o) => (o.p = [...o.base]));
    for (let i = 0; i < 5; i++) atualizar(3, 0.016);
    desenhar(3);
  } else iniciar();
})();
