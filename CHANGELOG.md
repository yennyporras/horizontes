# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones con [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

Auditoría final del 20-oct (una sola apariencia clara) y QA por roles del 20-oct (inversionista, jurado, empresa cliente, facilitador, participante, editora, CEO y CTO).

### Agregado
- Ronda 1 sin resultados en vivo (decisión de Paola): mientras la ronda 1 está abierta, el tablero y los celulares muestran solo cuántos votaron; los promedios y las burbujas de R1 aparecen cuando todo el alcance votó o al cerrar la ronda. El panel sí ve el preliminar. La ronda 2 sigue en vivo de 3 en 3.
- Convergencia R1 → R2 calculada en el servidor: dispersión por proyecto y ronda, cuánto se redujo, el criterio que más cambió y el movimiento en cada eje, más el promedio del alcance. El tablero la dice en palabras.
- `resultados.csv` sin datos personales (promedios, t2m y ejes por alcance, ronda y proyecto, solo con 3 votos o más): el archivo que se le puede entregar al cliente.
- Salas con tipo (taller o ensayo), empresa cliente y sector. Duplicar crea un ensayo. Cifras del negocio en Salas (talleres, personas, quiénes completaron la ronda 2 y países, sin ensayos) y resumen del taller en el detalle (minutos de cada ronda, completitud y accesos de nuevo).
- Modo demo para la cuenta superadministradora: una sala «Demostración» que se juega sola en cerca de un minuto, con 24 personas de ejemplo.
- `npm run admin:restablecer` para recuperar la cuenta superadministradora si se pierde su clave.
- Celular: el caso abre con el aviso de caso ficticio y los 2 proyectos que se califican; pregunta compacta con la lectura de la escala bajo la pregunta; «Leer mi hoja»; cierre personal al final.
- Tablero: matriz legible a 6 m (nombres pegados a su burbuja, extremos de los ejes, flecha visible) y marcas en «Cómo votó». Panel: descargar la matriz como SVG.
- Landing: imagen para compartir de 1200x630 (og:image y twitter:card), horizontes explicados, bloque comercial y pasos con número y pictograma. README en formato vitrina.

### Cambiado
- Una sola apariencia en toda la app: fondo claro con la barra superior carbón y la línea del degradado (landing y tablero dejan el tema carbón).
- Aviso de datos `hz-1.2`, fiel a lo que pasa: nombra todos los datos que se guardan (también IP, país y navegador), para qué, quién ve qué (el equipo que facilita sí ve las calificaciones con el nombre) y, en Perú, que los datos se guardan fuera del país. «Inscribirme» siempre activo.
- Descripciones de criterio con los dos polos de la escala y nombres cortos únicos en todas las tablas.
- Tablero: modos **Gráfica** y **Detallado** (antes «En vivo» y «Con tabla»), tecla V para «Cómo votó».
- Panel: menú en el orden del taller y «Guía de uso» en lugar de «Recorrido»; la clave pide el mismo mínimo que el servidor; regla única del usuario admin (3 a 30 caracteres) compartida con el servidor.
- QR de las mesas en carbón. Mensajes del servidor con artículo y tildes («No se puede abrir la inscripción: …», «Ese proyecto no se califica en esta sala.»).
- `docs/DESPLIEGUE.md` reescrito para SQLite, con «Caída en pleno taller» y «Restaurar un respaldo» paso a paso.

### Corregido
- El panel ya no arma el detalle de la sala en cada consulta si no cambió (304 con ETag).
- `robots.txt` deja leer la imagen para compartir y el ícono a las vistas previas de LinkedIn y X.
- Celular: precierre del alcance de resultados, «Tú» en las dos rondas de la comparación, textos que dicen lo que pasa y espacio final medido del pie fijo.
- Tablero: subtítulo del eje X dentro de la matriz angosta y leyenda de Todas las mesas en letra de proyector. Panel: diagramación de las secciones de 360 a 1920 px.
- Dockerfile sin `curl` ni carpetas sobrantes.

## [1.2.0] · 2026-10-20

Auditoría de calidad y seguridad del 20-oct, pedidos de Nicolai para el proyector y pedidos de Paola sobre la marca y el panel.

### Agregado
- Tablero con dos modos de proyección, a elegir por evento: **En vivo** (solo la matriz moviéndose a toda la pantalla) y **Con tabla** (matriz, progreso y promedios). Se eligen en el encabezado, con las teclas V y T o desde «Ver en vivo» en el panel (`?modo=vivo|tabla`): «En vivo, solo la gráfica» y «Con tabla».
- Pantalla completa del modo elegido, sin controles (botón o tecla F). Reemplaza el zoom por porcentaje.
- Descripción corta de cada criterio (100 caracteres como máximo) en las tablas del tablero, del celular y del panel.
- Logo de Horizontes (el sol sobre la línea del horizonte) y favicon. La marca lleva al inicio; en el panel y en el tablero del facilitador, a Salas.
- Recorrido guiado para administradores: qué se hace en cada sección y qué esperar. Se abre solo la primera vez y después con el botón «Recorrido».
- «Dar acceso de nuevo» en Participantes: enlace personal de un solo uso que vence en 15 minutos, con QR y enlace para copiar.
- Vista previa del celular desde el panel, solo para mirar (no inscribe ni vota).
- Ancho de página común de 1280 px: encabezado, contenido y pie alineados en la landing, el celular y el panel.
- Servidor: compresión gzip y brotli, caché de un año para los archivos con hash, healthcheck que consulta la base y respaldos por sala.

### Cambiado
- Resultados en vivo como fotos que se renuevan cada 3 votos nuevos; al cerrar la ronda queda el exacto. Así nadie deduce un voto individual comparando dos actualizaciones.
- Se acaba la recuperación de la sesión con solo el correo: la da el facilitador con «Dar acceso de nuevo».
- Panel: un solo botón principal con el paso que sigue, «Corregir» aparte, confirmaciones con el foco en Cancelar, bitácora legible y «Ver en vivo» como único lugar con los accesos a tableros y vista previa.
- Códigos de mesa con un sufijo al azar, más difíciles de adivinar.
- Cada área de la app se descarga aparte: el celular ya no baja el código del panel ni del tablero.

### Corregido
- Más de 60 hallazgos de la QA del celular, el tablero y el panel, y de la auditoría del servidor y del frontend. Entre ellos: votos del modo guiado que no se reintentaban, sesión vencida del panel que no llevaba al login, doble clic que creaba mesas dos veces, fechas mal formadas que cerraban la ronda, límite de peticiones que se evitaba codificando la URL y errores 500 con datos inválidos.
- Concordancia «Hacen falta al menos 3 votos» en todas las vistas.
- El simulador del panel y sus datos de ejemplo ya no se publican en producción.

### Seguridad
- `@fastify/static` 10 por los avisos de `npm audit`. Cambiar la clave cierra las demás sesiones del admin. El token del tablero tiene una sola fuente (`token_tablero`, en claro porque el panel vuelve a mostrar el enlace), se compara en tiempo constante y se puede cambiar desde «Ver en vivo»; el hash que había al lado no protegía nada y quedó vacío (migración 7). Esta línea decía antes, por error, que se guardaba solo como hash.

## [1.1.0] · 2026-10-19

Cambios pedidos por Paola tras la prueba en staging y acordados en la preentrega del 19-oct con Sebastian y Nicolai.

### Agregado
- Una pregunta por pantalla en el celular, con dos modos por sala: automático (pasa sola al responder) y guiado (el facilitador elige y avanza la pregunta desde el panel; el tablero la muestra en grande).
- «Tu calificación» junto a cada promedio en el celular. Las respuestas de cada persona solo las ve el admin en la sección nueva «Respuestas».
- Apertura y cierre programados para la sala, la ronda 1 y la ronda 2, con títulos y descripciones claros.
- Tablero: la matriz sola por defecto (clic o tecla M para ver u ocultar los datos), zoom vectorial (botones, rueda, pellizco y teclas) y una explicación breve de los ejes, sin pesos.
- Panel: aviso si `BASE_URL` no coincide con el dominio desde el que se abre (QR con el dominio equivocado), ayuda de una mesa por cada 6 personas y nota para imprimir el QR de cada mesa.

### Cambiado
- Línea gráfica de la familia Estratek (`docs/marca/FAMILIA_ESTRATEK.md`) con la paleta exacta de estratek.com.co: carbón #141414, hielo #DCECFF, azul #3487FF, verde agua #00CDA1, violeta #442AAF y el degradado de marca. Landing y proyector en carbón; celular y panel en claro con barra carbón. Encabezado «Horizontes por Estratek »», logo oficial y contraste AA medido en los dos temas.
- Se quita la fila «Total» de todas las vistas (Sebastian, preentrega). La API conserva el campo por compatibilidad.

### Corregido
- Un admin que nunca había abierto una sala llegaba a una pantalla vacía en cada sección del panel; ahora puede elegir la sala desde ahí.

## [1.0.0] · 2026-10-19

Primera versión para producción.

### Agregado
- Landing pública en `/`: qué es el taller, cómo funciona, qué se evalúa, entrada con el código de la mesa, acceso al panel y privacidad. Solo la landing se indexa (`X-Robots-Tag` y `robots.txt`).
- Flujo del participante en el celular: inscripción con consentimiento, caso Foodsume, hoja por perfil (6 perfiles), votación de 2 proyectos en 6 criterios (escala 1-3-5-7-9), resultados en vivo y comparación R1→R2.
- Tablero para proyector: matriz de burbujas con 8 proyectos fijos, movimiento R1 (verde, hueco) → R2 (rojo, sólido), franja de fase, tabla de criterios con fila «Total» y vista de todas las mesas.
- Panel del facilitador: salas, mesas y QR, rondas y precierre, cierres programados, visibilidad, país y zona horaria por sala, participantes, administradores, exportes y bitácora de la sala.
- Rúbricas editables por el admin mientras la sala no tiene votos, con opción de aplicarlas a las salas nuevas.
- Motor en el servidor: t2m, eje X, eje Y y total (eje X + eje Y), con golden al 100 %.
- Anonimato: mínimo de 3 votos por mesa o sala para mostrar resultados; la identidad y la IP solo las ve el admin.
- Aviso de datos `hz-1.1` según el país de la sala (Colombia, Perú y Guatemala).
- Despliegue con Docker en Coolify (`tools/deploy.sh`), respaldos automáticos de la sala, simulador de carga y ensayo de taller.
- Plan B: plantilla Excel y papeleta imprimible.
- CI en GitHub Actions: typecheck, pruebas (incluidas en navegador), build y construcción de la imagen.

### Cambiado
- Decisiones del acta del 16-oct: la tabla de resultados muestra los 6 criterios y «Total» (sin Time to Market, Eje X, Eje Y ni Votos); las salas nuevas muestran por defecto el consolidado de toda la sala tras votar.

[1.2.0]: https://github.com/yennyporras/horizontes/releases/tag/v1.2.0
[1.1.0]: https://github.com/yennyporras/horizontes/releases/tag/v1.1.0
[1.0.0]: https://github.com/yennyporras/horizontes/releases/tag/v1.0.0
