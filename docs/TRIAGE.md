# TRIAGE · QA del sistema integrado

Dueña: T4. Se actualiza en cada pasada de QA. Cada terminal corrige lo suyo y, si quiere, anota el commit en su bitácora; T4 cambia el estado en la siguiente pasada.

**Cómo se hace la pasada:** rama temporal `qa-integrada` (worktree aparte, nunca se publica) = `t4-admin` + puntas de `t1-backend`, `t3-tablero` y `t2-participante`; `tools/test.sh`; imagen de producción con `tools/deploy.sh local` (:3999); simulador de T1 de 40 personas corriendo dentro del contenedor al mismo tiempo; recorrido en navegador real a 360 px y 1920 px con `QA-tests/recorrido_integrado.cjs` (admin crea la sala, un participante se inscribe y vota por la UI las 2 rondas, otros votan por API, tablero en cada momento, todas las pantallas del panel) y revisión visual de las ~70 capturas.

Severidad: **alta** = rompe una regla del SPEC o impide usar la pantalla en el taller · **media** = se ve mal o confunde, pero se puede usar · **baja** = pulido.
Estado: `abierto` · `corregido` (verificado en una pasada) · `en rama` (corregido, falta verificarlo integrado) · `no aplica` (con razón).

## Pasada 1 · 16-oct 12:30 (hora de la máquina)
Puntas: t1 `7965f26`, t2 `262a692`, t3 `ee79b7d`, t4 `a13165d`. Merge sin conflictos de código (solo `docs/DECISIONES.md`, resuelto uniendo ambas versiones en la rama temporal).
- `tools/test.sh` integrado: **verde, 333 pruebas** (20 archivos, incluye e2e en navegador de T2 y T3).
- Simulador (40 personas, 4 mesas, 2 rondas) dentro del contenedor, en paralelo con el recorrido: **0 errores HTTP, 0 verificaciones con falla, p95 296 ms. SIMULACIÓN OK.**
- Recorrido completo a 360 y 1920 px: inscripción con consentimiento, perfil, caso, hoja, R1, voto registrado, precierre con resultado preliminar, R1 cerrada, R2 con las 6 hojas, comparación R1→R2, sala cerrada, "El taller terminó". Puntos del tablero iguales en los dos anchos. Sin rayas en ningún texto. Sin nombres ni respuestas individuales en resultados (salvo el caso de la mesa de 1 persona, ver #1).

| # | Sev. | Pantalla | Qué pasa y cómo reproducir | Dueña | Estado |
|---|---|---|---|---|---|
| 1 | alta | Tablero `?vista=mesas`, alcance mesa (tablero y celular) | Una mesa con **1 inscrito** muestra su matriz y promedios: son las respuestas individuales de esa persona (SPEC §7: nunca respuestas individuales). Reproducir: mesa con una sola persona que vota, abrir el tablero de esa mesa. Propuesta: el servidor no entrega promedios de un alcance con `n_votos < 2` (o los entrega con una marca) y el tablero y el celular muestran "Hace falta al menos 2 votos para mostrar esta mesa". En el taller real las mesas son de 5 a 8, por eso no bloquea. | T1 (regla) · T3 y T2 (aviso) | abierto |
| 2 | alta | Panel · Participantes a 360 px | Las tablas "Perfiles por mesa" e "Inscritos" se cortan a la derecha: no se ven Mesa, Perfil, estado ni el botón Desactivar. | T4 | corregido |
| 3 | alta | Panel · Sala en vivo a 360 px | La tabla de mesas se corta: no se ven Estado ni los enlaces al tablero de cada mesa. | T4 | corregido |
| 4 | media | Panel · Sala en vivo con la sala cerrada o ronda cerrada | Cada mesa sigue diciendo "Votando" y la tarjeta dice "Ronda en curso 2". | T4 | corregido |
| 5 | media | Tablero a 360 px, estado sin votos | La tabla de criterios desborda 3 px: la columna "Votos R1" y el "9" del histograma se salen de la tarjeta. | T3 | abierto |
| 6 | media | Tablero y matriz del celular, comparación | Si INSUMEX y NUTRIWHAT caen en el mismo punto (Mesa 2 del recorrido), la burbuja de INSUMEX queda oculta debajo de NUTRIWHAT y las etiquetas se pegan ("TRUCKPOOLINSUMEX"); los dos "R1" se superponen. | T3 | abierto (los dos "R1" ya no se pisan) |
| 7 | media | Tablero y matriz del celular, comparación | El fantasma R1 de INSUMEX queda debajo de la burbuja R2 de NUTRIWHAT; la etiqueta naranja "R1" parece de NUTRIWHAT y la flecha de INSUMEX nace escondida. Cuesta leer el movimiento. | T3 | abierto (la etiqueta R1 ya sale junto a su fantasma) |
| 8 | media | Tablero · `?vista=mesas` a 1920 px | Con 2 mesas, dos tarjetas pequeñas ocupan 2/3 del ancho y media pantalla queda vacía; textos de ejes de ~12 px, ilegibles a 6 m. | T3 | corregido |
| 9 | media | Tablero proyector 1920 px | Escala del histograma (1 3 5 7 9) y "TAM 5/6" de ~11 px. En Ronda 1 la columna R2 repite "Sin votos" en 9 filas: ruido. | T3 | abierto (en parte: R2 ya no se muestra en ronda 1; escala del histograma y TAM siguen de ~11 px) |
| 10 | media | Celular · resultado (preliminar, cerrada, comparación) | Jerarquía tipográfica rota: "TIME 2 MARKET 6,69 · VALUE GENERATION CAPACITY 6,6" ocupa 4 líneas en tamaño de título a 360 px; el pie "3 calificaciones en la ronda 1..." y los encabezados "Promedio / R1 R2" van más grandes que los datos. | T2 | corregido (lo que queda va en #11) |
| 11 | media | Celular vs tablero | Nombres y decimales distintos para lo mismo: el celular llama "TIME 2 MARKET" al eje X (6,69) mientras el tablero tiene una fila T2M (5,60) y otra "Eje X" (6,69); el celular muestra 1 decimal en unos valores y 2 en otros, el tablero siempre 2. Acordar: "Eje X (Time 2 Market)" y 2 decimales en ambos. | T2 y T3 | abierto |
| 12 | baja | Tablero a 360 px, R1 en precierre | La etiqueta INSUMEX se monta sobre YUMMI y la burbuja tapa el texto. | T3 | abierto |
| 13 | baja | Tablero, leyenda | La leyenda dice "Ronda 1" con un punto azul oscuro, pero las burbujas vivas son naranja y cielo. | T3 | abierto |
| 14 | baja | Tablero sin `?t=` | Reintenta cada 2,5 s aunque la respuesta sea 401 (7 errores en consola en 3 s). Ante 401/403 podría dejar de consultar. El texto "con su token" es jerga: "Pide al facilitador el enlace completo del tablero". | T3 | abierto |
| 15 | baja | Celular · Ronda 2 cerrada | El aviso "Calificación de NUTRIWHAT guardada." sigue visible en la pantalla de ronda cerrada. | T2 | corregido |
| 16 | baja | Celular · calificar en R2 | Con las 6 hojas abiertas, el enlace sigue diciendo "Ver tu hoja de este proyecto". | T2 | abierto |
| 17 | baja | Celular y login del panel | Margen blanco de 8 px alrededor (margen por defecto del `body`): la cabecera y los fondos no llegan al borde. | T2 (`web/shared/ui`) | abierto |
| 18 | baja | Panel · menú | "Export" en inglés. | T4 | corregido |
| 19 | baja | Panel · botones deshabilitados | Se parecen a los secundarios activos (solo cambia un tono de bajo contraste). | T4 | corregido |
| 20 | baja | Panel · Configuración con R2 cerrada o sala cerrada | "Cerrar la ronda abierta el" y "Programar" siguen activos aunque no quedan rondas. | T4 | corregido |
| 21 | baja | Panel a 360 px | El menú ocupa 4 filas (~255 px) en cada pantalla. | T4 | corregido (ver #24) |
| 22 | — | Matriz (todas) | Títulos de ejes en inglés ("TIME 2 MARKET", "VALUE GENERATION CAPACITY"). | Semilla | no aplica: decisión de Paola (DECISIONES, supuestos aceptados) y así está en el deck |

| 23 | media | Celular · tabla R1/R2 del resultado a 360 px | La columna de criterio queda angosta: "Nivel de Conocimiento del Cliente/Mercado" ocupa 4 líneas mientras R1 y R2 sobran. | T2 | abierto |
| 24 | baja | Panel a 360 px | El menú en una fila corta la última pestaña sin pista de que se desliza; los correos se partían a mitad de palabra en Participantes. | T4 | en rama |
| 25 | baja | Celular a 1920 px · comparación | La matriz del resultado se ve pequeña (etiquetas de ~9 px) en una columna de ~540 px; la cabecera ocupa todo el ancho. Es la vista del celular abierta en escritorio, no el proyector. | T2 | abierto |

## Pasada 2 · 16-oct 13:05
Puntas: t1 `7558574`, t2 `3ba7898`, t3 `2ce0b95`, t4 `f3d37a1`+. Solo conflicto en `docs/DECISIONES.md` (resuelto uniendo en la rama temporal).
- `tools/test.sh` integrado: **verde, 369 pruebas** (1 omitida), 25 archivos.
- Simulador de 40 personas dentro del contenedor, en paralelo con el recorrido: **0 errores, p95 457 ms. SIMULACIÓN OK.**
- Recorrido completo a 360 y 1920 px otra vez en verde, más la hoja de QR exportada a PDF: 4 mesas en 1 A4, 6 mesas en 2 (antes salía una página en blanco al final: corregido).
- Estados de la tabla actualizados arriba; nuevos #23 a #25.

Revisado y descartado: la hora de la bitácora del panel ("5:37 a. m.") es correcta, el panel muestra hora de Bogotá y la máquina de QA está en hora de Europa.
