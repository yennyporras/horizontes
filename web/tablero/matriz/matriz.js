// Matriz de burbujas de Horizontes. SVG puro, sin dependencias ni framework.
// Entrada: la respuesta de GET /api/tablero/{salaId} (ver mocks/GET_api_tablero.json).
// El frontend nunca recalcula el motor: solo dibuja eje_x, eje_y y tam que entrega el servidor.

const ETIQUETAS_HORIZONTE_DEFECTO = { H1: [1.3, 1.9], H2: [4.3, 4.0], H3: [8.0, 7.6] };

// Paleta de la familia Estratek (docs/marca/FAMILIA_ESTRATEK.md): solo tokens semánticos de
// web/shared/ui/tokens.css, sin valores en duro. El mismo SVG sirve en el tema carbón (tablero) y en el
// claro (celular y panel): cada var() toma el valor del tema de quien lo aloja.
// Horizontes de afuera hacia adentro en superficies escalonadas: H3 superficie 1, H2 superficie 2 y
// H1 superficie 3; su borde, el acento de Horizontes (gráfico propio, §1). R1, R2 y los fijos dan al
// menos 3:1 sobre las tres; el texto, más de 4,5:1 sobre su halo.
export const COLORES = {
  fondoH3: 'var(--hz-superficie-1)',
  fondoH2: 'var(--hz-superficie-2)',
  fondoH1: 'var(--hz-superficie-3)',
  curva: 'var(--hz-acento-producto-texto)',
  rejilla: 'var(--hz-tinta)',
  texto: 'var(--hz-tinta)',
  textoSuave: 'var(--hz-tinta-2)',
  // Gris azulado neutro: ni verde ni rojo (rondas) ni azul de acción.
  fijo: 'var(--hz-tinta-3)',
  halo: 'var(--hz-fondo)',
  // Colores por ronda. Los proyectos vivos se distinguen por su nombre, no por color;
  // la ronda, por color, forma (R1 hueco, R2 sólido) y la etiqueta «R1»/«R2».
  r1: 'var(--hz-r1)',
  r2: 'var(--hz-r2)',
};

// Los colores van en reglas CSS (los atributos de presentación no aceptan var()), limitadas a cada SVG por su id.
function estilosColor(id, C) {
  const s = `#${id} `;
  return (
    `${s}.hz-mz-h3{fill:${C.fondoH3}}` +
    `${s}.hz-mz-h2{fill:${C.fondoH2};stroke:${C.curva}}` +
    `${s}.hz-mz-h1{fill:${C.fondoH1};stroke:${C.curva}}` +
    `${s}.hz-mz-rejilla{stroke:${C.rejilla}}` +
    `${s}.hz-mz-eje{stroke:${C.texto}}` +
    `${s}.hz-mz-texto{fill:${C.texto}}` +
    `${s}.hz-mz-suave{fill:${C.textoSuave}}` +
    `${s}.hz-mz-punta{fill:${C.texto};stroke:${C.halo}}` +
    `${s}.hz-mz-halo{stroke:${C.halo}}` +
    `${s}.hz-flecha{stroke:${C.texto}}` +
    `${s}.hz-fijo{fill:${C.fijo};stroke:${C.halo}}` +
    `${s}.hz-r2{stroke:${C.halo}}` +
    `${s}.hz-etq{stroke:${C.halo}}`
  );
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

// Ancho aproximado de un texto en Montserrat 700 mayúsculas (sin medir en DOM para poder probar en Node).
function anchoTexto(texto, fs) {
  return String(texto).length * fs * 0.68 + fs * 0.3;
}

function cajasSeSolapan(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function areaSolape(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function circuloEnCaja(c, b) {
  const px = clamp(c.cx, b.x, b.x + b.w);
  const py = clamp(c.cy, b.y, b.y + b.h);
  return (c.cx - px) ** 2 + (c.cy - py) ** 2 < c.r * c.r;
}

function segmentoEnCaja(s, b) {
  // Muestreo del segmento: suficiente para flechas cortas de la matriz.
  const pasos = 24;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = s.x1 + (s.x2 - s.x1) * t;
    const y = s.y1 + (s.y2 - s.y1) * t;
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

/**
 * Radio en px según TAM: área proporcional al TAM (grafico.tam_a_radio de la semilla).
 */
export function radioPorTam(tam, rmin, rmax) {
  const t = clamp(esNumero(tam) ? tam : 1, 1, 10);
  return rmin + (Math.sqrt(t) / Math.sqrt(10)) * (rmax - rmin);
}

/**
 * Calcula toda la geometría de la matriz (sin producir SVG). Útil para pruebas.
 * @param {object} datos respuesta de GET /api/tablero
 * @param {{ancho:number, alto?:number, colores?:object, vista?:1|2|'comparacion'}} opciones
 *   vista 1 o 2 dibuja solo esa ronda en sólido; 'comparacion' (por defecto) dibuja R1 suave, R2 sólido y flecha.
 */
export function calcularLayout(datos, opciones = {}) {
  const W = Math.max(240, opciones.ancho || 800);
  const H = Math.max(240, opciones.alto || W);
  const colores = { ...COLORES, ...(opciones.colores || {}) };
  // escalaTexto agranda la tipografía (proyector: lectura a 6 m). 1 = tamaño base.
  const escalaTexto = esNumero(opciones.escalaTexto) ? clamp(opciones.escalaTexto, 0.6, 2) : 1;
  const fs = clamp((Math.min(W, H) / 52) * escalaTexto, 11, 34);

  const ejes = datos?.ejes || {};
  const ex = ejes.x || {};
  const ey = ejes.y || {};
  const xmin = esNumero(ex.min) ? ex.min : 0;
  const xmax = esNumero(ex.max) ? ex.max : 9.5;
  const ymin = esNumero(ey.min) ? ey.min : 0;
  const ymax = esNumero(ey.max) ? ey.max : 9.5;

  const ml = fs * 4.6;
  const mb = fs * 4.8;
  const mt = fs * 1.0;
  const mr = fs * 1.0;
  const P = Math.max(100, Math.min(W - ml - mr, H - mt - mb));
  const x0 = ml + Math.max(0, (W - ml - mr - P) / 2);
  const y0 = mt + Math.max(0, (H - mt - mb - P) / 2);

  const sx = (v) => x0 + ((v - xmin) / (xmax - xmin)) * P;
  const sy = (v) => y0 + P - ((v - ymin) / (ymax - ymin)) * P;
  const escala = P / (xmax - xmin);

  const rmin = P * 0.014;
  const rmax = P * 0.045;

  const grafico = datos?.grafico || {};
  const horizontes = (grafico.horizontes || [
    { id: 'H1', radio: 4.5 },
    { id: 'H2', radio: 9 },
    { id: 'H3', radio: null },
  ]).map((h) => ({ id: h.id, radio: h.radio }));
  const posEtiquetas = { ...ETIQUETAS_HORIZONTE_DEFECTO, ...(grafico.etiquetas_horizonte || {}) };

  const fijos = (datos?.proyectos_fijos || [])
    .filter((p) => esNumero(p.eje_x) && esNumero(p.eje_y))
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tam: p.tam,
      cx: sx(clamp(p.eje_x, xmin, xmax)),
      cy: sy(clamp(p.eje_y, ymin, ymax)),
      r: radioPorTam(p.tam, rmin, rmax),
      valor: { x: p.eje_x, y: p.eje_y },
    }));

  const vivos = (datos?.proyectos_vivos || []).map((p) => {
    const r = radioPorTam(p.tam, rmin, rmax);
    const ronda = (n) => {
      const rd = (p.rondas || []).find((x) => x.ronda === n);
      if (!rd || !esNumero(rd.eje_x) || !esNumero(rd.eje_y)) return null;
      return {
        cx: sx(clamp(rd.eje_x, xmin, xmax)),
        cy: sy(clamp(rd.eje_y, ymin, ymax)),
        r,
        valor: { x: rd.eje_x, y: rd.eje_y },
        n_votos: rd.n_votos,
      };
    };
    const vista = opciones.vista ?? 'comparacion';
    const r1 = vista === 2 ? null : ronda(1);
    const r2_ = vista === 1 ? null : ronda(2);
    let flecha = null;
    if (r1 && r2_) {
      const dx = r2_.cx - r1.cx;
      const dy = r2_.cy - r1.cy;
      const d = Math.hypot(dx, dy);
      const punta = Math.max(6, fs * 0.55);
      const ux = d ? dx / d : 0;
      const uy = d ? dy / d : 0;
      if (d > r1.r + r2_.r + punta) {
        // Burbujas separadas: de borde a borde.
        flecha = {
          x1: r1.cx + ux * (r1.r + 2),
          y1: r1.cy + uy * (r1.r + 2),
          x2: r2_.cx - ux * (r2_.r + 3),
          y2: r2_.cy - uy * (r2_.r + 3),
          encima: false,
        };
      } else if (d > punta * 1.4) {
        // Burbujas superpuestas (movimiento corto): de centro a centro, dibujada encima.
        flecha = { x1: r1.cx, y1: r1.cy, x2: r2_.cx - ux * 2, y2: r2_.cy - uy * 2, encima: true };
      }
    }
    return { id: p.id, nombre: p.nombre, tam: p.tam, r1, r2: r2_, flecha };
  });

  // Obstáculos: todas las burbujas y flechas.
  const circulos = [
    ...fijos,
    ...vivos.flatMap((v) => [v.r1, v.r2].filter(Boolean)),
  ];
  const segmentos = vivos.map((v) => v.flecha).filter(Boolean);
  const limites = { x: x0, y: y0, w: P, h: P };

  const colocadas = [];
  const fsVivo = fs * 1.05;
  const fsFijo = Math.max(10, fs * 0.82);
  const fsTag = Math.max(10, fs * 0.78);

  function colocar(etq, ancla, prioridad) {
    const w = anchoTexto(etq.texto, etq.fs) + (etq.extraAncho || 0);
    const h = etq.fs * 1.25;
    const gap = Math.max(3, etq.fs * 0.3);
    const sep = etq.fs * 0.3;
    const anillos = prioridad ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];
    let mejor = null;
    for (const anillo of anillos) {
      const d = ancla.r + gap + anillo * etq.fs * 0.9;
      // Orden de preferencia: derecha, arriba-derecha, abajo-derecha, arriba, abajo, izquierda...
      const cands = [
        [ancla.cx + d, ancla.cy - h / 2],
        [ancla.cx + d * 0.7, ancla.cy - d * 0.7 - h],
        [ancla.cx + d * 0.7, ancla.cy + d * 0.7],
        [ancla.cx - w / 2, ancla.cy - d - h],
        [ancla.cx - w / 2, ancla.cy + d],
        [ancla.cx - d - w, ancla.cy - h / 2],
        [ancla.cx - d * 0.7 - w, ancla.cy - d * 0.7 - h],
        [ancla.cx - d * 0.7 - w, ancla.cy + d * 0.7],
      ];
      for (const [x, y] of cands) {
        const caja = { x, y, w, h };
        let costo = 0;
        if (x < limites.x || y < limites.y || x + w > limites.x + limites.w || y + h > limites.y + limites.h) {
          costo += 1e6;
        }
        for (const c of circulos) {
          if (c === ancla) continue;
          if (circuloEnCaja(c, caja)) costo += (prioridad ? 5000 : 500) + c.r * c.r;
        }
        if (prioridad) for (const s of segmentos) if (segmentoEnCaja(s, caja)) costo += 4000;
        // Tapar otro texto es peor que rozar una burbuja: el nombre de un fijo nunca pisa el de un vivo.
        // Entre nombres queda un espacio (sin él, dos nombres seguidos se leen como uno).
        const holgada = { x: x - sep, y, w: w + 2 * sep, h };
        for (const o of colocadas) costo += areaSolape(holgada, o.caja) * (o.prioridad ? 50 : 4) + (cajasSeSolapan(holgada, o.caja) ? (o.prioridad ? 20000 : 1000) : 0);
        costo += anillo * 10;
        if (!mejor || costo < mejor.costo) mejor = { caja, costo };
        if (costo === anillo * 10) break;
      }
      if (mejor && mejor.costo === anillo * 10) break;
    }
    // Un fijo cuyo nombre solo cabe pisando el de un vivo o fuera del plano se queda sin nombre
    // (pasa en 360 px con un vivo encima); la burbuja conserva su título.
    if (!prioridad && mejor.costo >= 20000) return undefined;
    const resultado = { ...etq, caja: mejor.caja, prioridad, ancla };
    colocadas.push(resultado);
    return resultado;
  }

  // Prioridad: nombre y ronda de cada vivo en su burbuja principal (R2 si está), luego en su R1
  // (comparación), luego fijos (de mayor a menor burbuja).
  const etiquetaVivo = (v, ronda, fs, tipo) =>
    colocar({ texto: `${v.nombre} R${ronda}`, nombre: v.nombre, ronda, fs, color: 'texto', peso: 800, tipo }, ronda === 1 ? v.r1 : v.r2, true);
  for (const v of vivos) {
    if (v.r2 || v.r1) v.etiqueta = etiquetaVivo(v, v.r2 ? 2 : 1, fsVivo, 'vivo');
  }
  for (const v of vivos) {
    if (v.r1 && v.r2) v.etiquetaR1 = etiquetaVivo(v, 1, fsTag, 'r1');
  }
  for (const f of [...fijos].sort((a, b) => b.r - a.r)) {
    f.etiqueta = colocar({ texto: f.nombre, fs: fsFijo, color: 'suave', peso: 600, tipo: 'fijo' }, f, false);
  }

  return {
    W, H, fs, P, x0, y0, sx, sy, escala, xmin, xmax, ymin, ymax,
    ejes: { x: ex, y: ey },
    horizontes, posEtiquetas, fijos, vivos, etiquetas: colocadas, colores,
  };
}

let contadorInstancias = 0;

/**
 * Devuelve el SVG de la matriz como string.
 * @param {object} datos respuesta de GET /api/tablero
 * @param {{ancho:number, alto?:number, idPrefijo?:string, colores?:object}} opciones
 */
export function matrizSVG(datos, opciones = {}) {
  const L = calcularLayout(datos, opciones);
  const id = opciones.idPrefijo || `hzm${++contadorInstancias}`;
  const { W, H, fs, P, x0, y0, sx, sy, escala, colores: C } = L;
  const partes = [];
  const yBase = y0 + P;

  partes.push(
    `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" viewBox="0 0 ${r2(W)} ${r2(H)}" width="${r2(W)}" height="${r2(H)}" role="img" style="display:block" aria-labelledby="${id}-t ${id}-d" font-family="'Montserrat Variable', Montserrat, system-ui, -apple-system, 'Segoe UI', sans-serif" class="hz-matriz">`,
  );
  const animar = !!opciones.animar && L.vivos.some((v) => v.r1 && v.r2);
  let estilo = estilosColor(id, C);
  if (animar) {
    // Animación R1 → R2: la burbuja R2 sale desde la posición R1; flecha y etiquetas aparecen después.
    // Si el SVG se redibuja a mitad de camino (cambio de tamaño, datos nuevos), animarDesdeMs la
    // continúa donde iba (retraso negativo) en vez de volver a empezar desde R1.
    const desde = Math.max(0, Math.round(esNumero(opciones.animarDesdeMs) ? opciones.animarDesdeMs : 0));
    estilo +=
      `.hz-anim-mov{animation:hzMover 1.2s cubic-bezier(.22,.8,.3,1) ${-desde}ms both}` +
        `.hz-anim-apar{animation:hzAparecer .5s ease-out ${900 - desde}ms both}` +
        `@keyframes hzMover{from{transform:translate(var(--dx),var(--dy))}to{transform:translate(0,0)}}` +
        `@keyframes hzAparecer{from{opacity:0}to{opacity:1}}` +
      `@media (prefers-reduced-motion: reduce){.hz-anim-mov,.hz-anim-apar{animation:none}}`;
  }
  partes.push(`<style>${estilo}</style>`);
  partes.push(`<title id="${id}-t">${esc(datos?.grafico?.titulo || 'Matriz de priorización por horizontes')}</title>`);
  const desc = L.vivos
    .map((v) => {
      const f = (p) => (p ? `eje X ${p.valor.x.toFixed(2)}, eje Y ${p.valor.y.toFixed(2)}` : 'sin votos');
      return `${v.nombre}: ronda 1 ${f(v.r1)}; ronda 2 ${f(v.r2)}.`;
    })
    .join(' ');
  partes.push(`<desc id="${id}-d">${esc(desc)}</desc>`);
  partes.push(
    `<defs><clipPath id="${id}-clip"><rect x="${r2(x0)}" y="${r2(y0)}" width="${r2(P)}" height="${r2(P)}"/></clipPath>` +
      `<marker id="${id}-flecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="${r2(fs * 0.45)}" markerHeight="${r2(fs * 0.45)}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="hz-mz-punta" d="M0,0 L10,5 L0,10 z" stroke-width="1"/></marker>` +
      `</defs>`,
  );

  // Fondos de horizontes (H3 = todo el plano, H2 y H1 = cuartos de círculo desde el origen).
  partes.push(`<g clip-path="url(#${id}-clip)">`);
  partes.push(`<rect x="${r2(x0)}" y="${r2(y0)}" width="${r2(P)}" height="${r2(P)}" class="hz-mz-h3"/>`);
  const radios = L.horizontes.filter((h) => esNumero(h.radio)).sort((a, b) => b.radio - a.radio);
  radios.forEach((h, i) => {
    const rp = h.radio * escala;
    const clase = i === radios.length - 1 ? 'hz-mz-h1' : 'hz-mz-h2';
    partes.push(
      `<path d="M${r2(x0)},${r2(yBase)} L${r2(x0 + rp)},${r2(yBase)} A${r2(rp)},${r2(rp)} 0 0 0 ${r2(x0)},${r2(yBase - rp)} Z" class="${clase}" stroke-width="${r2(Math.max(1.5, fs * 0.12))}" stroke-dasharray="${r2(fs * 0.5)} ${r2(fs * 0.3)}"/>`,
    );
  });
  // Rejilla
  for (let v = Math.ceil(L.xmin); v <= L.xmax && v - L.xmin <= 50; v++) {
    partes.push(`<line x1="${r2(sx(v))}" y1="${r2(y0)}" x2="${r2(sx(v))}" y2="${r2(yBase)}" class="hz-mz-rejilla" stroke-opacity="0.08"/>`);
  }
  for (let v = Math.ceil(L.ymin); v <= L.ymax && v - L.ymin <= 50; v++) {
    partes.push(`<line x1="${r2(x0)}" y1="${r2(sy(v))}" x2="${r2(x0 + P)}" y2="${r2(sy(v))}" class="hz-mz-rejilla" stroke-opacity="0.08"/>`);
  }
  // Etiquetas H1, H2, H3
  for (const h of L.horizontes) {
    const pos = L.posEtiquetas[h.id];
    if (!pos) continue;
    partes.push(
      `<text x="${r2(sx(pos[0]))}" y="${r2(sy(pos[1]))}" font-size="${r2(fs * 2.4)}" font-weight="800" class="hz-mz-texto" fill-opacity="0.16" text-anchor="middle" dominant-baseline="middle">${esc(h.id)}</text>`,
    );
  }
  partes.push(`</g>`);

  // Ejes y marcas
  partes.push(
    `<path d="M${r2(x0)},${r2(y0)} V${r2(yBase)} H${r2(x0 + P)}" fill="none" class="hz-mz-eje" stroke-width="${r2(Math.max(1.5, fs * 0.1))}"/>`,
  );
  const fsTick = Math.max(10, fs * 0.78);
  for (let v = Math.ceil(L.xmin); v <= L.xmax && v - L.xmin <= 50; v++) {
    partes.push(`<text x="${r2(sx(v))}" y="${r2(yBase + fsTick * 1.3)}" font-size="${r2(fsTick)}" class="hz-mz-suave" text-anchor="middle">${v}</text>`);
  }
  for (let v = Math.ceil(L.ymin); v <= L.ymax && v - L.ymin <= 50; v++) {
    partes.push(`<text x="${r2(x0 - fsTick * 0.6)}" y="${r2(sy(v))}" font-size="${r2(fsTick)}" class="hz-mz-suave" text-anchor="end" dominant-baseline="middle">${v}</text>`);
  }
  // Títulos de ejes
  const tx = x0 + P / 2;
  partes.push(
    `<text x="${r2(tx)}" y="${r2(yBase + fs * 2.9)}" font-size="${r2(fs)}" font-weight="800" class="hz-mz-texto" text-anchor="middle" letter-spacing="0.04em">${esc(L.ejes.x.titulo || '')}</text>`,
    `<text x="${r2(tx)}" y="${r2(yBase + fs * 4.2)}" font-size="${r2(fs * 0.8)}" class="hz-mz-suave" text-anchor="middle">${esc(L.ejes.x.subtitulo || '')}</text>`,
  );
  const ty = y0 + P / 2;
  const xt1 = x0 - fs * 3.5;
  const xt2 = x0 - fs * 2.3;
  partes.push(
    `<text transform="translate(${r2(xt1)} ${r2(ty)}) rotate(-90)" font-size="${r2(fs)}" font-weight="800" class="hz-mz-texto" text-anchor="middle" letter-spacing="0.04em">${esc(L.ejes.y.titulo || '')}</text>`,
    `<text transform="translate(${r2(xt2)} ${r2(ty)}) rotate(-90)" font-size="${r2(fs * 0.8)}" class="hz-mz-suave" text-anchor="middle">${esc(L.ejes.y.subtitulo || '')}</text>`,
  );

  // Fijos
  partes.push(`<g class="hz-fijos">`);
  for (const f of L.fijos) {
    partes.push(
      `<circle class="hz-fijo" data-proyecto="${esc(f.id)}" cx="${r2(f.cx)}" cy="${r2(f.cy)}" r="${r2(f.r)}" stroke-width="1.5"><title>${esc(f.nombre)} · X ${f.valor.x} · Y ${f.valor.y} · TAM ${esc(f.tam)}</title></circle>`,
    );
  }
  partes.push(`</g>`);

  // Vivos: R2 sólido y rojo; flecha R1 → R2; R1 hueco y verde encima (se ve aunque caiga sobre una R2).
  const sw = r2(Math.max(2.5, fs * 0.2));
  const flecha = (a) =>
    `<line class="hz-mz-halo" x1="${r2(a.x1)}" y1="${r2(a.y1)}" x2="${r2(a.x2)}" y2="${r2(a.y2)}" stroke-width="${r2(sw * 2.4)}" stroke-linecap="round"/>` +
    `<line class="hz-flecha" x1="${r2(a.x1)}" y1="${r2(a.y1)}" x2="${r2(a.x2)}" y2="${r2(a.y2)}" stroke-width="${sw}" stroke-linecap="round" marker-end="url(#${id}-flecha)"/>`;
  const conFlecha = (encima) => L.vivos.filter((v) => v.flecha && v.flecha.encima === encima);
  partes.push(`<g class="hz-vivos">`);
  for (const v of L.vivos) {
    if (!v.r2) continue;
    const mover = animar && v.r1;
    partes.push(
      `<circle class="hz-r2${mover ? ' hz-anim-mov' : ''}" style="fill:${C.r2}${mover ? `;--dx:${r2(v.r1.cx - v.r2.cx)}px;--dy:${r2(v.r1.cy - v.r2.cy)}px` : ''}" data-proyecto="${esc(v.id)}" cx="${r2(v.r2.cx)}" cy="${r2(v.r2.cy)}" r="${r2(v.r2.r)}" stroke-width="2"><title>${esc(v.nombre)} ronda 2 · X ${v.r2.valor.x} · Y ${v.r2.valor.y}</title></circle>`,
    );
  }
  for (const v of conFlecha(false)) partes.push(`<g${animar ? ' class="hz-anim-apar"' : ''}>${flecha(v.flecha)}</g>`);
  for (const v of L.vivos) {
    if (!v.r1) continue;
    partes.push(
      `<circle class="hz-r1" style="fill:${C.r1};fill-opacity:0.14;stroke:${C.r1}" data-proyecto="${esc(v.id)}" cx="${r2(v.r1.cx)}" cy="${r2(v.r1.cy)}" r="${r2(v.r1.r)}" stroke-width="${sw}"><title>${esc(v.nombre)} ronda 1 · X ${v.r1.valor.x} · Y ${v.r1.valor.y}</title></circle>`,
    );
  }
  for (const v of conFlecha(true)) partes.push(`<g${animar ? ' class="hz-anim-apar"' : ''}>${flecha(v.flecha)}</g>`);
  partes.push(`</g>`);

  // Etiquetas (fijos primero para que los vivos queden encima).
  const orden = [...L.etiquetas].sort((a, b) => Number(a.prioridad) - Number(b.prioridad));
  partes.push(`<g class="hz-etiquetas">`);
  for (const e of orden) {
    const { caja } = e;
    partes.push(
      `<text class="hz-etq hz-etq-${e.tipo} hz-mz-${e.color}${animar && e.tipo !== 'fijo' ? ' hz-anim-apar' : ''}" x="${r2(caja.x + caja.w / 2)}" y="${r2(caja.y + caja.h / 2)}" font-size="${r2(e.fs)}" font-weight="${e.peso}" text-anchor="middle" dominant-baseline="central" stroke-width="${r2(e.fs * 0.28)}" stroke-linejoin="round" paint-order="stroke">${
        e.ronda ? `${esc(e.nombre)} <tspan class="hz-etq-ronda" style="fill:${C[`r${e.ronda}`]}">R${e.ronda}</tspan>` : esc(e.texto)
      }</text>`,
    );
  }
  partes.push(`</g></svg>`);
  return partes.join('');
}

/**
 * Monta la matriz en un elemento del DOM y la redibuja al cambiar de tamaño.
 * @returns {{actualizar:(datos:object)=>void, destruir:()=>void}}
 */
export function montarMatriz(contenedor, datosIniciales, opciones = {}) {
  let datos = datosIniciales;
  const idPrefijo = opciones.idPrefijo || `hzm${++contadorInstancias}`;
  const dibujar = () => {
    const ancho = contenedor.clientWidth || 360;
    const altoDisp = contenedor.clientHeight || ancho;
    const alto = Math.min(altoDisp, ancho * 1.05);
    contenedor.innerHTML = matrizSVG(datos, { ...opciones, ancho, alto: Math.max(alto, Math.min(ancho, 320)), idPrefijo });
  };
  dibujar();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    let pendiente = 0;
    ro = new ResizeObserver(() => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(dibujar);
    });
    ro.observe(contenedor);
  }
  return {
    actualizar(nuevos) {
      datos = nuevos;
      dibujar();
    },
    destruir() {
      ro?.disconnect();
      contenedor.innerHTML = '';
    },
  };
}
