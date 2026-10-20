# Tablero

Ruta: `/tablero/:sala?mesa=&t=&modo=`. Con `t` (token de tablero) aparece el selector de alcance; sin `mesa`, el alcance es la sala.

**Modos de proyección** (parámetro `modo` de la URL, para que el panel enlace a cada uno):
- **Gráfica**, `modo=grafica` (por defecto): solo la matriz, a todo el ancho y el alto bajo la barra (marca, sala, votos recibidos y la insignia de la ronda). Con cada foto nueva de votos (D2, de 3 en 3) las burbujas se deslizan.
- **Detallado**, `modo=detallado`: la matriz y, al lado, el progreso y los promedios por criterio con su descripción corta (`web/shared/criterios.ts`) o «Cómo votó» (tecla V).
- Los valores anteriores siguen sirviendo para los enlaces ya compartidos: `modo=vivo` abre Gráfica y `modo=tabla` abre Detallado.

Selector «Gráfica | Detallado» en la barra (no aparece en Todas las mesas, donde no cambia nada); teclas G, D y M (alterna). La insignia «En vivo, cada 3 votos» no es un modo: es el estado de la ronda abierta y va junto a los votos recibidos, sin borde ni color de acción. F o el botón «Pantalla completa» (en Detallado, «Pantalla completa con detalle») ponen el modo elegido en la pantalla completa del navegador, sin los controles. Sin zoom por porcentaje.

**Apariencia**: la misma de toda la app (decisión de Paola del 20-oct). Fondo claro, con `data-tema="claro"` en el `<main>` y `useTemaDocumento('claro')`, y arriba la barra carbón de la familia Estratek (`EncabezadoProducto` dentro de `.hz-cab`, con `data-tema="carbon"` solo ahí): logo de Horizontes, «por Estratek »» y la línea del degradado de borde a borde; a la derecha, la sala y los controles. Con la ronda abierta, la franja «Ronda N · …» dice la ronda y la barra no la repite. Solo tokens semánticos `--hz-*` de `web/shared/ui/tokens.css`, sin colores en duro; el azul es solo para controles. Las clases propias que coincidían con las del sistema de diseño llevan el prefijo `hz-tb-` (insignia, progreso, cifra, barra y rúbrica).

| Archivo | Qué hace |
|---|---|
| `PaginaTablero.tsx` | Página del proyector: barra, modo Gráfica (solo la matriz) o Detallado (progreso y detalle por criterio) |
| `ExplicacionBreve.tsx` | Qué significa cada eje, en una línea al pie de Gráfica (solo si cabe entera) |
| `PreguntaGuiada.tsx` | Modo guiado: la pregunta del facilitador en grande, en lugar de la matriz |
| `MatrizHorizontes.tsx` | Matriz embebible (solo props, sin fetch) |
| `matriz/matriz.js` | Dibujo SVG puro, sin dependencias (`matrizSVG`, `calcularLayout`) |
| `TablaComparada.tsx` · `PanelProyecto.tsx` | Promedios R1 y R2 por criterio con su descripción corta, sin fila «Total» ni de votos (proyector · móvil) |
| `ComoVoto.tsx` | «Cómo votó la sala»: conteo 1-3-5-7-9 por criterio, R1 y R2, con la `distribucion` del servidor, en una sola escala para todo el bloque. Lo usa también el panel (Sala en vivo) |
| `Progreso.tsx` | Inscritos, completos, mesas y avisos de precierre |
| `usePollingTablero.ts` · `logica.ts` | Polling 2,5 s con ETag y reglas de presentación |
| `usePantallaCompleta.ts` | Teclas: F (pantalla completa del modo elegido), 1, 2 y C (vistas), G, D, M y Esc (Gráfica o Detallado; Esc pasa a Detallado y, en pantalla completa, solo sale), V (Promedios o «Cómo votó»). Una tecla sostenida no repite el atajo |

## `MatrizHorizontes` para otras pantallas

API estable desde R2 (prueba de contrato en `MatrizHorizontes.test.tsx`). No necesita importar CSS del tablero: el SVG trae sus estilos.

```tsx
import { MatrizHorizontes, insigniaResultado, mensajeVacio, vistaPorDefecto } from '../tablero'
import type { Tablero } from '../shared/api/contrato'   // DatosTablero es el mismo tipo

// `resultados` es `yo.resultados` o la respuesta de GET /api/resultados (misma forma que GET /api/tablero).
function Resultado({ resultados }: { resultados: Tablero }) {
  const vista = vistaPorDefecto(resultados.sala.estado, resultados.sala.ronda_actual)
  const vacio = mensajeVacio(resultados, vista)
  return (
    <section>
      {insigniaResultado(resultados) === 'preliminar' && <p>Resultado preliminar</p>}
      {vacio && <p role="status">{vacio}</p>}
      <MatrizHorizontes datos={resultados} vista={vista} />
    </section>
  )
}
```

Ayudas exportadas (`web/tablero/index.ts`):
- `vistaPorDefecto(estado, ronda_actual)`: Ronda 1, Ronda 2 o Comparación según la sala.
- `mensajeVacio(datos, vista)`: texto del estado vacío o `null`.
- `insigniaResultado(datos)`: `'preliminar'` (alcance en precierre con la ronda abierta), `'en_vivo'` (ronda abierta) o `null`. Ojo: la API manda `preliminar: true` en toda ronda abierta; para el aviso "Todos votaron" usa esta función o `esPreliminar`.

| Prop | Tipo | Por defecto | Uso |
|---|---|---|---|
| `datos` | `DatosTablero \| null` | | Respuesta del servidor tal cual. Con `null` dibuja ejes y horizontes vacíos |
| `vista` | `1 \| 2 \| 'comparacion'` | `'comparacion'` | Una ronda en sólido, o R1 suave + R2 sólido + flecha |
| `alto` | `number` | cuadrado del ancho (mín. 320 px) | Alto fijo en px |
| `llenar` | `boolean` | `false` | Usa el alto que le dé el CSS del contenedor (el contenedor debe tener alto definido) |
| `escalaTexto` | `number` | `1` | Multiplica la letra de la matriz (proyector: 1,45) |
| `letraMin` | `number` | | Proyector: px del texto más chico (20 en 1280, 24 en 1920). Con un lienzo chico se limita a un 26avo de su lado |
| `animarComparacion` | `boolean` | `true` | Al pasar a `'comparacion'`, R2 sale desde R1 (respeta `prefers-reduced-motion`) |
| `animarCambios` | `boolean` | `false` | Modo Gráfica del tablero: con datos nuevos, las burbujas que cambiaron se deslizan desde su posición anterior |
| `className` | `string` | | Clase extra del contenedor |

Reglas:
- El componente no pide datos ni recalcula el motor: dibuja `eje_x`, `eje_y` y `tam` del servidor.
- Colores solo con tokens: toma el tema de quien lo aloja (hoy el claro en el tablero, el celular y el panel). H3, H2 y H1 en las superficies 1, 2 y 3; borde de los horizontes en el borde de control neutro (el verde agua se confundía con R1); fijos en `--hz-tinta-3` (gris azulado neutro).
- Se redibuja al cambiar el tamaño del contenedor; si los datos no cambian, no toca el DOM (sin parpadeo con el polling).
- Las rondas sin votos (`eje_x` null) no se dibujan. Para el texto del estado vacío usa `mensajeVacio(datos, vista)` de `logica.ts`.
- Nombres pegados a su burbuja: se busca la caja libre más cercana; si quedó apartada, una guía fina la une a su burbuja. Dos vivos en el mismo punto y ronda llevan un rótulo de dos líneas. La marca de agua H1, H2 y H3 se corre dentro de su horizonte si un nombre cae encima.

## Pruebas

`npx vitest run web/tablero` (también corren en `tools/test.sh`). Incluyen la prueba de aceptación: el punto dibujado coincide con `tests/golden/motor_golden.json` (prueba sintética y fijos, tolerancia 0,001) en 360, 1366 y 1920 px, en Node (`matriz.test.ts`) y en Chromium real contra la API real (`e2e/navegador.test.ts`, ver `e2e/README.md`).
