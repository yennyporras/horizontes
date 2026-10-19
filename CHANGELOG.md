# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones con [SemVer](https://semver.org/lang/es/).

## [1.1.0] · 2026-10-19

Cambios pedidos por Paola tras la prueba en staging y acordados en la preentrega del 19-oct con Sebastian y Nicolai.

### Agregado
- Una pregunta por pantalla en el celular, con dos modos por sala: automático (pasa sola al responder) y guiado (el facilitador elige y avanza la pregunta desde el panel; el tablero la muestra en grande).
- «Tu calificación» junto a cada promedio en el celular. Las respuestas de cada persona solo las ve el admin en la sección nueva «Respuestas».
- Apertura y cierre programados para la sala, la ronda 1 y la ronda 2, con títulos y descripciones claros.
- Tablero: la matriz sola por defecto (clic o tecla M para ver u ocultar los datos), zoom vectorial (botones, rueda, pellizco y teclas) y una explicación breve de los ejes, sin pesos.
- Panel: aviso si `BASE_URL` no coincide con el dominio desde el que se abre (QR con el dominio equivocado), ayuda de una mesa por cada 6 personas y nota para imprimir el QR de cada mesa.

### Cambiado
- Sistema visual de Estratek, igual al del IRMI: lienzo oscuro, teal y degradado de marca, Montserrat de 500 a 900, con contraste AA en todas las vistas.
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

[1.1.0]: https://github.com/yennyporras/horizontes/releases/tag/v1.1.0
[1.0.0]: https://github.com/yennyporras/horizontes/releases/tag/v1.0.0
