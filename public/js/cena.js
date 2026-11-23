// Cena 3D do topo: unhas brilhantes flutuando, desenhadas pela placa de vídeo (WebGL).
// Pensada para ser leve: nenhum arquivo extra, resolução que se ajusta sozinha,
// e pausa automática quando o topo sai da tela ou a aba fica em segundo plano.
(function () {
  const canvas = document.getElementById('cena');
  const cartao = document.getElementById('hero-cartao');
  if (!canvas || !cartao) return;
  const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const semSuporte = () => cartao.classList.add('sem-3d');

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) return semSuporte();

  const N = 7;
  const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FRAG = `
precision highp float;
#define N ${N}
uniform vec2 uRes;
uniform vec3 uPos[N];
uniform mat3 uRot[N];
uniform vec3 uCor[N];
uniform float uMetal[N];
uniform vec2 uLuz;

// unha postiça: oval achatado, com a curvatura de uma unha de verdade
float sdUnha(vec3 p) {
  p.z += p.x * p.x * 0.9;
  vec2 b = vec2(0.2, 0.46);
  float r = 0.19;
  vec2 q = abs(p.xy) - b + r;
  float d2 = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  vec2 w = vec2(d2, abs(p.z) - 0.035);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.025;
}

vec3 normalLocal(vec3 q) {
  const vec2 e = vec2(0.0012, -0.0012);
  return normalize(e.xyy * sdUnha(q + e.xyy) + e.yyx * sdUnha(q + e.yyx) + e.yxy * sdUnha(q + e.yxy) + e.xxx * sdUnha(q + e.xxx));
}

// "estúdio de fotografia" refletido nas unhas
vec3 ambiente(vec3 r) {
  vec3 c = mix(vec3(0.015, 0.013, 0.02), vec3(0.16, 0.14, 0.19), r.y * 0.5 + 0.5);
  c += vec3(1.0, 0.96, 0.98) * smoothstep(0.72, 0.96, r.y) * 1.4;
  c += vec3(1.0, 0.18, 0.5) * smoothstep(0.5, 0.92, r.x) * 1.1;
  c += vec3(0.5, 0.35, 1.0) * smoothstep(0.55, 0.95, -r.x) * 0.6;
  return c;
}

// fundo já em cores de tela (não passa pela correção de tons)
vec3 fundo(vec2 uv) {
  float g = length(uv - vec2(0.45, -0.35));
  vec3 c = vec3(0.055, 0.051, 0.066);
  c += vec3(1.0, 0.24, 0.55) * 0.11 * exp(-g * g * 1.4);
  vec2 k = uv + vec2(0.9, -0.6);
  c += vec3(0.55, 0.38, 1.0) * 0.05 * exp(-dot(k, k) * 1.4);
  return c * (1.0 - 0.3 * dot(uv * 0.5, uv * 0.5));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 4.0);
  vec3 rd = normalize(vec3(uv, -2.2));
  vec3 col = fundo(uv);

  // só calcula as unhas que o raio realmente pode atingir
  float alvo[N];
  float tmin = 1e5;
  float tmax = -1.0;
  for (int i = 0; i < N; i++) {
    vec3 oc = ro - uPos[i];
    float b = dot(oc, rd);
    float h = b * b - (dot(oc, oc) - 0.37);
    alvo[i] = 0.0;
    if (h > 0.0) {
      h = sqrt(h);
      if (-b + h > 0.0) {
        alvo[i] = 1.0;
        tmin = min(tmin, max(-b - h, 0.0));
        tmax = max(tmax, -b + h);
      }
    }
  }

  if (tmax > 0.0) {
    float t = tmin;
    float d = 1e5;
    float qual = -1.0;
    for (int s = 0; s < 64; s++) {
      vec3 p = ro + rd * t;
      d = 1e5;
      for (int i = 0; i < N; i++) {
        if (alvo[i] > 0.5) {
          float di = sdUnha(uRot[i] * (p - uPos[i]));
          if (di < d) { d = di; qual = float(i); }
        }
      }
      if (d < 0.0012 || t > tmax) break;
      t += d * 0.8;
    }
    if (d < 0.004 && t < tmax) {
      vec3 p = ro + rd * t;
      mat3 R = mat3(1.0);
      vec3 P = vec3(0.0);
      vec3 base = vec3(1.0);
      float metal = 0.0;
      for (int i = 0; i < N; i++) {
        if (float(i) == qual) { R = uRot[i]; P = uPos[i]; base = uCor[i]; metal = uMetal[i]; }
      }
      vec3 n = normalLocal(R * (p - P)) * R;
      vec3 v = -rd;
      vec3 L = normalize(vec3(0.6 + uLuz.x * 1.4, 0.9 + uLuz.y * 1.1, 1.3));
      float dif = max(dot(n, L), 0.0);
      float spec = pow(max(dot(n, normalize(L + v)), 0.0), 110.0);
      float fre = pow(1.0 - max(dot(n, v), 0.0), 4.0);
      vec3 env = ambiente(reflect(rd, n));
      vec3 c;
      if (metal > 0.5) c = base * env * 1.35 + spec * 1.6;
      else c = base * (0.16 + 0.8 * dif) + env * (0.06 + 0.9 * fre) + spec * 1.8;
      // correção de tons só nas unhas
      c = 1.0 - exp(-c * 1.35);
      col = pow(c, vec3(0.4545));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

  function compilar(tipo, fonte) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fonte);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Cena 3D desativada:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = compilar(gl.VERTEX_SHADER, VERT);
  const fs = compilar(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return semSuporte();
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return semSuporte();
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const locP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(locP);
  gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

  const u = (n) => gl.getUniformLocation(prog, n);
  const uRes = u('uRes'), uPos = u('uPos'), uRot = u('uRot'), uCor = u('uCor'), uMetal = u('uMetal'), uLuz = u('uLuz');

  // cores das unhas (convertidas para luz linear)
  const lin = (hex) => [1, 3, 5].map((i) => Math.pow(parseInt(hex.slice(i, i + 2), 16) / 255, 2.2));
  const unhas = [
    { cor: '#ff3d8b', metal: 0, base: [-1.55, 0.35, 0.0] },
    { cor: '#f6eef1', metal: 0, base: [-0.62, -0.5, 0.55] },
    { cor: '#141216', metal: 0, base: [0.2, 0.42, -0.25] },
    { cor: '#d9d9e0', metal: 1, base: [1.05, -0.32, 0.35] },
    { cor: '#b3123c', metal: 0, base: [1.8, 0.52, -0.35] },
    { cor: '#b79cff', metal: 0, base: [-0.25, -1.08, -0.55] },
    { cor: '#e8b4a2', metal: 0, base: [0.85, 1.12, -0.75] },
  ].map((o, i) => ({
    ...o,
    fase: i * 1.7,
    giro: [0.3 + (i % 3) * 0.12, 0.22 + (i % 2) * 0.18, 0.1 + (i % 4) * 0.05],
    ang: [i * 0.9, i * 1.3, i * 0.6],
    desvio: [0, 0],
    vel: [0, 0],
  }));
  gl.uniform3fv(uCor, new Float32Array(unhas.flatMap((o) => lin(o.cor))));
  gl.uniform1fv(uMetal, new Float32Array(unhas.map((o) => o.metal)));

  // ---------------------------------------------------------------- tamanho e qualidade adaptativa
  const celular = matchMedia('(max-width: 720px)').matches;
  let escala = celular ? 0.7 : 0.62;
  const ESCALA_MAX = celular ? 0.85 : 0.8;
  const ESCALA_MIN = 0.45;
  let largura = 1, altura = 1, aspecto = 1;
  function ajustarTamanho() {
    const r = cartao.getBoundingClientRect();
    aspecto = r.width / Math.max(r.height, 1);
    let w = Math.round(r.width * escala), h = Math.round(r.height * escala);
    const maxPx = 650000; // teto de pixels, para telas muito grandes
    if (w * h > maxPx) {
      const k = Math.sqrt(maxPx / (w * h));
      w = Math.round(w * k);
      h = Math.round(h * k);
    }
    if (w === largura && h === altura) return;
    largura = canvas.width = Math.max(w, 2);
    altura = canvas.height = Math.max(h, 2);
    gl.viewport(0, 0, largura, altura);
    gl.uniform2f(uRes, largura, altura);
  }

  // ---------------------------------------------------------------- interação
  let mouseX = 0, mouseY = 0, alvoX = 0, alvoY = 0, apontando = false, rolagem = 0;
  cartao.addEventListener('pointermove', (e) => {
    const r = cartao.getBoundingClientRect();
    alvoX = ((e.clientX - r.left) / r.width) * 2 - 1;
    alvoY = -(((e.clientY - r.top) / r.height) * 2 - 1);
    apontando = true;
  }, { passive: true });
  cartao.addEventListener('pointerleave', () => (apontando = false));

  // matriz de rotação (coluna principal) a partir de 3 ângulos
  function rotacao(a, b, c, saida, o) {
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    saida[o] = cb * cc; saida[o + 1] = ca * sc + sa * sb * cc; saida[o + 2] = sa * sc - ca * sb * cc;
    saida[o + 3] = -cb * sc; saida[o + 4] = ca * cc - sa * sb * sc; saida[o + 5] = sa * cc + ca * sb * sc;
    saida[o + 6] = sb; saida[o + 7] = -sa * cb; saida[o + 8] = ca * cb;
  }

  const pos = new Float32Array(N * 3);
  const rot = new Float32Array(N * 9);
  function atualizar(t, dt) {
    mouseX += (alvoX - mouseX) * Math.min(dt * 4, 1);
    mouseY += (alvoY - mouseY) * Math.min(dt * 4, 1);
    // espalha as unhas conforme o formato da tela (celular em pé = mais estreito)
    const kx = Math.min(Math.max(aspecto / 1.8, 0.42), 1);
    const ky = aspecto < 1 ? 1.35 : 1;
    // ponteiro no "chão" da cena (z = 0)
    const px = mouseX * aspecto * (4 / 2.2), py = mouseY * (4 / 2.2);
    unhas.forEach((o, i) => {
      let x = o.base[0] * kx + Math.sin(t * 0.6 + o.fase) * 0.07;
      let y = o.base[1] * ky + Math.cos(t * 0.5 + o.fase) * 0.1 - rolagem * 0.6;
      // as unhas "fogem" do dedo/mouse, como se tivessem mola
      let fx = 0, fy = 0;
      if (apontando) {
        const dx = x - px, dy = y - py, dist = Math.hypot(dx, dy) || 1;
        const forca = Math.max(0, 1.05 - dist) * 2.2;
        fx = (dx / dist) * forca;
        fy = (dy / dist) * forca;
      }
      for (let k = 0; k < 2; k++) {
        const f = (k ? fy : fx) * 0.6 - o.desvio[k] * 9;
        o.vel[k] = (o.vel[k] + f * dt) * Math.pow(0.02, dt);
        o.desvio[k] += o.vel[k] * dt * 4;
      }
      pos[i * 3] = x + o.desvio[0];
      pos[i * 3 + 1] = y + o.desvio[1];
      pos[i * 3 + 2] = o.base[2] + rolagem * 0.8;
      rotacao(
        o.ang[0] + t * o.giro[0] + mouseY * 0.35 + rolagem * 1.2,
        o.ang[1] + t * o.giro[1] + mouseX * 0.45,
        o.ang[2] + t * o.giro[2] + o.vel[0] * 0.8,
        rot, i * 9
      );
    });
    gl.uniform3fv(uPos, pos);
    gl.uniformMatrix3fv(uRot, false, rot);
    gl.uniform2f(uLuz, mouseX, mouseY);
  }

  // ---------------------------------------------------------------- laço de desenho
  let visivel = true, rodando = false, anterior = 0, tempo = 0;
  let somaQuadros = 0, contagem = 0, lentoDemais = 0;
  function quadro(agora) {
    if (!visivel || document.hidden) return (rodando = false);
    const dt = anterior ? Math.min((agora - anterior) / 1000, 0.1) : 1 / 60;
    anterior = agora;
    tempo += dt;
    atualizar(tempo, dt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // mede o desempenho e ajusta a resolução para manter tudo fluido
    somaQuadros += dt;
    if (++contagem === 40) {
      const media = (somaQuadros / contagem) * 1000;
      if (media > 21 && escala > ESCALA_MIN) {
        escala = Math.max(ESCALA_MIN, escala - 0.08);
        ajustarTamanho();
      } else if (media < 14 && escala < ESCALA_MAX) {
        escala = Math.min(ESCALA_MAX, escala + 0.04);
        ajustarTamanho();
      }
      // aparelho muito fraco: congela num quadro bonito em vez de travar a página
      if (media > 40 && escala <= ESCALA_MIN) lentoDemais++;
      if (lentoDemais >= 3) {
        cartao.classList.add('cena-parada');
        escala = ESCALA_MAX; // um único quadro nítido, sem animação
        ajustarTamanho();
        desenharParado();
        return (rodando = false);
      }
      somaQuadros = contagem = 0;
    }
    requestAnimationFrame(quadro);
  }
  function iniciar() {
    if (rodando || menosMovimento || cartao.classList.contains('cena-parada')) return;
    rodando = true;
    anterior = 0;
    requestAnimationFrame(quadro);
  }
  function desenharParado() {
    atualizar(tempo || 2, 0.016);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting;
    if (visivel) iniciar();
  }).observe(cartao);
  document.addEventListener('visibilitychange', () => !document.hidden && visivel && iniciar());
  addEventListener('scroll', () => {
    const r = cartao.getBoundingClientRect();
    rolagem = Math.min(Math.max(-r.top / Math.max(r.height, 1), 0), 1);
  }, { passive: true });
  let larguraJanela = innerWidth;
  addEventListener('resize', () => {
    if (Math.abs(innerWidth - larguraJanela) < 2 && celular) return; // ignora a barra do navegador do celular
    larguraJanela = innerWidth;
    ajustarTamanho();
    if (!rodando) desenharParado();
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); semSuporte(); });

  ajustarTamanho();
  desenharParado();
  cartao.classList.add('cena-pronta');
  iniciar();
})();
