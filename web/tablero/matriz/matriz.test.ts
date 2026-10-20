// Pruebas de la matriz (Vitest). Correr: npx vitest run web/tablero
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANIMACION, calcularLayout, formaTitulo, matrizSVG, radioPorTam, type Caja } from './matriz.js';
import type { DatosTablero, Vista } from '../tipos';

const mock: DatosTablero = JSON.parse(readFileSync(new URL('../../../mocks/GET_api_tablero.json', import.meta.url), 'utf8'));
const ANCHOS = [360, 412, 768, 1280, 1920];

const solapan = (a: Caja, b: Caja) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

test('radio por TAM: área proporcional y acotada', () => {
  assert.equal(radioPorTam(10, 10, 50), 50);
  assert.ok(Math.abs(radioPorTam(1, 10, 50) - (10 + 40 / Math.sqrt(10))) < 1e-9);
  assert.equal(radioPorTam(99, 10, 50), 50);
  assert.equal(radioPorTam(0, 10, 50), radioPorTam(1, 10, 50));
  assert.equal(radioPorTam(null, 10, 50), radioPorTam(1, 10, 50));
});

test('dibuja 8 fijos, 2 vivos con R1, R2 y flecha', () => {
  const svg = matrizSVG(mock, { ancho: 1280, idPrefijo: 't' });
  for (const p of mock.proyectos_fijos) assert.ok(svg.includes(`>${p.nombre}</text>`), p.nombre);
  for (const p of mock.proyectos_vivos) {
    assert.ok(svg.includes(`>${p.nombre} <tspan class="hz-etq-ronda" style="fill:var(--hz-r2)">R2</tspan></text>`), `${p.nombre} R2`);
    assert.ok(svg.includes(`>${p.nombre} <tspan class="hz-etq-ronda" style="fill:var(--hz-r1)">R1</tspan></text>`), `${p.nombre} R1`);
  }
  assert.equal((svg.match(/class="hz-r1"/g) || []).length, 2);
  assert.equal((svg.match(/class="hz-r2"/g) || []).length, 2);
  assert.equal((svg.match(/class="hz-flecha"/g) || []).length, 2);
  assert.ok(svg.includes(formaTitulo(mock.ejes.x.titulo)));
  assert.ok(svg.includes(mock.ejes.y.subtitulo!));
  for (const h of ['H1', 'H2', 'H3']) assert.ok(svg.includes(`>${h}</text>`));
});

test('posiciones respetan la escala 0 a 9,5', () => {
  const L = calcularLayout(mock, { ancho: 1000 });
  const yummi = L.fijos.find((f) => f.id === 'yummi')!;
  assert.ok(Math.abs(yummi.cx - (L.x0 + (8.22 / 9.5) * L.P)) < 1e-9);
  assert.ok(Math.abs(yummi.cy - (L.y0 + L.P - (6.4 / 9.5) * L.P)) < 1e-9);
});

for (const ancho of ANCHOS) {
  test(`etiquetas de vivos sin solaparse a ${ancho} px`, () => {
    const L = calcularLayout(mock, { ancho });
    const prior = L.etiquetas.filter((e) => e.prioridad);
    assert.equal(prior.length, 4); // 2 nombres + 2 etiquetas R1
    for (const e of prior) {
      for (const o of L.etiquetas) {
        if (o === e) continue;
        assert.ok(!solapan(e.caja, o.caja), `${e.texto} choca con ${o.texto} a ${ancho}px`);
      }
      // dentro del área de dibujo
      assert.ok(e.caja.x >= L.x0 && e.caja.x + e.caja.w <= L.x0 + L.P, `${e.texto} fuera en X`);
      assert.ok(e.caja.y >= L.y0 && e.caja.y + e.caja.h <= L.y0 + L.P, `${e.texto} fuera en Y`);
      // no tapa ninguna burbuja
      const circulos = [...L.fijos, ...L.vivos.flatMap((v) => [v.r1!, v.r2!])];
      for (const c of circulos) {
        const px = Math.min(e.caja.x + e.caja.w, Math.max(e.caja.x, c.cx));
        const py = Math.min(e.caja.y + e.caja.h, Math.max(e.caja.y, c.cy));
        assert.ok((c.cx - px) ** 2 + (c.cy - py) ** 2 >= c.r * c.r, `${e.texto} tapa una burbuja a ${ancho}px`);
      }
    }
  });
}

test('ronda sin votos no se dibuja ni deja flecha', () => {
  const datos = structuredClone(mock);
  for (const v of datos.proyectos_vivos) {
    const r2 = v.rondas.find((r) => r.ronda === 2)!;
    Object.assign(r2, { n_votos: 0, t2m: null, eje_x: null, eje_y: null });
  }
  const svg = matrizSVG(datos, { ancho: 800 });
  assert.equal((svg.match(/class="hz-r2"/g) || []).length, 0);
  assert.equal((svg.match(/class="hz-flecha"/g) || []).length, 0);
  assert.equal((svg.match(/class="hz-r1"/g) || []).length, 2);
  assert.ok(svg.includes('>INSUMEX <tspan class="hz-etq-ronda" style="fill:var(--hz-r1)">R1</tspan>'));
});

test('ronda por color y forma: R1 hueco verde, R2 sólido rojo; los fijos sin verde ni rojo', () => {
  const svg = matrizSVG(mock, { ancho: 1280 });
  const r1 = svg.match(/<circle class="hz-r1"[^>]*>/g)!;
  const r2 = svg.match(/<circle class="hz-r2"[^>]*>/g)!;
  for (const c of r1) assert.match(c, /style="fill:var\(--hz-r1\);fill-opacity:0\.14;stroke:var\(--hz-r1\)"/);
  for (const c of r2) assert.match(c, /style="fill:var\(--hz-r2\)"/);
  const fijos = svg.match(/<circle class="hz-fijo"[^>]*>/g)!;
  for (const c of fijos) assert.ok(!/hz-r1|hz-r2|3FB25A|F36363/i.test(c));
});

test('datos vacíos no rompen', () => {
  const svg = matrizSVG({}, { ancho: 360 });
  assert.ok(svg.startsWith('<svg'));
});

test('escapa texto del servidor', () => {
  const datos = structuredClone(mock);
  datos.proyectos_fijos[0].nombre = '<script>x</script>';
  const svg = matrizSVG(datos, { ancho: 800 });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
});

test('vista de una sola ronda: sin flecha, una etiqueta por vivo con su ronda', () => {
  for (const vista of [1, 2] as Vista[]) {
    const svg = matrizSVG(mock, { ancho: 1280, vista });
    assert.equal((svg.match(/class="hz-flecha"/g) || []).length, 0);
    assert.equal((svg.match(/class="hz-r1"/g) || []).length, vista === 1 ? 2 : 0);
    assert.equal((svg.match(/class="hz-r2"/g) || []).length, vista === 2 ? 2 : 0);
    assert.ok(!svg.includes('hz-etq-r1'));
    assert.ok(svg.includes(`>NUTRIWHAT <tspan class="hz-etq-ronda" style="fill:var(--hz-r${vista}`));
    assert.equal((svg.match(/hz-etq-ronda/g) || []).length, 2);
  }
});

// Aceptación R1: el punto dibujado coincide con el golden (prueba sintética, tolerancia 0,001).
test('el punto dibujado coincide con el golden sintético en 360, 1366 y 1920 px', () => {
  const golden = JSON.parse(readFileSync(new URL('../../../tests/golden/motor_golden.json', import.meta.url), 'utf8'));
  const esperado = golden.prueba_sintetica.esperado as Record<string, Record<string, { eje_x: number; eje_y: number }>>;
  const tol = golden.tolerancia as number;
  for (const ancho of [360, 1366, 1920]) {
    const L = calcularLayout(mock, { ancho, alto: Math.round(ancho * 0.6) });
    const valX = (px: number) => L.xmin + ((px - L.x0) / L.P) * (L.xmax - L.xmin);
    const valY = (py: number) => L.ymin + ((L.y0 + L.P - py) / L.P) * (L.ymax - L.ymin);
    for (const v of L.vivos) {
      for (const [n, b] of [['1', v.r1], ['2', v.r2]] as const) {
        const e = esperado[v.nombre.toUpperCase()][n];
        assert.ok(b, `${v.nombre} R${n} dibujado`);
        assert.ok(Math.abs(valX(b!.cx) - e.eje_x) <= tol, `${v.nombre} R${n} X a ${ancho}px`);
        assert.ok(Math.abs(valY(b!.cy) - e.eje_y) <= tol, `${v.nombre} R${n} Y a ${ancho}px`);
      }
    }
    for (const caso of golden.casos_proyecto as { nombre: string; esperado: { eje_x: number; eje_y: number } }[]) {
      const f = L.fijos.find((x) => x.nombre === caso.nombre);
      assert.ok(f, caso.nombre);
      assert.ok(Math.abs(valX(f!.cx) - caso.esperado.eje_x) <= tol, `${caso.nombre} X`);
      assert.ok(Math.abs(valY(f!.cy) - caso.esperado.eje_y) <= tol, `${caso.nombre} Y`);
    }
  }
});

test('proyector con letra grande: etiquetas de vivos sin solaparse', () => {
  for (const [ancho, alto] of [[930, 930], [1152, 915], [650, 650], [314, 360]]) {
    for (const vista of [1, 2, 'comparacion'] as Vista[]) {
      const L = calcularLayout(mock, { ancho, alto, vista, escalaTexto: 1.3 });
      for (const e of L.etiquetas.filter((x) => x.prioridad)) {
        for (const o of L.etiquetas) if (o !== e) assert.ok(!solapan(e.caja, o.caja), `${e.texto} choca con ${o.texto} a ${ancho}x${alto} vista ${vista}`);
        for (const c of [...L.fijos, ...L.vivos.flatMap((v) => [v.r1, v.r2].filter((b) => b !== null))]) {
          const px = Math.min(e.caja.x + e.caja.w, Math.max(e.caja.x, c.cx));
          const py = Math.min(e.caja.y + e.caja.h, Math.max(e.caja.y, c.cy));
          assert.ok((c.cx - px) ** 2 + (c.cy - py) ** 2 >= c.r * c.r, `${e.texto} tapa una burbuja a ${ancho}x${alto}`);
        }
      }
    }
  }
  assert.ok(calcularLayout(mock, { ancho: 930, escalaTexto: 1.3 }).fs > calcularLayout(mock, { ancho: 930 }).fs);
});

test('animación R1 → R2 solo con animar y en comparación, con movimiento reducido', () => {
  const svg = matrizSVG(mock, { ancho: 900, animar: true });
  assert.equal((svg.match(/class="hz-r2 hz-anim-mov"/g) || []).length, 2);
  assert.ok(svg.includes('prefers-reduced-motion: reduce'));
  assert.ok(/--dx:-?[\d.]+px;--dy:-?[\d.]+px/.test(svg));
  assert.ok(!matrizSVG(mock, { ancho: 900 }).includes('hz-anim'));
  assert.ok(!matrizSVG(mock, { ancho: 900, animar: true, vista: 2 }).includes('hz-anim'));
  assert.ok(svg.includes('style="display:block"'));
});

test('nombres de los fijos sin solaparse entre sí ni con otras etiquetas, con los vivos en cualquier punto', () => {
  // Lienzos reales: 1920×1080 y 1280×720 (proyector, letra ×1,45), 1366×768 y 360 px.
  const lienzos: [number, number, number][] = [[905, 905, 1.45], [655, 600, 1.45], [590, 560, 1.45], [314, 330, 1]];
  const pasos = [0.6, 2, 3.4, 4.8, 6.2, 7.6, 9];
  const fallas: string[] = [];
  let omitidos = 0;
  for (const [ancho, alto, escalaTexto] of lienzos) {
    for (const x of pasos) {
      for (const y of pasos) {
        const datos = structuredClone(mock);
        datos.proyectos_vivos.forEach((p, i) => {
          p.rondas = [
            { ...p.rondas[0], ronda: 1, eje_x: x, eje_y: Math.max(0.3, y - 0.8 - i) },
            { ...p.rondas[1], ronda: 2, eje_x: Math.min(9.2, x + 0.5 * i), eje_y: y },
          ];
        });
        const L = calcularLayout(datos, { ancho, alto, escalaTexto });
        const fijas = L.etiquetas.filter((e) => e.tipo === 'fijo');
        // Solo en móvil se acepta omitir un nombre de fijo (antes que pisar el de un vivo).
        if (ancho > 400 && fijas.length !== L.fijos.length) fallas.push(`${ancho}px (${x},${y}): faltan nombres de fijos`);
        omitidos += L.fijos.length - fijas.length;
        for (const e of fijas) {
          for (const o of L.etiquetas) if (o !== e && solapan(e.caja, o.caja)) fallas.push(`${ancho}px (${x},${y}): ${e.texto} con ${o.texto}`);
          if (e.caja.x < L.x0 || e.caja.x + e.caja.w > L.x0 + L.P || e.caja.y < L.y0 || e.caja.y + e.caja.h > L.y0 + L.P) fallas.push(`${ancho}px: ${e.texto} fuera`);
        }
      }
    }
  }
  assert.deepEqual(fallas.slice(0, 15), [], `${fallas.length} solapes`);
  console.info(`[matriz] nombres de fijos omitidos en 360 px: ${omitidos} de ${pasos.length ** 2 * 8}`);
  // Desde el 19-oct la etiqueta de R1 lleva el nombre del vivo (se lee sin color): ocupa más y en 360 px
  // se omiten unos pocos nombres más de fijos (10 de 392, antes 4).
  assert.ok(omitidos <= 12, `${omitidos} nombres omitidos`);
});

test('colores solo con tokens semánticos (toman el tema de quien aloja la matriz), en reglas CSS limitadas a cada SVG', () => {
  const svg = matrizSVG(mock, { ancho: 800, idPrefijo: 'zz' });
  assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg" id="zz" '));
  const estilo = svg.match(/<style>(.*?)<\/style>/)![1];
  // Toda regla va limitada al SVG por su id: dos matrices en la misma página no se pisan.
  for (const regla of estilo.split('}').filter(Boolean)) assert.ok(regla.startsWith('#zz '), regla);
  // Horizontes en superficies escalonadas: H3 la 1, H2 la 2 y H1 la 3.
  assert.match(estilo, /#zz \.hz-mz-h3\{fill:var\(--hz-superficie-1\)\}/);
  assert.match(estilo, /#zz \.hz-mz-h2\{fill:var\(--hz-superficie-2\);/);
  assert.match(estilo, /#zz \.hz-mz-h1\{fill:var\(--hz-superficie-3\);/);
  assert.match(estilo, /#zz \.hz-mz-texto\{fill:var\(--hz-tinta\)\}/);
  assert.match(estilo, /#zz \.hz-etq\{stroke:var\(--hz-fondo\)\}/);
  // Fijos en gris azulado neutro: ni rondas ni azul de acción.
  assert.match(estilo, /#zz \.hz-fijo\{fill:var\(--hz-tinta-3\);/);
  assert.ok(!/hz-fijo\{fill:var\(--hz-(r1|r2|accion|azul)/.test(estilo));
  // Ningún valor en duro: ni hex ni rgb() en el SVG (todo color pasa por un token).
  assert.ok(!/#[0-9a-f]{3,8}|rgba?\(/i.test(svg.replace(/url\(#[^)]*\)/g, '').replace(/id="[^"]*"/g, '')), 'color en duro');
  // Ningún color fijo claro en atributos: todo pasa por las reglas (y var() no vale en un atributo).
  assert.ok(!/(fill|stroke)="(#|var)/.test(svg), 'color en atributo');
  assert.ok(!/#FFFFFF|#1C4587|#EEF4FB/i.test(svg));
});

// QA-T-01: en el proyector ningún texto de la matriz baja de la letra mínima (marcas, títulos, subtítulos y nombres).
test('letra mínima de proyector: 20 px en 1280×720 y 24 px en 1920×1080, sin solapes', () => {
  for (const [ancho, alto, min] of [[1247, 571, 20], [554, 583, 20], [1879, 889, 24], [875, 903, 24]]) {
    for (const vista of [1, 2, 'comparacion'] as Vista[]) {
      const L = calcularLayout(mock, { ancho, alto, vista, escalaTexto: 1.45, letraMin: min });
      for (const [k, v] of Object.entries(L.letras)) assert.ok(v >= min, `${k} ${v} < ${min} a ${ancho}x${alto}`);
      const svg = matrizSVG(mock, { ancho, alto, vista, escalaTexto: 1.45, letraMin: min });
      const tamanos = [...svg.matchAll(/<text class="(?!hz-mz-texto hz-mz-horizonte)[^"]*"[^>]*font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
      assert.ok(Math.min(...tamanos) >= min, `texto de ${Math.min(...tamanos)} px a ${ancho}x${alto}`);
      L.etiquetas.forEach((a, i) => L.etiquetas.slice(i + 1).forEach((b) => assert.ok(!solapan(a.caja, b.caja), `${a.texto} con ${b.texto} a ${ancho}x${alto}`)));
      assert.equal(L.etiquetas.filter((e) => e.tipo === 'fijo').length, L.fijos.length, `faltan nombres de fijos a ${ancho}x${alto}`);
    }
  }
  // Un lienzo chico limita la letra mínima (no se tapa la matriz de texto).
  assert.ok(calcularLayout(mock, { ancho: 300, alto: 300, letraMin: 24 }).letras.marca < 24);
});

// QA-T-08 y QA-P-06: cada nombre queda pegado a su burbuja o, si quedó apartado, con una guía hasta ella.
test('nombres pegados a su burbuja; los apartados llevan guía', () => {
  for (const [ancho, alto, esc, min] of [[314, 330, 1, 0], [875, 903, 1.45, 24], [1247, 571, 1.45, 20]]) {
    const L = calcularLayout(mock, { ancho, alto, escalaTexto: esc, letraMin: min });
    for (const e of L.etiquetas) {
      if (e.distancia > e.fs * 0.8) assert.ok(e.guia, `${e.texto} a ${Math.round(e.distancia)} px sin guía a ${ancho}px`);
      else assert.equal(e.guia, null);
    }
    // QA por roles (jurado y Nicolai): el nombre de un vivo va pegado a su burbuja, a poco más de una letra como mucho.
    for (const e of L.etiquetas.filter((x) => x.prioridad)) assert.ok(e.distancia <= e.fs * 1.3, `${e.texto} a ${Math.round(e.distancia)} px a ${ancho}px`);
  }
});

test('dos vivos en el mismo punto: un rótulo de dos líneas pegado a la burbuja (se lee que son dos)', () => {
  const datos = structuredClone(mock);
  datos.proyectos_vivos.forEach((v) => {
    v.rondas = [{ ...v.rondas[0], ronda: 1, eje_x: 6.4, eje_y: 6.6 }, { ...v.rondas[1], ronda: 2, eje_x: 7.8, eje_y: 4.4 }];
  });
  for (const [ancho, alto, esc, min] of [[314, 330, 1, 0], [875, 903, 1.45, 24]]) {
    const L = calcularLayout(datos, { ancho, alto, escalaTexto: esc, letraMin: min });
    const pilas = L.etiquetas.filter((e) => e.lineas);
    assert.equal(pilas.length, 2, `${ancho}px`);
    for (const p of pilas) assert.deepEqual(p.lineas!.map((l) => l.nombre).sort(), ['INSUMEX', 'NUTRIWHAT']);
    const svg = matrizSVG(datos, { ancho, alto, escalaTexto: esc, letraMin: min });
    // Cada burbuja conserva su «R1»/«R2» escrito.
    assert.equal((svg.match(/class="hz-etq-ronda"[^>]*>R1</g) || []).length, 2);
    assert.equal((svg.match(/class="hz-etq-ronda"[^>]*>R2</g) || []).length, 2);
  }
});

test('la marca de agua H1, H2 y H3 no queda debajo de ningún nombre', () => {
  const datos = structuredClone(mock);
  datos.proyectos_vivos.forEach((v) => {
    v.rondas = [{ ...v.rondas[0], ronda: 1, eje_x: 6.4, eje_y: 6.6 }, { ...v.rondas[1], ronda: 2, eje_x: 7.8, eje_y: 4.4 }];
  });
  for (const d of [mock, datos]) {
    for (const [ancho, alto, esc, min] of [[314, 330, 1, 0], [875, 903, 1.45, 24], [1247, 571, 1.45, 20]]) {
      const L = calcularLayout(d, { ancho, alto, escalaTexto: esc, letraMin: min });
      for (const m of L.marcasHorizonte) for (const e of L.etiquetas.filter((x) => x.prioridad)) assert.ok(!solapan(m.caja, e.caja), `${m.id} bajo ${e.texto} a ${ancho}px`);
    }
  }
});

test('F-13: descripción y títulos con coma decimal; la animación va limitada al SVG', () => {
  const svg = matrizSVG(mock, { ancho: 900, animar: true, idPrefijo: 'qq' });
  const desc = svg.match(/<desc[^>]*>(.*?)<\/desc>/)![1];
  assert.match(desc, /eje X \d+,\d{2}, eje Y \d+,\d{2}/);
  assert.ok(!/\d\.\d/.test(desc), desc);
  for (const t of svg.matchAll(/<title>([^<]*)<\/title>/g)) assert.ok(!/ [XY] \d+\.\d/.test(t[1]), t[1]);
  const estilo = svg.match(/<style>(.*?)<\/style>/)![1];
  assert.ok(estilo.includes('#qq .hz-anim-mov{animation:qq-mover'));
  assert.ok(estilo.includes('@keyframes qq-mover'));
  assert.ok(!/(^|\})\.hz-anim/.test(estilo), 'regla de animación sin limitar');
  assert.ok(!/@keyframes hz/.test(estilo));
});

test('modo Gráfica: con valores anteriores, las burbujas que cambiaron se deslizan y sus nombres aparecen después', () => {
  const v = mock.proyectos_vivos[0];
  const r2 = v.rondas.find((r) => r.ronda === 2)!;
  const svg = matrizSVG(mock, { ancho: 900, vista: 2, idPrefijo: 'tt', transicion: { valores: { [`${v.id}-2`]: { x: r2.eje_x! - 2, y: r2.eje_y! } } } });
  assert.equal((svg.match(/<circle class="hz-r2 hz-anim-act"/g) || []).length, 1);
  assert.ok(svg.includes('@keyframes tt-desliza'));
  assert.ok(svg.includes('hz-etq hz-etq-vivo hz-mz-texto hz-anim-etq'));
  // Sin cambios de posición, nada se anima.
  assert.ok(!matrizSVG(mock, { ancho: 900, vista: 2, transicion: { valores: { [`${v.id}-2`]: { x: r2.eje_x!, y: r2.eje_y! } } } }).includes('hz-anim'));
});

test('el subtítulo del eje X no se sale del lienzo cuando el plano está corrido a la derecha (Detallado en 1280×720)', () => {
  // Matriz angosta con letra de proyector: el plano empieza después del eje Y y el subtítulo, centrado bajo él, se
  // salía por la derecha («(Capacidades + Recursos + Barreras de Entrada» sin el paréntesis final).
  for (const [ancho, alto] of [[517, 526], [540, 548], [583, 591], [360, 360]]) {
    const svg = matrizSVG(mock, { ancho, alto, escalaTexto: ancho > 400 ? 1.45 : 1, letraMin: ancho > 400 ? 20 : 0, idPrefijo: 'st' });
    const m = svg.match(/<text class="hz-mz-suave hz-mz-subtitulo-eje" x="([\d.]+)" y="[\d.]+" font-size="([\d.]+)" text-anchor="middle">([^<]*)<\/text>/);
    assert.ok(m, 'subtítulo del eje X');
    const [x, fs, texto] = [Number(m[1]), Number(m[2]), m[3]];
    const medio = (texto.length * 0.6 * fs) / 2;
    assert.ok(x - medio >= 0 && x + medio <= ancho, `${ancho}px: subtítulo de ${Math.round(x - medio)} a ${Math.round(x + medio)}`);
  }
});

// ── QA por roles (20-oct): matriz legible a 6 m ──

test('títulos de los ejes sin mayúsculas sostenidas: el texto de la semilla, pintado en forma de título', () => {
  assert.equal(formaTitulo('TIME 2 MARKET'), 'Time 2 Market');
  assert.equal(formaTitulo('VALUE GENERATION CAPACITY'), 'Value Generation Capacity');
  assert.equal(formaTitulo('Distancia del core'), 'Distancia del core');
  assert.equal(formaTitulo(''), '');
  const svg = matrizSVG(mock, { ancho: 1280 });
  const titulos = [...svg.matchAll(/<text class="hz-mz-texto hz-mz-titulo-eje"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  assert.deepEqual(titulos, ['Time 2 Market', 'Value Generation Capacity']);
  assert.ok(!/letter-spacing/.test(svg));
});

test('extremos de los ejes marcados: «cerca» en 0 y «lejos» en 9, entre las marcas y el título', () => {
  for (const [ancho, alto, esc, min] of [[314, 330, 1, 0], [875, 903, 1.45, 24], [1247, 571, 1.45, 20], [420, 300, 1, 0]]) {
    const L = calcularLayout(mock, { ancho, alto, escalaTexto: esc, letraMin: min });
    const svg = matrizSVG(mock, { ancho, alto, escalaTexto: esc, letraMin: min });
    const extremos = [...svg.matchAll(/<text class="hz-mz-suave hz-mz-extremo"([^>]*)>([^<]*)<\/text>/g)];
    assert.deepEqual(extremos.map((m) => m[2]), ['cerca', 'lejos', 'cerca', 'lejos'], `${ancho}px`);
    const [cx, lx] = extremos.slice(0, 2).map((m) => Number(m[1].match(/ x="([\d.]+)"/)![1]));
    assert.ok(Math.abs(cx - L.x0) < 1, 'X: «cerca» empieza en 0');
    assert.ok(lx > L.sx(9) - 1 && lx <= L.x0 + L.P + 0.01, 'X: «lejos» termina en 9');
    const [cy, ly] = extremos.slice(2).map((m) => Number(m[1].match(/translate\([\d.]+ ([\d.]+)\)/)![1]));
    assert.ok(Math.abs(cy - (L.y0 + L.P)) < 1, 'Y: «cerca» empieza en 0');
    assert.ok(ly <= L.sy(9) + 1 && ly >= L.y0 - 0.01, 'Y: «lejos» termina en 9');
    // Fila y columna propias: entre las marcas y el título.
    assert.ok(L.posEjes.extremoX > L.posEjes.marcaX && L.posEjes.extremoX < L.posEjes.tituloX, `${ancho}px fila X`);
    assert.ok(L.posEjes.extremoY < L.posEjes.marcaY && L.posEjes.extremoY > L.posEjes.tituloY, `${ancho}px columna Y`);
    for (const m of extremos) assert.ok(Number(m[1].match(/font-size="([\d.]+)"/)![1]) >= Math.min(min, L.letras.marca), 'letra mínima');
  }
});

test('ninguna guía de un fijo cruza un vivo, con los vivos en cualquier punto', () => {
  const pasos = [0.6, 2, 3.4, 4.8, 6.2, 7.6, 9];
  const fallas: string[] = [];
  let guias = 0;
  for (const [ancho, alto, escalaTexto, letraMin] of [[905, 905, 1.45, 24], [655, 600, 1.45, 20], [314, 330, 1, 0]] as const) {
    for (const x of pasos) {
      for (const y of pasos) {
        const datos = structuredClone(mock);
        datos.proyectos_vivos.forEach((p, i) => {
          p.rondas = [
            { ...p.rondas[0], ronda: 1, eje_x: x, eje_y: Math.max(0.3, y - 0.8 - i) },
            { ...p.rondas[1], ronda: 2, eje_x: Math.min(9.2, x + 0.5 * i), eje_y: y },
          ];
        });
        const L = calcularLayout(datos, { ancho, alto, escalaTexto, letraMin });
        const vivos = L.vivos.flatMap((v) => [v.r1, v.r2].filter((b) => b !== null));
        for (const e of L.etiquetas.filter((x) => x.tipo === 'fijo' && x.guia)) {
          const g = e.guia!;
          guias++;
          for (const c of vivos) {
            const dx = g.x2 - g.x1;
            const dy = g.y2 - g.y1;
            const t = Math.max(0, Math.min(1, ((c.cx - g.x1) * dx + (c.cy - g.y1) * dy) / (dx * dx + dy * dy || 1)));
            if (Math.hypot(c.cx - (g.x1 + t * dx), c.cy - (g.y1 + t * dy)) < c.r) fallas.push(`${ancho}px (${x},${y}): la guía de ${e.texto} cruza un vivo`);
          }
        }
      }
    }
  }
  assert.ok(guias > 0, 'el caso no tiene guías de fijos');
  assert.deepEqual(fallas.slice(0, 10), [], `${fallas.length} guías cruzan un vivo`);
});

test('dos vivos en el mismo punto: se separan unos píxeles y se dibujan los dos aros', () => {
  const datos = structuredClone(mock);
  datos.proyectos_vivos.forEach((v) => {
    v.rondas = [{ ...v.rondas[0], ronda: 1, eje_x: 6.4, eje_y: 6.6 }, { ...v.rondas[1], ronda: 2, eje_x: 7.8, eje_y: 4.4 }];
  });
  for (const [ancho, alto] of [[314, 330], [875, 903]]) {
    const L = calcularLayout(datos, { ancho, alto });
    for (const n of ['r1', 'r2'] as const) {
      const [a, b] = L.vivos.map((v) => v[n]!);
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
      assert.ok(d >= 4 && d <= a.r, `${n} a ${ancho}px separadas ${d} px`);
      assert.ok(a.separada && b.separada);
      // El valor sigue siendo el del servidor.
      assert.deepEqual(a.valor, b.valor);
    }
    const svg = matrizSVG(datos, { ancho, alto });
    const cxs = (clase: string) => [...svg.matchAll(new RegExp(`<circle class="${clase}"[^>]* cx="([\\d.]+)"`, 'g'))].map((m) => m[1]);
    assert.equal(new Set(cxs('hz-r1')).size, 2, 'dos aros R1');
    assert.equal(new Set(cxs('hz-r2')).size, 2, 'dos burbujas R2');
  }
});

test('flecha R1 → R2 visible aunque el movimiento sea pequeño: largo mínimo y punta grande con halo', () => {
  const datos = structuredClone(mock);
  datos.proyectos_vivos.forEach((v, i) => {
    v.rondas = [{ ...v.rondas[0], ronda: 1, eje_x: 2 + i * 4, eje_y: 5 }, { ...v.rondas[1], ronda: 2, eje_x: 2.08 + i * 4, eje_y: 5.05 }];
  });
  for (const [ancho, alto] of [[314, 330], [1247, 571]]) {
    const L = calcularLayout(datos, { ancho, alto });
    for (const v of L.vivos) {
      assert.ok(v.flecha, `${v.nombre} sin flecha a ${ancho}px`);
      const largo = Math.hypot(v.flecha!.x2 - v.flecha!.x1, v.flecha!.y2 - v.flecha!.y1);
      assert.ok(largo >= L.punta * 1.79, `${v.nombre}: flecha de ${largo} px`);
      // Apunta hacia R2.
      assert.ok(Math.abs(v.flecha!.x2 - v.r2!.cx) < 0.01 && Math.abs(v.flecha!.y2 - v.r2!.cy) < 0.01);
    }
    assert.ok(L.punta >= Math.max(8, L.fs * 0.75) - 1e-9);
    const svg = matrizSVG(datos, { ancho, alto, idPrefijo: 'fl' });
    assert.match(svg, /<path class="hz-mz-punta" [^>]*stroke-width="2"[^>]*paint-order="stroke"/);
    assert.equal((svg.match(/class="hz-flecha"/g) || []).length, 2);
  }
  // Sin movimiento, sin flecha.
  const quieto = structuredClone(mock);
  quieto.proyectos_vivos.forEach((v) => (v.rondas[1] = { ...v.rondas[1], eje_x: v.rondas[0].eje_x, eje_y: v.rondas[0].eje_y }));
  assert.equal(calcularLayout(quieto, { ancho: 800 }).vivos.filter((v) => v.flecha).length, 0);
});

test('animación R1 → R2 de 2,5 s: R1 quieto 0,6 s, 1,5 s de movimiento y la flecha y los nombres al final', () => {
  assert.deepEqual(ANIMACION, { pausa: 600, mover: 1500, aparecer: 2000, total: 2500 });
  const svg = matrizSVG(mock, { ancho: 900, animar: true, idPrefijo: 'an' });
  assert.ok(svg.includes('#an .hz-anim-mov{animation:an-mover 1500ms cubic-bezier(.45,0,.25,1) 600ms both}'));
  assert.ok(svg.includes('#an .hz-anim-apar{animation:an-aparecer 500ms ease-out 2000ms both}'));
});

test('cada mesa por separado (compacta): fijos como puntos sin nombre y ejes sin subtítulo', () => {
  const L = calcularLayout(mock, { ancho: 600, alto: 420, compacta: true });
  assert.equal(L.etiquetas.filter((e) => e.tipo === 'fijo').length, 0);
  assert.equal(L.etiquetas.filter((e) => e.prioridad).length, 4);
  const svg = matrizSVG(mock, { ancho: 600, alto: 420, compacta: true });
  assert.equal((svg.match(/class="hz-fijo"/g) || []).length, mock.proyectos_fijos.length);
  assert.ok(!svg.includes('hz-mz-subtitulo-eje'));
  assert.ok(svg.includes('hz-mz-titulo-eje'));
  // Sin subtítulos el plano gana alto.
  assert.ok(L.P > calcularLayout(mock, { ancho: 600, alto: 420 }).P);
});

test('fondo para la descarga: un rectángulo del lienzo con el color de fondo del tema', () => {
  const svg = matrizSVG(mock, { ancho: 800, fondo: true, idPrefijo: 'fd' });
  assert.ok(svg.includes('<rect class="hz-mz-fondo" x="0" y="0" width="800" height="800"/>'));
  assert.ok(svg.includes('#fd .hz-mz-fondo{fill:var(--hz-fondo)}'));
  assert.ok(!matrizSVG(mock, { ancho: 800 }).includes('<rect class="hz-mz-fondo"'));
});
