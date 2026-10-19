# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones con [SemVer](https://semver.org/lang/es/).

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

[1.0.0]: https://github.com/yennyporras/horizontes/releases/tag/v1.0.0
