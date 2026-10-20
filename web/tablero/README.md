# Tablero

Ruta: `/tablero/:sala?mesa=&t=`. Con `t` (token de tablero) aparece el selector de alcance; sin `mesa`, el alcance es la sala.

Tema **carbón** de la familia Estratek (`docs/marca/FAMILIA_ESTRATEK.md` §3): `data-tema="carbon"` en el `<main>` del tablero y solo tokens semánticos `--hz-*` de `web/shared/ui/tokens.css`, sin colores en duro. Encabezado: nombre de la sala, firma «Horizontes por Estratek »» (la » en el azul de acción) y la línea del degradado de marca de borde a borde.

| Archivo | Qué hace |
|---|---|
| `PaginaTablero.tsx` | Página del proyector: encabezado y matriz sola por defecto; con datos (clic, M), progreso y detalle por criterio |
| `zoom.ts` · `ControlesZoom.tsx` | Zoom vectorial de la matriz (viewBox): botones, teclas, rueda, pellizco y arrastre |
| `ExplicacionMatriz.tsx` | Qué significa cada eje y cada punto, bajo la matriz (sin pesos) |
| `PreguntaGuiada.tsx` | Modo guiado: la pregunta del facilitador en grande, en lugar de la matriz |
| `MatrizHorizontes.tsx` | Matriz embebible (solo props, sin fetch) |
| `matriz/matriz.js` | Dibujo SVG puro, sin dependencias (`matrizSVG`, `calcularLayout`) |
| `TablaComparada.tsx` · `PanelProyecto.tsx` | Promedios R1 y R2 por criterio, sin fila «Total» ni de votos (proyector · móvil) |
| `ComoVoto.tsx` | «Cómo votó la sala»: conteo 1-3-5-7-9 por criterio, R1 y R2, con la `distribucion` del servidor. Lo usa también el panel (Sala en vivo) |
| `Progreso.tsx` | Inscritos, completos, mesas y avisos de precierre |
| `usePollingTablero.ts` · `logica.ts` | Polling 2,5 s con ETag y reglas de presentación |
| `usePantallaCompleta.ts` | Teclas: F (pantalla completa sin controles), 1, 2 y C (vistas), M y Esc (matriz sola o datos), D (Promedios o Cómo votó), +, −, 0 y flechas (zoom) |

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
| `escalaTexto` | `number` | `1` | Multiplica la letra de la matriz (proyector: 1,3) |
| `animarComparacion` | `boolean` | `true` | Al pasar a `'comparacion'`, R2 sale desde R1 (respeta `prefers-reduced-motion`) |
| `encuadre` | `{ k, cx, cy }` | | Zoom: aumento y centro en fracción del lienzo. Solo cambia el `viewBox` del SVG |
| `className` | `string` | | Clase extra del contenedor |

Reglas:
- El componente no pide datos ni recalcula el motor: dibuja `eje_x`, `eje_y` y `tam` del servidor.
- Colores solo con tokens: toma el tema de quien lo aloja (carbón en el tablero, claro en el celular y el panel). H3, H2 y H1 en las superficies 1, 2 y 3; borde de los horizontes en el acento de Horizontes; fijos en `--hz-tinta-3` (gris azulado neutro).
- Se redibuja al cambiar el tamaño del contenedor; si los datos no cambian, no toca el DOM (sin parpadeo con el polling).
- Las rondas sin votos (`eje_x` null) no se dibujan. Para el texto del estado vacío usa `mensajeVacio(datos, vista)` de `logica.ts`.

## Pruebas

`npx vitest run web/tablero` (también corren en `tools/test.sh`). Incluyen la prueba de aceptación: el punto dibujado coincide con `tests/golden/motor_golden.json` (prueba sintética y fijos, tolerancia 0,001) en 360, 1366 y 1920 px, en Node (`matriz.test.ts`) y en Chromium real contra la API real (`e2e/navegador.test.ts`, ver `e2e/README.md`).
