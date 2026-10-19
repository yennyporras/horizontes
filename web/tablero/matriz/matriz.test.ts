// Pruebas de la matriz (Vitest). Correr: npx vitest run web/tablero
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularLayout, matrizSVG, radioPorTam, type Caja } from './matriz.js';
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
    assert.ok(svg.includes(`>${p.nombre} <tspan class="hz-etq-ronda" style="fill:var(--hz-r2, #F25C5C)">R2</tspan></text>`), `${p.nombre} R2`);
    assert.ok(svg.includes(`>${p.nombre} <tspan class="hz-etq-ronda" style="fill:var(--hz-r1, #3FB25A)">R1</tspan></text>`), `${p.nombre} R1`);
  }
  assert.equal((svg.match(/class="hz-r1"/g) || []).length, 2);
  assert.equal((svg.match(/class="hz-r2"/g) || []).length, 2);
  assert.equal((svg.match(/class="hz-flecha"/g) || []).length, 2);
  assert.ok(svg.includes(mock.ejes.x.titulo));
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
  assert.ok(svg.includes('>INSUMEX <tspan class="hz-etq-ronda" style="fill:var(--hz-r1, #3FB25A)">R1</tspan>'));
});

test('ronda por color y forma: R1 hueco verde, R2 sólido rojo; los fijos sin verde ni rojo', () => {
  const svg = matrizSVG(mock, { ancho: 1280 });
  const r1 = svg.match(/<circle class="hz-r1"[^>]*>/g)!;
  const r2 = svg.match(/<circle class="hz-r2"[^>]*>/g)!;
  for (const c of r1) assert.match(c, /style="fill:var\(--hz-r1, #3FB25A\);fill-opacity:0\.14;stroke:var\(--hz-r1, #3FB25A\)"/);
  for (const c of r2) assert.match(c, /style="fill:var\(--hz-r2, #F25C5C\)"/);
  const fijos = svg.match(/<circle class="hz-fijo"[^>]*>/g)!;
  for (const c of fijos) assert.ok(!/hz-r1|hz-r2|3FB25A|F25C5C/i.test(c));
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
  // Desde R4 la etiqueta de R1 lleva el nombre del vivo (se lee sin color): ocupa más y en 360 px
  // se omiten unos pocos nombres más de fijos (10 de 392, antes 4).
  assert.ok(omitidos <= 12, `${omitidos} nombres omitidos`);
});

test('colores con los tokens del lienzo oscuro, en reglas CSS limitadas a cada SVG', () => {
  const svg = matrizSVG(mock, { ancho: 800, idPrefijo: 'zz' });
  assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg" id="zz" '));
  const estilo = svg.match(/<style>(.*?)<\/style>/)![1];
  // Toda regla va limitada al SVG por su id: dos matrices en la misma página no se pisan.
  for (const regla of estilo.split('}').filter(Boolean)) assert.ok(regla.startsWith('#zz '), regla);
  assert.match(estilo, /#zz \.hz-mz-h3\{fill:var\(--hz-superficie-1, #131313\)\}/);
  assert.match(estilo, /#zz \.hz-mz-texto\{fill:var\(--hz-tinta, #EDF2EE\)\}/);
  assert.match(estilo, /#zz \.hz-etq\{stroke:var\(--hz-fondo, #0E0E0E\)\}/);
  // Ningún color fijo claro en atributos: todo pasa por las reglas (y var() no vale en un atributo).
  assert.ok(!/(fill|stroke)="(#|var)/.test(svg), 'color en atributo');
  assert.ok(!/#FFFFFF|#1C4587|#EEF4FB/i.test(svg));
});
