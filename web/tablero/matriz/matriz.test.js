// Pruebas de la matriz con node:test. Correr: node --test web/tablero/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularLayout, matrizSVG, radioPorTam } from './matriz.js';

const mock = JSON.parse(readFileSync(new URL('../../../mocks/GET_api_tablero.json', import.meta.url), 'utf8'));
const ANCHOS = [360, 412, 768, 1280, 1920];

const solapan = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

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
  for (const p of mock.proyectos_vivos) assert.ok(svg.includes(`>${p.nombre}</text>`), p.nombre);
  assert.equal((svg.match(/class="hz-r1"/g) || []).length, 2);
  assert.equal((svg.match(/class="hz-r2"/g) || []).length, 2);
  assert.equal((svg.match(/class="hz-flecha"/g) || []).length, 2);
  assert.ok(svg.includes(mock.ejes.x.titulo));
  assert.ok(svg.includes(mock.ejes.y.subtitulo));
  for (const h of ['H1', 'H2', 'H3']) assert.ok(svg.includes(`>${h}</text>`));
});

test('posiciones respetan la escala 0 a 9,5', () => {
  const L = calcularLayout(mock, { ancho: 1000 });
  const yummi = L.fijos.find((f) => f.id === 'yummi');
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
      const circulos = [...L.fijos, ...L.vivos.flatMap((v) => [v.r1, v.r2])];
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
    const r2 = v.rondas.find((r) => r.ronda === 2);
    Object.assign(r2, { n_votos: 0, t2m: null, eje_x: null, eje_y: null });
  }
  const svg = matrizSVG(datos, { ancho: 800 });
  assert.equal((svg.match(/class="hz-r2"/g) || []).length, 0);
  assert.equal((svg.match(/class="hz-flecha"/g) || []).length, 0);
  assert.equal((svg.match(/class="hz-r1"/g) || []).length, 2);
  assert.ok(svg.includes('>INSUMEX</text>'));
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
