# Sistema de diseño · Horizontes

Fuente de los tokens en código: `web/shared/ui/tokens.css`. Si este documento y el CSS no coinciden, manda el CSS y se corrige este documento en la misma ronda.
Muestra viva: `/m/_ui` (todos los componentes base en 360 px).

**Desde el 19-oct (C19-8, D1), Horizontes usa el sistema visual del IRMI de Estratek**: `C:\REVISA\2026\IRMI\docs\diseno\DESIGN.md`, `sistema-visual.md` y `apps/irmi/web/src/styles/tokens.css`. Lienzo casi negro, cuatro superficies grafito, tinta blanco verdoso, un solo acento (el teal de Estratek) y el degradado de marca teal → azul solo en la acción principal y el progreso. Montserrat de 500 a 900.
Los nombres de los tokens anteriores se conservan: celular, tablero y panel los heredan sin tocar su código. Lo que esas áreas tengan con color fijo (`#fff`, `color: #fff` sobre un relleno) no hereda: ver §2.4.

## 1. Idea de diseño

**Sujeto.** Un taller presencial: 30 a 40 personas en mesas, con el celular en la mano, leyendo un caso y calificando dos proyectos mientras discuten. El celular es una herramienta de trabajo de mesa, no una app de consumo. La pantalla se mira de reojo, se suelta y se vuelve a tomar. El tablero se proyecta y se lee a 6 m.

**Confiable, sobria y clara, como el IRMI.** La jerarquía la dan los escalones de superficie grafito, no las sombras ni los brillos. Un solo acento: el teal marca la acción, el foco, la selección y los enlaces. El degradado de marca es la única excepción a «sin degradados» y vive solo en el botón primario y en la barra de progreso.

**Lo memorable: el horizonte.** La matriz del tablero dibuja los horizontes como cuartos de círculo (radio 4,5 y 9). En el celular usamos esa misma geometría como única firma visual:
- Cada opción de la rúbrica lleva un **arco de horizonte**: un cuarto de círculo cuyo radio crece con el valor (1 = arco pequeño pegado a la esquina, 9 = arco amplio). Quien califica ve, sin leer el número, que 9 es «más lejos del core, más incierto» y 1 «más cerca». Es la misma lectura que tendrá la matriz. El arco elegido se llena de teal.
- El encabezado de la pantalla lleva los tres arcos H1, H2, H3 en grafito, recortados en la esquina superior derecha. En la landing, la marca de Horizontes son los mismos tres arcos en los colores de Estratek (azul, azul claro y teal). Nada más decora.

**Todo lo demás, sobrio.** Sin degradados decorativos, sin brillos, sin etiquetas en mayúsculas sostenidas, sin flechas pegadas a los botones. Un `h1` y un primario por vista.

**Revisión contra los clichés.** La rúbrica es una lista con separadores, no un mosaico de tarjetas; solo la opción elegida gana tinte, borde y barra lateral teal. La hoja de proyecto es la única tarjeta; la activa lleva el filo teal arriba. Nunca tarjeta dentro de tarjeta dentro de tarjeta.

## 2. Color

### 2.1 Lienzo, superficies y tinta

| Token | Valor | Rol | Contraste |
|---|---|---|---|
| `--hz-lienzo` = `--hz-fondo` | `#0E0E0E` | Fondo de toda página | |
| `--hz-superficie-1` | `#131313` | Tarjetas, barra inferior, secciones alternas | |
| `--hz-superficie-2` = `--hz-h1` | `#1A1A1A` | Campos, bloques suaves, pestañas | |
| `--hz-superficie-3` = `--hz-h2` | `#242424` | Hover, pista de barras, deshabilitado, insignia neutra | |
| `--hz-superficie-4` = `--hz-h3` | `#2A2A2A` | Separadores y bordes de lista | |
| `--hz-borde-suave` / `--hz-borde` / `--hz-borde-fuerte` | blanco al 5 / 9 / 16 % | Bordes de tarjeta, aviso y botón secundario | |
| `--hz-borde-control` | `#6E7F78` | Borde de campos y casillas | 4,6 lienzo · 4,1 sup. 2 (≥ 3, WCAG 1.4.11) |
| `--hz-tinta` | `#EDF2EE` | Texto corrido y títulos | 17,0 lienzo · 16,4 sup. 1 · 13,7 sup. 3 |
| `--hz-tinta-2` | `#C8D4CE` | Texto de apoyo | 12,7 lienzo · 10,2 sup. 3 |
| `--hz-tinta-3` | `#8A9E96` | Metadatos, ayudas, deshabilitado | 6,8 lienzo · 5,5 sup. 3 · 5,1 sup. 4 |

### 2.2 Acento y marca

| Token | Valor | Rol | Contraste |
|---|---|---|---|
| `--hz-acento` = `--hz-azul` = `--hz-ok` | `#47EBC2` | Acción, foco, selección, enlaces, cifra elegida | 12,8 lienzo · 9,5 sup. 4 |
| `--hz-cielo` = `--hz-acento-2` | `#1699DB` | Fin del degradado, trazo del arco elegido | 6,1 lienzo · 4,9 sup. 3 |
| `--hz-azul-medio` | `#1A73B8` | Bordes, barras y arcos; **no para texto** | 3,9 lienzo (gráfico ≥ 3) |
| `--hz-grad-marca` | `#47EBC2 → #1699DB` (120°) | Solo botón primario y progreso | |
| `--hz-sobre-acento` | `#0E0E0E` | Texto sobre el acento o el degradado | 12,8 sobre teal · 6,1 sobre azul |
| `--hz-acento-tinte` / `-suave` / `-borde` | teal al 12 / 8 / 28 % | Opción elegida, hover, borde de pestaña activa | tinta 12,8 sobre el tinte |
| `--hz-azul-presionado` | `#2FCFA8` | Teal presionado (se conserva el nombre) | |

`--hz-azul` conserva el nombre por compatibilidad pero ya no es azul: es el acento. Como fondo lleva `--hz-sobre-acento`, **nunca texto blanco** (1,5:1).

### 2.3 Estados y rondas

| Token | Valor | Fondo | Contraste |
|---|---|---|---|
| `--hz-ok` | `#47EBC2` | `--hz-ok-fondo` `#192D28` | 9,6 |
| `--hz-alerta` | `#FFBB44` | `--hz-alerta-fondo` `#2B2418` | 9,1 (11,4 sobre el lienzo) |
| `--hz-error` | `#FF8585` | `--hz-error-fondo` `#331818` | 7,0 (8,2 sobre el lienzo) |
| info (aviso) | `--hz-acento` | `--hz-info-fondo` `#13262F` | 10,4 |
| `--hz-r1` | `#3FB25A` verde | lienzo · sup. 1 · sup. 3 · sup. 4 | 7,1 · 6,8 · 5,7 · 5,3 |
| `--hz-r2` | `#F36363` rojo | lienzo · sup. 1 · sup. 3 · sup. 4 | 6,2 · 6,0 · 5,0 · 4,6 |
| `--hz-sobre-r1` / `--hz-sobre-r2` | `#0E0E0E` | sobre el relleno R1 / R2 | 7,1 / 6,2 |
| `--hz-deshabilitado-texto` | `#8A9E96` | `--hz-deshabilitado-fondo` `#242424` | 5,5 |

Los fondos de estado son opacos (tinte del color sobre `#131313`) para que el contraste no dependa de lo que haya debajo.
**Rondas:** R1 verde y R2 rojo siguen siendo de ronda, no de estado. Lejos del teal de acento (R1 `#3FB25A` frente a `#47EBC2`: 1,8:1 y otro tono). Siempre con el texto «R1»/«R2» y con forma: R1 hueco (borde y texto verdes), R2 sólido (relleno rojo y texto `--hz-sobre-r2`). El blanco sobre R1 o R2 ya no llega a AA (2,7 y 3,1): usar `--hz-sobre-r1` / `--hz-sobre-r2`.

Reglas: el color nunca es el único portador de significado (siempre texto o icono). `--hz-azul-medio` no se usa para texto. Medido con la fórmula WCAG 2.x; la prueba `web/shared/ui/__tests__/componentes.test.tsx` lo verifica.

### 2.4 Para celular, tablero y panel

Lo que usa `var(--hz-*)` ya es oscuro. Lo que tiene color fijo se cambia así:

| Antes | Ahora |
|---|---|
| `background: #fff` de página | `var(--hz-fondo)` |
| `background: #fff` de tarjeta o panel | `var(--hz-superficie-1)` con `border: 1px solid var(--hz-borde-suave)` |
| Campo con fondo blanco | `var(--hz-superficie-2)` con borde `var(--hz-borde-control)` |
| `color: #fff` sobre `--hz-azul` | `var(--hz-sobre-acento)`; si es la acción principal, fondo `var(--hz-grad-marca)` |
| `color: #fff` sobre `--hz-r1` / `--hz-r2` | `var(--hz-sobre-r1)` / `var(--hz-sobre-r2)` |
| `rgba(15, 35, 64, …)` (sombra o velo azul) | `rgba(0, 0, 0, 0.4)` o `var(--hz-sombra)` |
| Respaldo `var(--hz-x, #valor-claro)` | Puede quedar; solo se usa si `tokens.css` no carga |
| QR | Sigue en blanco y negro: el papel del QR es blanco |

## 3. Tipografía

- Familia única: **Montserrat** (variable, autoalojada con `@fontsource-variable/montserrat`, la misma del IRMI). Respaldo con métricas ajustadas (`Montserrat Respaldo`) y luego `system-ui`.
- Pesos (`--hz-fw-*`): 500 en texto (`--hz-fw-texto`, también el peso base de `.hz`), 700 en etiquetas (`--hz-fw-etiqueta`), 800 en títulos y botones (`--hz-fw-titulo`) y 900 en cifras (`--hz-fw-cifra`). Nunca menos de 500: la Montserrat delgada se desvanece sobre negro.

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| `--hz-fs-12` | 12 px | 700 | Solo insignias de una o dos palabras |
| `--hz-fs-14` | 14 px | 500 / 700 | Ayudas, metadatos, etiquetas de campo |
| `--hz-fs-16` | 16 px | 500 | Cuerpo, campos (16 px evita el zoom automático de iOS) |
| `--hz-fs-18` | 18 px | 700 | Pregunta del criterio |
| `--hz-fs-20` | 20 px | 700 | Subtítulos |
| `--hz-fs-h2` | 20 → 24 px | 800 | Títulos de sección |
| `--hz-fs-h1` | 24 → 30 px | 800 | Título de pantalla (`.hz-titulo`), tracking −0,02 em |
| `--hz-fs-25` | 25 px | 900 | Número de la rúbrica |
| `--hz-fs-24` · `--hz-fs-30` · `--hz-fs-32` · `--hz-fs-36` | | 800 / 900 | Cifras |
| `--hz-fs-display` / `--hz-fs-display-2` | 36 → 64 px / 28 → 40 px | 800 | Solo la landing; interlineado 1,05, tracking −0,03 em |
| `--hz-fs-proj-titulo` · `-etiqueta` · `-msg` · `-num` | 20 → 40 · 16 → 28 · 20 → 36 · 24 → 44 px | 700 a 900 | Tablero en proyección (lectura a 6 m en 1920 px) |

- Interlineado: 1,5 en cuerpo, 1,2 en títulos. Medida de lectura del caso: máximo 66 caracteres (`--hz-medida: 34rem`).
- Mayúsculas sostenidas solo en los nombres propios de los proyectos (INSUMEX, NUTRIWHAT), que así vienen de la semilla. Nada de etiquetas en mayúsculas.
- Cifras con `font-variant-numeric: tabular-nums` y coma decimal. Títulos con `text-wrap: balance`.

## 4. Espaciado y retícula

- Escala de 4 px, la misma del IRMI: `--hz-sp-1` 4 · `--hz-sp-2` 8 · `--hz-sp-3` 12 · `--hz-sp-4` 16 · `--hz-sp-5` 20 · `--hz-sp-6` 24 · `--hz-sp-8` 32 · `--hz-sp-10` 40 · `--hz-sp-12` 48 · `--hz-sp-16` 64 · `--hz-sp-24` 96. Entre secciones de la landing, `--hz-sp-seccion` (64 → 128 px).
- Móvil primero: diseño para 360 px de ancho, margen lateral 16 px, contenido a una columna. Desde 600 px el contenido se centra con ancho máximo 34rem; el participante nunca ve dos columnas.
- Zona del pulgar: la acción principal de cada pantalla vive en una barra inferior fija (`.hz-barra-accion`, superficie 1 con borde superior) con 16 px de margen y respeto a `env(safe-area-inset-bottom)`.
- Objetivos táctiles de 48 px mínimo de alto (`--hz-tactil`); 8 px mínimo entre objetivos.

## 5. Radios, bordes y elevación

| Token | Valor | Uso |
|---|---|---|
| `--hz-r-s` | 8 px | Campos |
| `--hz-r-m` | 8 px | Botones, opciones de rúbrica, avisos |
| `--hz-r-l` | 12 px | Hoja de proyecto, tarjetas |
| `--hz-r-pill` | 999 px | Barra de progreso, pestañas, insignias |

Elevación tonal, como el IRMI: lienzo → superficie 1 con borde al 5 % (tarjeta) → superficie 2 (campo, grupo) → superficie 3 (hover, deshabilitado). Sin brillos. Una sola sombra (`--hz-sombra`) para lo que flota: la barra inferior fija.

## 6. Foco, movimiento y accesibilidad

- Foco visible en todo lo interactivo con `:focus-visible`: contorno teal de 2 px separado 2 px (`outline`, se ve también en alto contraste de Windows). La opción de la rúbrica usa 3 px. Los campos de texto suman el borde teal. `--hz-foco` (anillo de lienzo y teal en `box-shadow`) queda para quien lo use como sombra; se ve sobre oscuro y sobre blanco.
- Movimiento solo como respuesta: la opción elegida rellena su arco (150 ms), el botón se hunde a 0,98 al presionarlo y el progreso avanza con `--hz-curva` (250 ms). Con `prefers-reduced-motion: reduce` no hay transiciones.
- Formularios: cada campo con `<label>` visible, error asociado con `aria-describedby` y `aria-invalid`. Los errores no dependen del color.
- Rúbrica: `role="radiogroup"` con `aria-labelledby` a la pregunta; cada opción es un `input type="radio"` nativo, navegable con flechas.
- Pestañas: patrón ARIA `tablist` / `tab` / `tabpanel`, flechas izquierda y derecha, `Inicio` y `Fin`.
- Avisos: `role="status"` para información y éxito; `role="alert"` para error y sin señal.
- Idioma `lang="es-CO"`, separador decimal coma en todas las cifras.

## 7. Componentes base (`web/shared/ui/`)

Todos son componentes React sin dependencias externas, con clases `hz-*` y tokens `--hz-*`. Ningún componente calcula resultados.

### Boton
- Variantes: `primario` (degradado de marca, texto `#0E0E0E` 800; sube 1 px al pasar), `secundario` (superficie 2, borde al 16 %, texto tinta; al pasar, borde y texto teal), `fantasma` (solo texto teal, subrayado al pasar).
- Tamaño único de 48 px de alto, radio 8 px; `bloque` ocupa el ancho completo (por defecto en la barra inferior). Un solo primario por vista.
- Estados: normal, foco, presionado (escala 0,98), deshabilitado plano (`--hz-deshabilitado-*`, sin opacidad, `aria-disabled`), cargando (`aria-busy`, texto cambia a la forma en curso: «Guardando…»).
- El texto dice exactamente lo que pasa: «Guardar calificación», nunca «Enviar».

### Campo
- Etiqueta arriba (14 px, 700, tinta 2), entrada de 48 px y 16 px de texto sobre superficie 2 con borde `--hz-borde-control`, ayuda debajo (14 px, tinta 3), error debajo con icono «!» y texto `--hz-error`.
- Tipos usados: texto (nombre), correo (`inputmode="email"`, `autocomplete="email"`).

### Casilla (consentimiento)
- Casilla de 24 px con área táctil de 48 px; marcada, teal con la palomita oscura. El texto de autorización completo a su lado, con el enlace a la política. Sin aceptar, el botón «Inscribirme» queda deshabilitado y se explica por qué.

### Rubrica (tarjeta de rúbrica seleccionable 9-7-5-3-1)
- Encabezado: nombre del criterio (14 px, 700, tinta 2) y pregunta (18 px, 700).
- Cinco opciones en orden 9, 7, 5, 3, 1, cada una en una fila con separador: arco de horizonte a la izquierda (40 × 40 px, radio proporcional al valor), número grande (900), texto completo de la rúbrica. El texto nunca se trunca.
- Elegida: tinte teal, borde teal de 1,5 px con barra lateral de 4 px, número en teal, texto en 700, arco relleno de teal con trazo azul, marca «Elegida» para lectores de pantalla.
- Sin elegir en un intento de guardar: borde de la pregunta en `--hz-error` y mensaje «Elige una opción para este criterio».

### Pestanas
- Dos o tres pestañas en píldora sobre superficie 1 con borde; la activa en superficie 3 con texto tinta 800 y borde teal suave. En la R2, «Hojas» sustituye a «Tu hoja».

### BarraProgreso
- Pista superficie 3, relleno con el degradado de marca, 8 px de alto, con texto visible «5 de 7 completaron» y `role="progressbar"` con `aria-valuenow`, `aria-valuemax` y `aria-valuetext`.

### Aviso
- Tonos: `info` (teal sobre `#13262F`), `ok`, `alerta`, `error`. Borde al 9 % y filo izquierdo de 4 px del color del tono. Icono simple (símbolo oscuro sobre el color), título opcional en 700, texto en tinta. Opcional una acción (botón fantasma), por ejemplo «Reintentar».

### Insignia
- Píldora pequeña de 12 px, 700, para estados cortos: «Preliminar», «Guardado», «Pendiente», «Ronda 2». R1 hueca y R2 sólida (§2.3).

### EncabezadoHorizonte
- Barra superior con el nombre de la sala (tinta, 700), la mesa y el perfil, más los tres arcos H1, H2, H3 en grafito (`aria-hidden`).

### Landing (`web/inicio/`)
- Título en `--hz-fs-display` y tinta; secciones que alternan lienzo y superficie 1/2 con borde al 5 %. Un primario por vista («Entrar a mi mesa»); «Ingresar al panel» es secundario. La matriz ilustrada usa superficies grafito con las curvas de horizonte en `--hz-azul-medio`, fijos en tinta 3 y R1/R2 con sus colores.

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
- 409 `CORREO_YA_INSCRITO`: no es error. Aviso info: "Ya estabas inscrito con este correo. Retomas donde ibas." y entra.
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
- Muestra el tablero del alcance (componente de T3) bajo el título **Resultados en vivo de {tu mesa | la sala}** con la insignia "Preliminar". Si aún no hay votos en el alcance: "Todavía no hay calificaciones en {tu mesa | la sala}. Los puntos aparecen con el primer voto."

### 8.11 Precierre (derivado, `progreso_mesa.precierre = true` o sala en precierre)
- Aviso alerta fijo arriba: título **Todos votaron en {Mesa N}**, texto "Este es un resultado preliminar. El facilitador cerrará la ronda; hasta entonces puedes editar tus calificaciones."
- Debajo, el resultado del alcance con la insignia "Preliminar". Si el precierre desaparece (alguien nuevo se inscribe), el aviso se retira y se vuelve a 8.9.

### 8.12 Ronda cerrada (`r1_cerrada`, `r2_cerrada`)
- Título: **Ronda {n} cerrada**
- Texto R1: "Este es el resultado de {tu mesa | la sala}. Discútanlo en la mesa antes de la ronda 2."
- Texto R2: "Así se movieron INSUMEX y NUTRIWHAT de la ronda 1 a la ronda 2 en {tu mesa | la sala}."
- Resultado del alcance (matriz y promedios por criterio, componente de T3). Nunca respuestas individuales ni nombres.

### 8.13 Sala cerrada (`cerrada`)
- Título: **El taller terminó**
- Texto: "Gracias por participar. Este es el resultado final de {tu mesa | la sala}." + resultado de la R2 (o de la R1 si no hubo R2).

### 8.14 Sin señal
- Si una petición falla por red o el polling falla 2 veces seguidas: aviso alerta fijo arriba, **Sin conexión**, "Seguimos intentando. Lo que marcaste está guardado en este celular." El polling sigue con espera creciente hasta 10 s; al volver: aviso ok "Conexión recuperada." durante 3 s.
- Un guardado que falla por red deja el botón en **Reintentar guardado** y conserva lo marcado.

### 8.15 Sesión no válida (401 o token desconocido)
- Título: **Tu sesión ya no está activa**
- Texto: "Inscríbete otra vez con el mismo correo y retomas donde ibas." Botón **Volver a inscribirme** (borra el token local).

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
