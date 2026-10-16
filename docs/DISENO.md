# Sistema de diseño · Horizontes (participante)

Dueña: T2. Fuente de los tokens en código: `web/shared/ui/tokens.css`. Si este documento y el CSS no coinciden, manda el CSS y se corrige este documento en la misma ronda.
Muestra viva: `/m/_ui` (todos los componentes base en 360 px).

## 1. Idea de diseño

**Sujeto.** Un taller presencial: 30 a 40 personas en mesas, con el celular en la mano, leyendo un caso y calificando dos proyectos mientras discuten. El celular es una herramienta de trabajo de mesa, no una app de consumo. La pantalla se mira de reojo, se suelta y se vuelve a tomar.

**Lo memorable: el horizonte.** La matriz del tablero dibuja los horizontes como cuartos de círculo (radio 4,5 y 9). En el celular usamos esa misma geometría como única firma visual:
- Cada opción de la rúbrica lleva un **arco de horizonte**: un cuarto de círculo cuyo radio crece con el valor (1 = arco pequeño pegado a la esquina, 9 = arco amplio). Quien califica ve, sin leer el número, que 9 es "más lejos del core, más incierto" y 1 "más cerca". Es la misma lectura que tendrá la matriz.
- El encabezado de la pantalla lleva los tres arcos H1, H2, H3 en azules claros, recortados en la esquina superior derecha. Nada más decora.

**Todo lo demás, sobrio.** Fondo blanco, texto azul tinta, un solo color de acción. Sin degradados decorativos, sin sombras grises repetidas, sin etiquetas en mayúsculas sostenidas, sin flechas pegadas a los botones.

**Revisión contra los clichés.** Primer borrador: tarjetas redondeadas iguales con sombra suave para todo (el kit SaaS). Lo cambiamos: la rúbrica es una lista con separadores, no un mosaico de tarjetas; solo la opción elegida gana fondo y borde. La única "tarjeta" con elevación es la hoja de proyecto activa. Los radios cambian según jerarquía (ver §5).

## 2. Color

| Token | Hex | Rol | Contraste |
|---|---|---|---|
| `--hz-azul` | `#1C4587` | Azul Estratek. Acción primaria, títulos, foco | 9,3:1 sobre blanco |
| `--hz-azul-medio` | `#3F7CC8` | Borde de selección, barras, arcos activos | 4,3:1 sobre blanco (no para texto pequeño) |
| `--hz-cielo` | `#00A3FF` | Acento de rúbrica: anillo exterior del foco, arco de la opción elegida | 2,7:1, solo decorativo y siempre junto a un indicador AA |
| `--hz-tinta` | `#0F2340` | Texto principal | 15,7:1 |
| `--hz-tinta-2` | `#3A4D6B` | Texto secundario | 8,6:1 |
| `--hz-tinta-3` | `#5B6B84` | Metadatos, ayudas | 5,4:1 |
| `--hz-fondo` | `#FFFFFF` | Fondo de página | |
| `--hz-h1` | `#EEF4FB` | Horizonte 1. Fondo de superficie suave, pestañas inactivas | |
| `--hz-h2` | `#DCE8F6` | Horizonte 2. Fondo de la opción elegida, pista de la barra | |
| `--hz-h3` | `#C5D8EF` | Horizonte 3. Bordes y separadores | |
| `--hz-ok` | `#1D6B4F` / fondo `#E6F4EE` | Voto guardado, completo | 5,7:1 sobre su fondo |
| `--hz-alerta` | `#7A4B00` / fondo `#FFF4DC` | Sin señal, precierre, ronda por cerrar | 6,8:1 sobre su fondo |
| `--hz-error` | `#A3261B` / fondo `#FDECEA` | Errores de campo y de envío | 6,4:1 sobre su fondo |

Reglas: el color nunca es el único portador de significado (siempre texto o icono). El azul medio y el cielo no se usan para texto de menos de 18,66 px negrita.

## 3. Tipografía

- Familia única: **Montserrat** (variable, autoalojada con `@fontsource-variable/montserrat`, la misma del IRMI). Respaldo: `system-ui, -apple-system, 'Segoe UI', sans-serif`.
- Escala base 16 px, razón 1,25 (tercera mayor), redondeada a píxeles enteros:

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| `--hz-fs-12` | 12 px | 600 | Solo insignias de una o dos palabras |
| `--hz-fs-14` | 14 px | 500 | Ayudas, metadatos, texto de la rúbrica secundario |
| `--hz-fs-16` | 16 px | 400 | Cuerpo, campos (16 px evita el zoom automático de iOS) |
| `--hz-fs-18` | 18 px | 600 | Pregunta del criterio |
| `--hz-fs-20` | 20 px | 700 | Títulos de sección |
| `--hz-fs-25` | 25 px | 800 | Título de pantalla |
| `--hz-fs-32` | 32 px | 800 | Número de la rúbrica elegida, cifras grandes |

- Interlineado: 1,5 en cuerpo, 1,2 en títulos. Medida de lectura del caso: máximo 66 caracteres (`--hz-medida: 34rem`).
- Mayúsculas sostenidas solo en los nombres propios de los proyectos (INSUMEX, NUTRIWHAT), que así vienen de la semilla. Nada de etiquetas en mayúsculas.
- Cifras con `font-variant-numeric: tabular-nums` en progreso y promedios.

## 4. Espaciado y retícula

- Escala de 4 px: `--hz-sp-1` 4 · `--hz-sp-2` 8 · `--hz-sp-3` 12 · `--hz-sp-4` 16 · `--hz-sp-5` 20 · `--hz-sp-6` 24 · `--hz-sp-8` 32 · `--hz-sp-10` 40 · `--hz-sp-12` 48.
- Móvil primero: diseño para 360 px de ancho, margen lateral 16 px, contenido a una columna. Desde 600 px el contenido se centra con ancho máximo 34rem; el participante nunca ve dos columnas.
- Zona del pulgar: la acción principal de cada pantalla vive en una barra inferior fija (`.hz-barra-accion`) con 16 px de margen y respeto a `env(safe-area-inset-bottom)`.
- Objetivos táctiles de 48 px mínimo de alto; 8 px mínimo entre objetivos.

## 5. Radios, bordes y elevación

| Token | Valor | Uso |
|---|---|---|
| `--hz-r-s` | 6 px | Campos, insignias |
| `--hz-r-m` | 10 px | Botones, opciones de rúbrica, avisos |
| `--hz-r-l` | 16 px | Hoja de proyecto, hojas inferiores |
| `--hz-r-pill` | 999 px | Barra de progreso, pestañas |

Bordes de 1 px en `--hz-h3`; 2 px en `--hz-azul-medio` para lo seleccionado. Una sola sombra (`--hz-sombra`: `0 1px 2px rgba(15,35,64,.08), 0 8px 24px rgba(15,35,64,.08)`) y solo para la barra inferior fija y la hoja activa.

## 6. Foco, movimiento y accesibilidad

- Foco visible en todo lo interactivo con `:focus-visible`: contorno de 3 px `--hz-azul` con separación de 2 px y anillo exterior de 2 px `--hz-cielo` (`box-shadow`). Funciona sobre blanco y sobre `--hz-h2`.
- Movimiento solo como respuesta: la opción elegida rellena su arco (160 ms) y el aviso de guardado entra desde abajo (200 ms). Con `prefers-reduced-motion: reduce` no hay transiciones.
- Formularios: cada campo con `<label>` visible, error asociado con `aria-describedby` y `aria-invalid`. Los errores no dependen del color.
- Rúbrica: `role="radiogroup"` con `aria-labelledby` a la pregunta; cada opción es un `input type="radio"` nativo, navegable con flechas.
- Pestañas: patrón ARIA `tablist` / `tab` / `tabpanel`, flechas izquierda y derecha, `Inicio` y `Fin`.
- Avisos: `role="status"` para información y éxito; `role="alert"` para error y sin señal.
- Idioma `lang="es-CO"`, separador decimal coma en todas las cifras.

## 7. Componentes base (`web/shared/ui/`)

Todos son componentes React sin dependencias externas, con clases `hz-*` y tokens `--hz-*`. Ningún componente calcula resultados.

### Boton
- Variantes: `primario` (fondo azul, texto blanco), `secundario` (borde azul, texto azul, fondo blanco), `fantasma` (solo texto azul subrayado al pasar).
- Tamaño único de 48 px de alto; `bloque` ocupa el ancho completo (por defecto en la barra inferior).
- Estados: normal, foco, presionado (fondo `#163869`), deshabilitado (fondo `--hz-h2`, texto `--hz-tinta-3`, `aria-disabled`), cargando (`aria-busy`, texto cambia a la forma en curso: "Guardando…").
- El texto dice exactamente lo que pasa: "Guardar calificación", nunca "Enviar".

### Campo
- Etiqueta arriba (14 px, 600), entrada de 48 px y 16 px de texto, ayuda debajo (14 px), error debajo con icono "!" y texto `--hz-error`.
- Tipos usados: texto (nombre), correo (`inputmode="email"`, `autocomplete="email"`).

### Casilla (consentimiento)
- Casilla de 24 px con área táctil de 48 px; el texto de autorización completo a su lado, con el enlace a la política. Sin aceptar, el botón "Inscribirme" queda deshabilitado y se explica por qué.

### Rubrica (tarjeta de rúbrica seleccionable 9-7-5-3-1)
- Encabezado: nombre del criterio (14 px, `--hz-tinta-2`) y pregunta (18 px, 600).
- Cinco opciones en orden 9, 7, 5, 3, 1, cada una en una fila: arco de horizonte a la izquierda (40 × 40 px, radio proporcional al valor), número grande, texto completo de la rúbrica. El texto nunca se trunca.
- Elegida: fondo `--hz-h2`, borde 2 px `--hz-azul-medio`, arco relleno en `--hz-cielo` con trazo `--hz-azul`, marca "Elegida" para lectores de pantalla.
- Sin elegir en un intento de guardar: borde de la pregunta en `--hz-error` y mensaje "Elige una opción para este criterio".

### Pestanas
- Dos o tres pestañas en píldora sobre `--hz-h1`; la activa en blanco con texto azul y 700. En la R2, "Hojas" sustituye a "Tu hoja".

### BarraProgreso
- Pista `--hz-h2`, relleno `--hz-azul-medio`, 8 px de alto, con texto visible "5 de 7 completaron" y `role="progressbar"` con `aria-valuenow`, `aria-valuemax` y `aria-valuetext`.

### Aviso
- Tonos: `info`, `ok`, `alerta`, `error`. Icono simple, título opcional en 600, texto. Opcional una acción (botón fantasma), por ejemplo "Reintentar".

### Insignia
- Píldora pequeña de 12 px, 600, para estados cortos: "Preliminar", "Guardado", "Pendiente", "Ronda 2".

### EncabezadoHorizonte
- Barra superior con el nombre de la sala, la mesa y el perfil, más los tres arcos H1, H2, H3 decorativos (`aria-hidden`).

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
