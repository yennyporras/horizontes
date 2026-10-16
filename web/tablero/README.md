# Tablero (T3)

Ruta: `/tablero/:sala?mesa=&t=`. Con `t` (token de tablero) aparece el selector de alcance; sin `mesa`, el alcance es la sala.

| Archivo | Qué hace |
|---|---|
| `PaginaTablero.tsx` | Página del proyector: encabezado, matriz, progreso y detalle por criterio |
| `MatrizHorizontes.tsx` | Matriz embebible (solo props, sin fetch) |
| `matriz/matriz.js` | Dibujo SVG puro, sin dependencias (`matrizSVG`, `calcularLayout`) |
| `TablaComparada.tsx` · `PanelProyecto.tsx` | Promedios R1 y R2 y distribución 1-3-5-7-9 (proyector · móvil) |
| `Progreso.tsx` | Inscritos, completos, mesas y avisos de precierre |
| `usePollingTablero.ts` · `logica.ts` | Polling 2,5 s con ETag y reglas de presentación |
| `usePantallaCompleta.ts` | Tecla F (pantalla completa sin controles), 1, 2 y C (vistas) |

## `MatrizHorizontes` para otras pantallas

```tsx
import { MatrizHorizontes } from '../tablero'

// `resultados` es la respuesta de GET /api/resultados (misma forma que GET /api/tablero).
<MatrizHorizontes datos={resultados} vista="comparacion" />
```

| Prop | Tipo | Por defecto | Uso |
|---|---|---|---|
| `datos` | `DatosTablero \| null` | | Respuesta del servidor tal cual. Con `null` dibuja ejes y horizontes vacíos |
| `vista` | `1 \| 2 \| 'comparacion'` | `'comparacion'` | Una ronda en sólido, o R1 suave + R2 sólido + flecha |
| `alto` | `number` | cuadrado del ancho (mín. 320 px) | Alto fijo en px |
| `llenar` | `boolean` | `false` | Usa el alto que le dé el CSS del contenedor (el contenedor debe tener alto definido) |
| `escalaTexto` | `number` | `1` | Multiplica la letra de la matriz (proyector: 1,3) |
| `animarComparacion` | `boolean` | `true` | Al pasar a `'comparacion'`, R2 sale desde R1 (respeta `prefers-reduced-motion`) |
| `className` | `string` | | Clase extra del contenedor |

Reglas:
- El componente no pide datos ni recalcula el motor: dibuja `eje_x`, `eje_y` y `tam` del servidor.
- Se redibuja al cambiar el tamaño del contenedor; si los datos no cambian, no toca el DOM (sin parpadeo con el polling).
- Las rondas sin votos (`eje_x` null) no se dibujan. Para el texto del estado vacío usa `mensajeVacio(datos, vista)` de `logica.ts`.

## Pruebas

`npx vitest run web/tablero` (también corren en `tools/test.sh`). Incluyen la prueba de aceptación: el punto dibujado coincide con `tests/golden/motor_golden.json` (prueba sintética y fijos, tolerancia 0,001) en 360, 1366 y 1920 px.
