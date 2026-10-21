# Sistema de diseño · Horizontes

**La ley de diseño es `docs/marca/FAMILIA_ESTRATEK.md`** (línea gráfica de la familia Estratek, aprobada por Paola el 19-oct). Este documento la aplica a Horizontes: qué token usa cada pieza, cuánto contraste da y cómo se ven los componentes. Si algo choca con FAMILIA_ESTRATEK, manda FAMILIA_ESTRATEK.
Valores en código: `web/shared/ui/tokens.css`. Si este documento y el CSS no coinciden, manda el CSS y se corrige este documento en la misma ronda. Fuera de `tokens.css` no hay colores en duro.
Muestra viva en desarrollo: `/m/_ui` (todos los componentes base, en el claro con la barra carbón).

**20-oct, decisión de Paola: una sola apariencia.** Landing, celular, tablero y panel usan el tema claro con la barra superior carbón y la línea del degradado. El carbón ya no es el tema de la landing ni del proyector (§2.1). Lo reemplazado queda tachado con su fecha.

## 1. Idea de diseño

**Sujeto.** Un taller presencial: 30 a 40 personas en mesas, con el celular en la mano, leyendo un caso y calificando dos proyectos mientras discuten. El celular es una herramienta de trabajo de mesa. El tablero se proyecta y se lee a 6 m.

**Familia Estratek.** Horizontes es una herramienta respaldada: nombre, glifo «H» y acento propios (verde agua `#00CDA1`), y la firma «por Estratek »». Todo lo demás es común a la familia: paleta núcleo, Montserrat, retícula de 8 px, radios, componentes, foco y el azul Estratek como único color de acción.

**Lo memorable: el horizonte.** La matriz dibuja los horizontes como cuartos de círculo. Cada opción de la rúbrica lleva un **arco de horizonte** cuyo radio crece con el valor (1 pegado a la esquina, 9 amplio); el elegido se llena con el color de acción. En la landing, los pasos de «Cómo funciona» llevan un horizonte que crece paso a paso y las viñetas son cuartos de círculo en el acento de Horizontes; las etiquetas H1, H2 y H3 de la matriz van en el borde de control (el verde agua se confunde con R1).

**Sobrio.** El degradado de marca solo como línea (bajo el encabezado de producto, sobre el pie), borde, barra de progreso o gráfico grande; nunca detrás de texto. Sin sombras fuertes ni brillos. Un `h1` y un primario por vista.

## 2. Color

### 2.1 Página clara y barra carbón (20-oct)

| Dónde | Tema | Cómo |
|---|---|---|
| Todas las páginas: landing (`/`), celular (`/m/:codigo`), tablero (`/tablero/:sala`) y panel (`/admin`) | **Claro** | Por defecto (`:root`). Cada vista lleva `data-tema="claro"` en su elemento raíz y llama `useTemaDocumento('claro')` (lo pone en `<html>` mientras está montada: fondo del rebote igual a la vista aunque se llegue desde otra ruta de la SPA) |
| Barra superior de todas las vistas | **Carbón** dentro del claro | `EncabezadoProducto` ya lleva `data-tema="carbon"` en su `<header>`: no hace falta envolverlo. Una barra propia (la del tablero) pone `data-tema="carbon"` en su contenedor y usa los mismos tokens |

~~Landing y tablero en carbón con `useTemaDocumento('carbon')`; barra carbón solo en el panel~~ (19-oct). **Reemplazado el 20-oct** por la tabla de arriba.

`web/index.html` declara `color-scheme: light` y `theme-color` `#141414` (el carbón de la barra superior: la barra del navegador y la de la vista se leen como una sola). `useTemaDocumento` ya no cambia el `theme-color`.

Mismos nombres de token en los dos temas; solo cambian los valores. Una variable propia de un área que use `var(--hz-…)` se resuelve donde se declara: si un área define alias (`--a-*`, `--t-*`), deben declararse en el elemento con `data-tema` o dentro de él.

### 2.2 Tokens y contraste medido

Contraste WCAG 2.2 medido el 19-oct; la prueba `web/shared/ui/__tests__/contraste.test.ts` lo verifica en los dos temas. f = fondo, s1, s2 y s3 = superficies.

| Token | Claro (páginas) | Carbón (barra) | Rol | Contraste claro · carbón |
|---|---|---|---|---|
| `--hz-fondo` | `#FFFFFF` | `#141414` | Fondo de página (en carbón, de la barra) | |
| `--hz-superficie-1` | `#F3F8FF` | `#1B1D22` | Tarjetas, barra inferior, secciones alternas | |
| `--hz-superficie-2` (= `--hz-h1`) | `#E8F1FF` | `#23262D` | Bloques suaves, pestañas | |
| `--hz-superficie-3` (= `--hz-h2`) | `#DCECFF` | `#2C3038` | Hover, pista de barras, deshabilitado, insignia neutra | |
| `--hz-borde` (= `--hz-h3`) | `#C9D9F2` | `#343944` | Bordes de tarjeta y separadores | |
| `--hz-borde-control` | `#5A6680` | `#8A9BB8` | Borde de campos, casillas y botón secundario | f 5,76 · 6,55; s2 5,06 · 5,38 (≥ 3) |
| `--hz-tinta` | `#141414` | `#DCECFF` | Texto y títulos | f 18,42 · 15,34; s3 15,34 · 11,02 |
| `--hz-tinta-2` | `#44506A` | `#A8B6CF` | Texto de apoyo | f 8,07 · 9,00; s3 6,72 · 6,46 |
| `--hz-tinta-3` | `#5A6680` | `#8A9BB8` | Metadatos, ayudas, deshabilitado | f 5,76 · 6,55; s3 4,79 · 4,70 |
| `--hz-accion` (= `--hz-azul`) | `#1A66D6` | `#3487FF` | Acción, enlaces, selección, cifra elegida | f 5,36 · 5,31; s1 5,03 · 4,86 |
| `--hz-sobre-accion` | `#FFFFFF` | `#141414` | Texto sobre un relleno de acción | 5,36 · 5,31 |
| `--hz-foco-color` | `#1A66D6` | `#3487FF` | Contorno de foco | f 5,36 · 5,31 (≥ 3) |
| `--hz-acento-producto` | `#00CDA1` | `#00CDA1` | Glifo, línea, gráficos propios; **nunca texto sobre claro** | |
| `--hz-acento-producto-texto` | `#007A60` | `#00CDA1` | Acento como texto | f 5,31 · 8,99 |
| `--hz-ok` / `--hz-ok-fondo` | `#007A60` / `#DDF6EF` | `#00CDA1` / `#10332B` | Éxito | 4,68 · 6,70 |
| `--hz-alerta` / `--hz-alerta-fondo` | `#8A5A00` / `#FFF3D6` | `#FFBB44` / `#2B2418` | Alerta | 5,37 · 9,09 |
| `--hz-error` / `--hz-error-fondo` | `#BF0029` / `#FDE7EB` | `#FF6B7F` / `#3A1620` | Error y destructivo | 5,48 · 5,82 |
| `--hz-info-fondo` | `#E8F1FF` | `#16233A` | Fondo del aviso info (texto en acción) | 4,71 · 4,53 |
| `--hz-acento-tinte` | acción al 10 % | acción al 10 % | Opción elegida (cifra en acción encima) | 4,67 · 4,77 |
| `--hz-deshabilitado-texto` / `-fondo` | tinta 3 / s3 | tinta 3 / s3 | Deshabilitado plano | 4,79 · 4,70 |
| `--hz-azul-medio` | `#3487FF` | `#3487FF` | Trazos de arcos y curvas; **no para texto sobre claro** | f 3,47 · 5,31 (gráfico ≥ 3) |
| `--hz-grad-marca` (= `--et-grad`) | violeta `#442AAF` 0 %, azul `#3487FF` 30 %, verde agua `#00CDA1` 100 % | igual | Líneas, bordes, progreso | nunca detrás de texto |

Reglas que salen de la medición:
- Texto en acción solo sobre fondo, superficie 1, tinte de selección o `--hz-info-fondo`. En carbón la acción da 4,37 sobre la superficie 2 y 3,82 sobre la 3: ahí el texto va en tinta.
- Sobre un relleno de acción, el texto va en `--hz-sobre-accion`: en carbón es carbón, **nunca blanco** (3,47).
- El verde agua nunca es texto sobre claro (2,05); el violeta nunca es texto sobre carbón (1,93).
- El color nunca es el único portador de significado: siempre texto, ícono o forma.

### 2.3 Rondas

| Token | Claro (páginas) | Carbón (barra) | Contraste claro · carbón |
|---|---|---|---|
| `--hz-r1` (verde, hueco) | `#1B7F3A` | `#3FB25A` | f 5,07 · 6,78; s1 4,75 · 6,20; s3 4,22 · 4,87 (forma ≥ 3) |
| `--hz-r2` (rojo, sólido) | `#C62828` | `#F36363` | f 5,62 · 5,94; s1 5,27 · 5,44; s3 4,68 · 4,27 (forma ≥ 3) |
| `--hz-sobre-r1` / `--hz-sobre-r2` | `#FFFFFF` | `#141414` | 5,07 / 5,62 · 6,78 / 5,94 |

R1 y R2 son de ronda, no de estado. Siempre con el texto «R1»/«R2» y con forma: R1 hueco (borde y texto verdes), R2 sólido (relleno rojo y `--hz-sobre-r2`). Como texto, sobre fondo o superficie 1.

### 2.4 Primitivos

`--et-carbon` `#141414`, `--et-hielo` `#DCECFF`, `--et-hielo-2` `#BEDAFF`, `--et-azul` `#3487FF`, `--et-azul-profundo` `#1A66D6`, `--et-verde-agua` `#00CDA1`, `--et-violeta` `#442AAF`, `--et-rojo` `#BF0029`, `--et-blanco` `#FFFFFF`, `--et-grad`. Las pantallas usan los semánticos `--hz-*`; los `--et-*` son para tokens y casos de marca (el glifo lleva `--et-carbon` sobre el acento en los dos temas). La tabla de cambios de valor frente al tema anterior está en `docs/DECISIONES.md` (2026-10-19, Marca).

## 3. Tipografía

- Familia única: **Montserrat** variable, autoalojada con `@fontsource-variable/montserrat`. Respaldo con métricas ajustadas (`Montserrat Respaldo`), luego `"Segoe UI"`, `system-ui`, `sans-serif`.
- Pesos: 400 (`--hz-fw-regular`) y 500 (`--hz-fw-texto`, base de `.hz`) en cuerpo, 700 en etiquetas y botones (`--hz-fw-etiqueta`), 800 en títulos (`--hz-fw-titulo`), 900 en display, titulares de la landing y cifras (`--hz-fw-display`, `--hz-fw-cifra`). Tipo oración, sin mayúsculas sostenidas (salvo INSUMEX y NUTRIWHAT, que así vienen de la semilla).

| Token | Tamaño | Uso |
|---|---|---|
| `--hz-fs-12` | 12 px | Insignias, firma «por Estratek» |
| `--hz-fs-14` | 14 px | Ayudas, metadatos, etiquetas de campo, paneles densos |
| `--hz-fs-16` | 16 px | Cuerpo y campos (evita el zoom automático de iOS) |
| `--hz-fs-20` · `--hz-fs-24` · `--hz-fs-32` · `--hz-fs-40` · `--hz-fs-56` | 20 a 56 px | Subtítulos, títulos, cifras |
| `--hz-fs-72` · `--hz-fs-96` | 72 · 96 px | Solo proyección |
| `--hz-fs-h1` / `--hz-fs-h2` | 24 a 32 / 20 a 24 px | Título de pantalla y de sección |
| `--hz-fs-display` / `--hz-fs-display-2` | 40 a 56 / 32 a 40 px | Landing (900, interlineado 1,05) |
| `--hz-fs-proj-*` | 16 a 44 px | Tablero en proyección |
| `--hz-fs-18` · `--hz-fs-25` | 18 · 25 px | Pregunta y cifra de la rúbrica |

- Interlineado 1,5 en cuerpo y 1,2 en títulos. Medida del caso: `--hz-medida` (34rem).
- Cifras con `font-variant-numeric: tabular-nums` y coma decimal.
- **Firma:** la **»** del logo en azul (acción) junto a «por Estratek», en enlaces de avance («Ver cómo funciona »») y en el nombre del pie. Es decorativa: `aria-hidden`.

## 4. Espaciado y retícula

- Retícula de 8 px con medio paso de 4: `--hz-sp-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-6` 24 · `-8` 32 · `-10` 40 · `-12` 48 · `-16` 64 · `-20` 80. `--hz-sp-5` (20) se conserva.
- Móvil primero: 360 px, margen lateral 16 px, una columna. La acción principal del celular vive en la barra inferior fija (`.hz-barra-accion`).
- Áreas táctiles de 48 px (`--hz-tactil`); 8 px mínimo entre objetivos.

## 5. Radios, bordes y elevación

| Token | Valor | Uso |
|---|---|---|
| `--hz-r-boton` (= `--hz-r-pill`) | 999 px | Botones, pestañas, insignias, progreso |
| `--hz-r-campo` (= `--hz-r-m`) | 12 px | Campos, opciones de rúbrica, avisos, glifo |
| `--hz-r-tarjeta` (= `--hz-r-l`) | 16 px | Tarjetas y hojas |

Jerarquía por superficie y borde de 1 px. Sombra (`--hz-sombra`) solo en lo que flota: la barra inferior fija, menús y diálogos.

## 6. Foco, movimiento y accesibilidad

- Foco visible con `:focus-visible`: contorno de 2 px en `--hz-foco-color`, separado 2 px; 3 px en la opción de la rúbrica; en alto contraste de Windows, `CanvasText`. `--hz-foco` queda como anillo en `box-shadow` para quien lo necesite.
- Movimiento de 150 ms en interacción y 250 ms en transiciones, con `--hz-curva`. Con `prefers-reduced-motion: reduce` no hay transiciones.
- Formularios: `<label>` visible, error con ícono y texto asociado con `aria-describedby` y `aria-invalid`.
- Rúbrica: `radiogroup` con radios nativos. Pestañas: patrón ARIA `tablist`. Avisos: `status` para info y ok, `alert` para alerta y error.
- `lang="es-CO"`, coma decimal.

## 6 bis. Composición (21-oct, pedido de Paola: «parecen cada página de un proyecto diferente»)

Un solo producto: las cuatro áreas (landing, celular, tablero y panel) se arman con las mismas piezas y las mismas medidas. Lo de cada área entra en estas piezas; ninguna área redefine su alto, su ancho ni su escala.

| Pieza | Medida | Dónde vive |
|---|---|---|
| Barra (`EncabezadoProducto`) | 64 px bajo 1024 px y 72 px desde ahí (`--hz-alto-barra`, con la línea del degradado de 4 px incluida); fila en `.hz-pagina` | `web/shared/ui/EncabezadoProducto.tsx` |
| Menú del área (`menu`) | A la derecha de la barra desde 1024 px; por debajo, en el botón «Menú» que abre un desplegable carbón (se cierra al elegir, con Escape, con el mismo botón o tocando fuera). El contenido existe una sola vez: al abrir se muda al desplegable | landing: secciones e «Ingresar al panel»; panel: Guía de uso, Cambiar mi clave, quién eres y Salir |
| Segunda franja (`franja`) | Clara, 56 px (`--hz-alto-franja`), una sola fila en `.hz-pagina`; si no cabe, se desliza de lado | panel: pestañas de las secciones (bajo 1024 px van dentro de «Menú», `franjaEnMenu`); tablero: la sala (h1) y los controles; bajo 1100 px la sala en su línea y los controles en una fila deslizable |
| Contenedor | `.hz-pagina`: 1280 px centrado, márgenes de 16, 24 y 32 px. En el celular, la columna de lectura `.hz-pagina--lectura` (640 px como máximo, centrada); su resultado sale a 1280 desde 1280 px | todas las vistas |
| Cabecera de página (`CabeceraPagina`) | h1 en 900 con `--hz-fs-h1` (`clamp(1.5rem, 1.2rem + 1vw, 2rem)`, de 24 a 32 px), línea de contexto en 14 px y acciones opcionales. La landing conserva su titular grande solo en el héroe; sus h2 de sección usan la misma escala | panel (cada sección, login y cambio de clave), celular (`.hz-titulo`), tablero (en la franja) |
| Pie (`PiePagina`) | Línea del degradado encima, logo de Estratek, «Horizontes, una herramienta de Estratek »» y los enlaces mínimos (Política de datos y estratek.com.co) | landing (bajo el bloque final), celular, login, panel y tablero fuera del proyector |
| Tarjeta | Superficie 1, borde de 1 px, radio 16, relleno `--hz-sp-tarjeta` (16 px; 24 desde 768 px) | `.hz-tarjeta`, `.panel` del panel, tarjetas del celular y de la landing |
| Aire entre bloques | `--hz-sp-bloque` (24 px; 32 desde 768 px) | bajo la cabecera de página y entre tarjetas |
| Botones y controles | 48 px en todas las áreas, también en el tablero (`.hz-segmento`, `.hz-boton-pantalla`, selector de alcance) | `componentes.css` |

**Tablero.** La vista normal usa el contenedor de 1280 px. Excepción: el **Detallado desde 1600 px** toma el ancho de la pantalla (barra, franja y contenido juntos, con el margen de 32 px), porque la matriz de 820 px y la tabla comparada no caben en 1280 a 6 m. En el proyector (desde 1100 px) el tablero ocupa justo la pantalla y el pie común no se muestra (la firma de Estratek ya va en la barra). La pantalla completa de la matriz no cambia.

**Capas.** El encabezado (con el desplegable) va en `z-index` 12: sobre la barra de acción fija del celular (10) y bajo la pantalla completa de respaldo del tablero (15).

**Mínimo de votos y ensayo (21-oct).** Bajo el mínimo, un solo mensaje por bloque con el conteo real (`web/shared/votos.ts`): «Hay 1 voto de los 3 que hacen falta para mostrar el resultado. Así nadie puede deducir cómo votó otra persona.» Nunca «Faltan votos» en cada celda; si ninguna columna tiene resultado, el mensaje va en lugar de la tabla. En una sala de ensayo (`ensayo: true`), el aviso «Ensayo: los resultados se muestran desde 1 voto. En un taller con cliente hacen falta 3.» y la insignia «En vivo: se actualiza con cada voto».

## 7. Componentes base (`web/shared/ui/`)

React sin dependencias externas, clases `hz-*` y tokens `--hz-*`. Ningún componente calcula resultados.

### EncabezadoProducto
- La barra superior carbón de todas las vistas: el `<header>` lleva `data-tema="carbon"`, así la barra y sus hijos (navegación, botones, menú desplegable) toman los tokens del carbón aunque la página sea clara. Glifo de Horizontes (40 px, radio 12, carbón sobre el acento), nombre en 900, firma «por Estratek »» con la » en azul y la línea del degradado de 4 px debajo, de borde a borde. La fila usa `.hz-pagina` y mide `--hz-alto-barra` (§6 bis). `href` opcional (la marca se vuelve enlace), `onIr` para navegar sin recargar, `children` siempre a la derecha, `menu` (a la derecha desde 1024 px; por debajo, en «Menú»), `franja` (segunda franja clara de 56 px), `franjaEnMenu`, `etiquetaMenu` y el estado controlado `menuAbierto`/`onMenu`. Prop `nombre` para las demás herramientas de la familia.

### CabeceraPagina y PiePagina
- `CabeceraPagina`: `titulo` (h1 `.hz-h1`), `antetitulo`, `contexto`, `acciones`, `enfocable` (tabindex -1 para llevar el foco al cambiar de sección) e `id`.
- `PiePagina`: el pie común; `antes` agrega enlaces propios del área.

### LogoEstratek
- Logo oficial de Estratek (`marca/estratek-logo.png`, un solo color) como máscara pintada con `--hz-tinta`: carbón sobre el claro, hielo dentro de la barra. `role="img"` y nombre «Estratek». Alto de 32 px por defecto (se cambia con `className`); en alto contraste de Windows, `CanvasText`.

### Boton
- `primario`: sólido en `--hz-accion` con texto `--hz-sobre-accion`, uno por vista; al pasar, `--hz-azul-presionado`.
- `secundario`: contorno `--hz-borde-control` y texto tinta; al pasar, borde de acción y tinte suave.
- `fantasma`: texto en acción, subrayado al pasar. Dentro de un aviso, en tinta y subrayado.
- `destructivo`: relleno `--hz-error` con texto `--hz-fondo` (6,47 · 6,72). Solo para borrar o retirar.
- Píldora de 48 px de alto, texto 16/700. Deshabilitado plano (`--hz-deshabilitado-*`, `aria-disabled`, sin opacidad); cargando con `aria-busy` y el texto en curso («Guardando…»).

### Campo
- Etiqueta encima (14/700, tinta), entrada de 48 px sobre el fondo con borde `--hz-borde-control` de 1,5 px y radio 12, ayuda debajo (14, tinta 3), error con ícono «!» y texto `--hz-error`.

### Casilla
- 24 px con área táctil de 44 px; marcada, relleno de acción con la palomita en `--hz-sobre-accion`.

### Rubrica
- Lista de cinco opciones 9 a 1 con separadores, arco de horizonte, número en 900 y texto completo. Elegida: `--hz-acento-tinte`, borde de acción de 1,5 px con barra lateral de 4 px, número en acción, texto en 700, arco relleno de acción.

### Pestanas
- Píldoras sobre superficie 1 con borde; la activa sobre el fondo con contorno de acción y texto 800.

### BarraProgreso
- Pista superficie 3 de 8 px, relleno con el degradado de marca, texto visible y `role="progressbar"`.

### Aviso
- `info`, `ok`, `alerta`, `error`: fondo del estado, borde de 1 px y filo izquierdo de 4 px del color del estado, ícono (símbolo en el color del fondo sobre el color del estado), título opcional en 700 y texto en tinta.

### Insignia
- Píldora de 12/700: `neutra`, `ok` (✓), `alerta` (!), `error` (!), con fondo, texto y símbolo del estado (el símbolo no se lee en voz alta). R1 hueca y R2 sólida (§2.3).

### Hoja
- Tarjeta en superficie 1 con borde y radio 16; la activa lleva un filo de acción de 3 px arriba.

### Landing (`web/inicio/`)
- Tema claro con la barra carbón (20-oct). `EncabezadoProducto` con el menú común (21-oct): las cinco secciones («Tu mesa», «Cómo funciona», «Qué se evalúa», «Facilitadores», «Tus datos») e «Ingresar al panel» desde 1024 px; por debajo, en «Menú». ~~Desde 1152 px, con «Entrar a tu mesa»~~ (20-oct).
- Héroe: titular en 900 con la palabra clave en azul («La mesa mueve el **portafolio**»), un primario («Escribir el código de mi mesa») y el avance «Ver cómo funciona »». Desde 768 px, texto y matriz lado a lado.
- Matriz ilustrada: plano en superficie 1 con ejes en borde de control, H2 y H1 en superficies 2 y 3 con su borde, etiquetas H1 a H3 en borde de control, fijos en tinta 3, R1 hueco verde y R2 sólido rojo del claro, «R1» del lado contrario a la flecha.
- Secciones que alternan fondo y superficie 1 con borde. En las de dos columnas, el título lleva su bajada (y en facilitadores, «Ingresar al panel») al lado: la columna no queda vacía.
- Pie común (`PiePagina`, 21-oct) bajo el bloque comercial. ~~Pie propio con «Horizontes »» en grande~~ (20-oct).

## 8. Flujo de pantallas del participante

Ruta base `/m/{codigoMesa}`. El estado se decide con `GET /api/mesas/{codigo}` antes de inscribirse y con `GET /api/yo` (polling 2,5 s con `If-None-Match`) después. El token vive en `localStorage` (`hz_token:{codigoMesa}`), así que recargar devuelve a la misma pantalla. Todos los textos de esta sección son finales.

### 8.0 Cargando
- Esqueleto con el encabezado y tres bloques grises suaves. Sin texto salvo para lectores de pantalla: "Cargando tu mesa".

### 8.1 Inscripción (`inscripcion_abierta = true`, sin token)
- Título: **Bienvenido al taller Horizontes**
- Bajada: "Estás en {Mesa N} de {nombre de la sala}. Inscríbete para recibir el caso y tu hoja de información."
- Campo "Tu nombre" (ayuda: "Así te verá el facilitador en la lista de tu mesa.").
- Campo "Tu correo" (ayuda: "Solo lo usamos con fines informativos.").
- Casilla de autorización: texto de `consentimiento.texto_autorizacion` + enlace "Lee la Política de Tratamiento de Datos Personales de Estratek" (`politica_url`, se abre en pestaña nueva).
- Botón: **Inscribirme**. Deshabilitado sin casilla, con ayuda: "Para inscribirte necesitamos tu autorización de tratamiento de datos."
- Errores de campo: "Escribe tu nombre." · "Escribe un correo válido, por ejemplo ana@empresa.com."
- 409 `CORREO_YA_INSCRITO` (desde el 20-oct, D1): error con el mensaje del servidor; no entra. Quien perdió la sesión la recibe del facilitador con «Dar acceso de nuevo» (enlace `/m/{codigo}?acceso=…` que el celular canjea con `POST /api/acceso`).
- 422 `CONSENTIMIENTO_REQUERIDO`: "Marca la autorización de tratamiento de datos para continuar."

### 8.2 Mesa no existe (404 `MESA_NO_EXISTE`)
- Título: **No encontramos esta mesa**
- Texto: "El código {codigo} no corresponde a ninguna mesa activa. Revisa el QR de tu mesa o pídele el enlace al facilitador."

### 8.3 Inscripción cerrada (`inscripcion_abierta = false`, sin token)
- Sala `preparada`: **Aún no abrimos la inscripción**. "El facilitador la abrirá en unos minutos. Deja esta pantalla abierta: se actualiza sola."
- Sala `r2_cerrada` o `cerrada`: **El taller ya terminó**. "Esta sala cerró y no recibe más inscripciones. Gracias por participar."

### 8.4 Perfil asignado (primera vez tras inscribirse)
- Título: **Tu perfil es {perfil}**
- Texto: "En tu mesa cada persona tiene información distinta sobre INSUMEX y NUTRIWHAT. Tú aportas la mirada de {perfil}. Lee el caso, lee tu hoja y compártela con tu mesa."
- Botón: **Leer el caso**

### 8.5 Lectura (pestañas)
- Pestaña **Caso**: título del caso, descripción, situación y la tabla de los 10 proyectos (en móvil, lista de tarjetas compactas: nombre, tipo, sector, descripción; los 2 vivos marcados con la insignia "Se califica").
- Pestaña **Tu hoja** (R1): "Tu hoja como {perfil}" y un bloque por proyecto (INSUMEX, NUTRIWHAT).
- Pestaña **Hojas** (cuando `revelar_hojas = true`): las 6 hojas agrupadas por proyecto, la propia primero y marcada "Tu hoja". Aviso info la primera vez: "Ya puedes ver la información de los 6 perfiles."
- Barra inferior: si la ronda está abierta, **Calificar proyectos**; si no, texto "La votación se abre cuando el facilitador lo indique."

### 8.6 Esperando ronda (`inscripcion` o `r1_cerrada` antes de abrir R2, sin resultados visibles)
- Aviso info: "La ronda {n} aún no está abierta. Mientras tanto, lee el caso y tu hoja." La pantalla de lectura sigue disponible.

### 8.7 Elegir proyecto (ronda abierta)
- Título: **Ronda {n}: califica los 2 proyectos**
- Dos filas: INSUMEX y NUTRIWHAT, cada una con insignia "Pendiente" o "Guardado" y el botón **Calificar** o **Editar**.
- Progreso propio: "Llevas 1 de 2 proyectos".

### 8.8 Calificar proyecto
- Título: **{PROYECTO}** con la descripción corta y el enlace "Ver tu hoja de este proyecto" (abre la hoja en una hoja inferior, sin perder lo marcado).
- Las 6 rúbricas en orden de la semilla, con contador "Criterio 3 de 6" en cada encabezado.
- Barra inferior: **Guardar calificación**. Con criterios sin elegir: "Te faltan {k} criterios. Elige una opción en cada uno." y el foco salta al primero pendiente.
- Al guardar: aviso ok "Calificación de {PROYECTO} guardada." y vuelve a 8.7 (o a 8.9 si ya completó).
- 422 `RESPUESTA_INVALIDA`: "Una de las respuestas no es válida. Vuelve a elegir y guarda de nuevo."
- 409 `RONDA_CERRADA`: "La ronda {n} ya se cerró. Tu última calificación guardada es la que cuenta." 409 `RONDA_NO_ACTIVA`: "La ronda {n} todavía no está abierta."
- Lo marcado y no guardado vive en `sessionStorage` por proyecto y ronda: si se pierde la señal o se recarga, no se pierde.

### 8.9 Voto registrado (`vista_participante = registrado`, completo)
- Título: **Voto registrado**
- Texto: "Calificaste INSUMEX y NUTRIWHAT en la ronda {n}. Puedes editar mientras la ronda siga abierta."
- Barra de progreso de la mesa: "{completos} de {inscritos} completaron en {Mesa N}".
- Botones: **Editar mis calificaciones** (secundario) y **Volver al caso** (fantasma).

### 8.10 En vivo (`vista_participante = en_vivo`)
- Muestra el tablero del alcance (componente del tablero) bajo el título **Resultados en vivo de {tu mesa | la sala}** con la insignia "Preliminar". Si aún no hay votos en el alcance: "Todavía no hay calificaciones en {tu mesa | la sala}. Los puntos aparecen con el primer voto."

### 8.11 Precierre (derivado, `progreso_mesa.precierre = true` o sala en precierre)
- Aviso alerta fijo arriba: título **Todos votaron en {Mesa N}**, texto "Este es un resultado preliminar. El facilitador cerrará la ronda; hasta entonces puedes editar tus calificaciones."
- Debajo, el resultado del alcance con la insignia "Preliminar". Si el precierre desaparece (alguien nuevo se inscribe), el aviso se retira y se vuelve a 8.9.

### 8.12 Ronda cerrada (`r1_cerrada`, `r2_cerrada`)
- Título: **Ronda {n} cerrada**
- Texto R1: "Este es el resultado de {tu mesa | la sala}. Discútanlo en la mesa antes de la ronda 2."
- Texto R2: "Así se movieron INSUMEX y NUTRIWHAT de la ronda 1 a la ronda 2 en {tu mesa | la sala}."
- Resultado del alcance (matriz y promedios por criterio, componente del tablero). Nunca respuestas individuales ni nombres.

### 8.13 Sala cerrada (`cerrada`)
- Título: **El taller terminó**
- Texto: "Gracias por participar. Este es el resultado final de {tu mesa | la sala}." + resultado de la R2 (o de la R1 si no hubo R2).

### 8.14 Sin señal
- Si una petición falla por red o el polling falla 2 veces seguidas: aviso alerta fijo arriba, **Sin conexión**, "Seguimos intentando. Lo que marcaste está guardado en este celular." El polling sigue con espera creciente hasta 10 s; al volver: aviso ok "Conexión recuperada." durante 3 s.
- Un guardado que falla por red deja el botón en **Reintentar guardado** y conserva lo marcado.

### 8.15 Sesión no válida (401 o token desconocido)
- Título: **Tu sesión ya no está activa**
- Texto (desde D1, 20-oct): "Puede que hayas entrado desde otro celular o que el facilitador te haya dado acceso nuevo. Pídele al facilitador que te dé acceso de nuevo: en su panel, «Dar acceso de nuevo» te muestra un QR o un enlace para entrar. Lo que habías marcado sigue en este celular." Sin botón: no hay recuperación con el correo.

### 8.16 Participante desactivado (`activo = false`)
- Título: **El facilitador te retiró de esta mesa**
- Texto: "Si es un error, avísale en el salón."

### 8.17 Error del servidor (5xx u otro inesperado)
- Aviso error: **Algo falló de nuestro lado**, "Vuelve a intentarlo en unos segundos." Botón **Reintentar**.

### Mapa de estados → pantalla (tras inscribirse)

| Estado sala | Completo | Resultados visibles | Pantalla |
|---|---|---|---|
| `inscripcion` | | | 8.5 + 8.6 |
| `r{n}_abierta` | no | | 8.7 / 8.8 |
| `r{n}_abierta` | sí | null | 8.9 |
| `r{n}_abierta` | sí | preliminar por `en_vivo` | 8.10 |
| `r{n}_abierta` | cualquiera | preliminar por precierre | 8.11 (sobre 8.7 o 8.9) |
| `r{n}_cerrada` | | sí | 8.12 |
| `cerrada` | | | 8.13 |

La lectura (8.5) está disponible en todos los estados desde una pestaña o botón "Caso".
