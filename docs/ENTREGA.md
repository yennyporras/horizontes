# Entrega · Horizontes

Qué recibe Estratek, dónde está, qué falta y qué hace Paola para ponerlo en producción. Estado al cierre del 20-oct: versión 1.3.0 en producción y staging (acta del 16-oct, preentrega del 19-oct, auditoría final y QA por roles del 20-oct).

## 1. Qué es
App web del taller "Portafolio por Horizontes" (caso Foodsume). Los participantes se inscriben con el QR de su mesa, leen el caso y su hoja de perfil, califican INSUMEX y NUTRIWHAT en 6 criterios (1, 3, 5, 7, 9) en 2 rondas (R1 individual y en silencio, R2 con discusión), y la matriz de burbujas muestra cómo se mueven sobre 8 proyectos fijos: R1 en verde y R2 en rojo.

## 2. Dónde vive
| Qué | Dónde | Estado |
|---|---|---|
| Código | `github.com/yennyporras/horizontes` (rama `main`) | Arriba. Pasa a la cuenta de Estratek: `docs/MIGRACION_GITHUB.md` |
| Producción | `https://horizontes.estratek.com.co` → luego `https://horizontes.com.co` | v1.3.0 desde el 20-oct (`8a32559`), verificada desde fuera. Se despliega a mano desde Coolify |
| Staging | `https://staging-horizontes.estratek.com.co` | v1.3.0; sigue a `main` |
| Servidor | Coolify en el VPS de Hostinger, 1 contenedor, SQLite en el volumen `/data` | Imagen probada en local (`tools/deploy.sh local`) |

Rutas de la app (en cualquier dominio): `/admin` (panel), `/m/{código de mesa}` (celular, lo abre el QR), `/tablero/{sala}?t=...` (proyector, el enlace sale del panel).

## 3. Accesos (sin claves en este archivo)
- **Superadmin:** usuario `paola`. La clave inicial la elige Paola y va solo en Coolify (variable `SUPERADMIN_CLAVE` de cada app) o en `deploy/.env.deploy` (`SUPERADMIN_CLAVE_STAGING` y `SUPERADMIN_CLAVE_PROD`), nunca en git. Cuenta solo la primera vez que arranca una base vacía; después se cambia desde el panel.
- **Administradores:** Paola los crea en el panel (**Administradores** → *Nuevo administrador*, con clave temporal). Cada uno cambia su clave en el primer ingreso. Un admin normal no ve la gestión de administradores.
- **Coolify y Hostinger:** cuenta de Paola.
- **Tablero:** cada sala tiene su enlace con token; se abre desde **Sala en vivo** → **Proyectar el tablero** → *Tablero de la sala*, en el modo *Gráfica* (solo la matriz moviéndose) o *Detallado* (con el progreso y los promedios).

## 4. Qué está listo
- Inscripción con aviso de datos según el país de la sala (Colombia: Ley 1581 de 2012; Perú: Ley 29733; Guatemala: política de Estratek), versión `hz-1.3`. Sin autorización no hay inscripción.
- Votación 1-3-5-7-9 en 6 criterios, 2 rondas, precierre cuando todos votan, cierres programados en la hora del país de la sala.
- Resultados anónimos: tablas con los 6 criterios y su descripción corta (sin fila «Total» desde la preentrega del 19-oct); mínimo de 3 votos para mostrar un alcance; con la ronda abierta, el resultado se renueva cada 3 votos nuevos y al cerrarla queda el exacto; por defecto toda la sala ve el consolidado apenas vota.
- Tablero con dos modos de proyección, *Gráfica* (solo la matriz) y *Detallado* (con progreso y promedios), y pantalla completa con F.
- Recuperar la sesión: la da el facilitador con *Dar acceso de nuevo* en **Participantes** (enlace de un solo uso, 15 minutos). Nadie entra solo con el correo.
- Guía de uso para administradores, un paso por sección en el orden del menú (primera visita y botón *Guía de uso*). El menú sigue el orden del taller: preparar, conducir, después y sistema.
- «Cómo votó la sala» (o la mesa): cuántos votos tuvo cada valor 1, 3, 5, 7 y 9 por criterio, en R1 y R2, en el tablero (botón *Cómo votó* o tecla **V**) y en **Sala en vivo** del panel. Es lo que alimenta la conversación de la plenaria.
- Registro interno solo para el admin: país e IP de cada inscripción y voto en el panel y en `inscritos.csv` / `votos.csv`.
- Panel: salas, duplicar para ensayo, mesas y QR (hoja A4 imprimible), participantes, **hojas de los 6 perfiles** (solo lectura), configuración (visibilidad, país, zona horaria, cierres, rúbricas), exportar, administradores, salud.
- Plan B en papel y Excel (`docs/PLAN_B.md`), guía del facilitador de una página (`docs/GUIA_FACILITADOR.md`).

## 5. Lo que hace Paola, en orden

### 5.1 Antes de producción (hecho el 19-oct, queda como referencia)
Paola dice que `horizontes-staging` ya existe en Coolify. Comprobado el 19-oct a las 14:35: el DNS de `staging-horizontes.estratek.com.co` ya apunta al VPS, pero `https://staging-horizontes.estratek.com.co/api/health` responde **503 con un certificado no válido** y por HTTP **404**. Eso es el proxy de Coolify diciendo que no tiene una app sana detrás de ese dominio. Por eso el orden es: primero staging en verde, después producción clonándolo.

1. **Texto legal.** Lee los tres textos de autorización (CO, PE, GT) en `docs/CONSENTIMIENTO.md` y confirma o corrige. Confirma también en qué país está el VPS (Hostinger → **VPS** → **Resumen** → ubicación): si no es Colombia, avisa para agregar el párrafo de transferencia internacional.
2. **Revisar staging en Coolify** (Projects → `Horizontes` → `staging` → `horizontes-staging`):
   - **Configuration** → **General** → **Domains** = `https://staging-horizontes.estratek.com.co` (con `https://`, sin `/` final). *Build Pack* `Dockerfile`, *Dockerfile Location* `/deploy/Dockerfile`, *Base Directory* `/`, *Ports Exposes* `3000`. **Save**.
   - **Configuration** → **Healthcheck**: activo, *Path* `/api/health`, *Port* `3000`, intervalo 30 s, timeout 10 s, 3 reintentos, *Start Period* 60 s. Ojo: si la app se creó copiando la del IRMI, ahí dice `/api/v1/health` y el contenedor nunca queda sano (eso da justo el 503). **Save**.
   - **Persistent Storage**: un *Volume Mount* `horizontes-datos-staging` en `/data`. Si no está: **+ Add** → *Volume Mount* con ese nombre y *Destination Path* `/data`.
   - **Environment Variables**: al menos `BASE_URL` = `https://staging-horizontes.estratek.com.co`, `SUPERADMIN_USUARIO` = `paola`, `SUPERADMIN_CLAVE` (la que elijas, 12 caracteres o más), `TRUST_PROXY_HOPS` = `1`, `POLITICA_PRIVACIDAD_URL` = `https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/`. Tabla completa en `docs/DESPLIEGUE.md` §2.5.
   - **Deploy** y luego **Deployments**: el último debe terminar en *Finished* y el estado de la app en **Running (healthy)**. Si queda *unhealthy* o reinicia, abre **Logs**: la primera línea con `ERROR` dice la causa (`EACCES` en `/data`: ver `docs/DESPLIEGUE.md` §5).
   - Comprueba desde tu equipo: `curl -fsS https://staging-horizontes.estratek.com.co/api/health` responde `{"ok":true,...}` y el navegador muestra el candado válido en `/admin` (el certificado sale solo cuando la app queda sana; si no, **Redeploy**).
3. **Prueba en staging (10 min).** Entra a `https://staging-horizontes.estratek.com.co/admin` con `paola`, cambia la clave, crea una sala de 2 mesas, elige el país, escanea un QR con el celular, inscríbete, vota, mira el tablero y cierra la sala.
4. **Producción clonando staging.** En `horizontes-staging` → **Resource Operations** → *Clone* al ambiente `production` (créalo antes en el proyecto si no existe). En la copia, que se llamará `horizontes-prod`:
   - **Domains** = `https://horizontes.estratek.com.co`.
   - **Environment Variables**: `APP_ENV` = `production`, `BASE_URL` = `https://horizontes.estratek.com.co`, `SUPERADMIN_CLAVE` distinta a la de staging.
   - **Persistent Storage**: cambia el volumen a `horizontes-datos-prod` en `/data`. Nunca compartas el volumen con staging.
   - **Advanced**: apaga *Auto Deploy*.
   - **Save** y **Deploy**. Igual que en staging: *Running (healthy)* y `curl -fsS https://horizontes.estratek.com.co/api/health`.
5. **DNS de producción.** Si `nslookup horizontes.estratek.com.co` no da la IP del VPS: Hostinger → **Dominios** → `estratek.com.co` → **DNS / Nameservers** → **Registros DNS** → `A`, nombre `horizontes`, valor la IP del VPS (la misma que ya responde para `staging-horizontes`), TTL `3600`. No toques los demás registros (el correo depende de ellos).
6. **Respaldo diario.** Coolify → `horizontes-prod` → **Scheduled Tasks** → **+ Add**: frecuencia `0 8 * * *` y el comando de `deploy/README.md` (sección "Respaldo de SQLite").
7. **Cuentas.** En `https://horizontes.estratek.com.co/admin`: cambia la clave del superadmin y crea los administradores (por ejemplo Nicolai) en **Administradores**.
8. **Opcional, para desplegar con un comando en adelante.** Coolify → **Keys & Tokens** → **API tokens** → *Create New Token* (`read`, `write`, `deploy`). Copia `deploy/env.deploy.ejemplo` a `deploy/.env.deploy` y llena `COOLIFY_URL`, `COOLIFY_TOKEN`, `COOLIFY_APP_STAGING` y `COOLIFY_APP_PROD` (el UUID es el último tramo de la URL de cada app en Coolify). Desde ahí: `tools/deploy.sh diagnostico staging` dice qué falta, y `tools/deploy.sh staging` / `tools/deploy.sh produccion` publican. Este archivo no se sube a git.

### 5.2 Para el taller
9. **Sala real.** Panel → **Salas** → nombre del taller y número de mesas → **Crear sala** → **Configuración** → país.
10. **QR de las mesas en A4 (PDF).** Panel → sala → **Mesas y QR** → *Imprimir los QR* → destino "Guardar como PDF", tamaño A4, márgenes predeterminados. Sin abrir el navegador, desde el repo (cuando el dominio ya responda):
    ```sh
    HZ_ADMIN_CLAVE='<tu clave>' node QA-tests/hoja_qr_pdf.cjs https://horizontes.estratek.com.co paola <CÓDIGO DE SALA> hoja-qr.pdf
    ```
    Cuatro mesas por hoja. El script avisa si los QR apuntan a otro dominio distinto del que le pasaste (señal de un `BASE_URL` mal puesto en Coolify).
11. **Simulacro de demostración** (para mostrar el flujo completo sin gente): crea una sala con 4 mesas de 6 personas de ejemplo (`@example.com`), las inscribe y corre las dos rondas; la sala queda con la ronda 2 cerrada para explorar el panel y el tablero. Desde la carpeta del repo, con un admin que ya cambió su clave temporal (la clave se pide oculta):
    ```sh
    npx tsx tools/simulacro_demo.ts --url https://horizontes.estratek.com.co --usuario <admin> --nombre "Bootcamp España"
    ```
    Opcionales: `--mesas 4` y `--por-mesa 6`. Al final imprime los enlaces del panel y del tablero.
12. **Plan B impreso:** papeletas (`deploy/plan_b/papeleta.html`, 2 por persona) y la plantilla Excel en el portátil (`docs/PLAN_B.md`). Opcional: el formulario en línea de respaldo (lo crea Paola en la cuenta de Estratek).

### 5.3 Después (cuando se pueda)
13. **Dominio `horizontes.com.co`:** `docs/DESPLIEGUE.md` §6 (compra, DNS, dominio en Coolify, `BASE_URL`, `HZ_DOMINIO_PROD` y reimpresión de QR).
14. **GitHub corporativo:** `docs/MIGRACION_GITHUB.md` (transferir o espejar, `git remote set-url`, GitHub App de Coolify, accesos y protección de `main`).
15. **Pendiente para Sebastian:** decidir si la narrativa del caso Foodsume se adapta a Perú o a textos neutros. Hoy va el documento 2026 tal cual (Colombia), por decisión de Paola del 19-oct.
16. **Ya confirmado por Paola (19-oct), sin preguntas abiertas:** los 6 perfiles con sus 12 hojas, los rangos de inversión de la semilla, el mapeo de los 8 proyectos fijos y las rúbricas editables por cualquier admin.

## 6. Lista de verificación del día del taller
**La víspera**
- [ ] `https://<dominio>/api/health` responde y el candado del navegador es válido.
- [ ] Sala creada, país correcto, visibilidad revisada (por defecto: toda la sala, tablero en vivo).
- [ ] Hoja de QR impresa; un QR probado con un celular que no sea el tuyo.
- [ ] Ensayo con *Duplicar para ensayo* (no en la sala real).
- [ ] Plan B impreso y la plantilla Excel en el portátil.
- [ ] Respaldo: la app guarda uno sola al abrir la inscripción y otro al cerrar la sala. Si quieres uno extra: Coolify → `horizontes-prod` → **Terminal** → el comando de `deploy/README.md` ("Respaldo de SQLite").

**En el salón, antes de empezar**
- [ ] Wi-Fi del salón abre el QR desde 2 celulares distintos.
- [ ] Tablero en el proyector con **F** (pantalla completa).
- [ ] Panel abierto en **Sala en vivo** en el portátil del facilitador.

**Durante**
- [ ] *Abrir inscripción* → lectura → *Abrir ronda 1* (individual y en silencio) → *Cerrar ronda 1* → *Abrir ronda 2* (con discusión) → *Cerrar ronda 2* → tablero en **Comparación** → *Cerrar sala*.
- [ ] Si la app no carga para nadie en 3 minutos: plan B.

**Al cerrar**
- [ ] **Exportar** `inscritos.csv` y `votos.csv` y guardarlos donde lo permita la política de datos.
- [ ] Confirmar en **Salud** que no hubo errores.

## 7. Qué garantiza (SPEC §11) y con qué evidencia
| Criterio | Evidencia | Estado |
|---|---|---|
| 40 celulares, 4 mesas, 2 rondas, p95 < 500 ms, sin errores | Simulador de carga contra la imagen de producción (16-oct: 0 errores, p95 entre 231 y 457 ms) | En local. Falta repetirlo en staging |
| Puntos = cálculo independiente (golden) | `tests/golden/motor_golden.json` al 100 % en `tools/test.sh` | Verde |
| Precierre solo con todos los activos, preliminar, sin cerrar | e2e del servidor, del celular y del panel; recorrido en navegador | Verde |
| Cierre programado a la hora (± 15 s) | e2e del servidor con reloj real | Verde |
| Cambios de visibilidad en el celular en < 5 s | e2e del servidor y del tablero | Verde |
| Sin consentimiento no hay inscripción; versión y política guardadas | Pruebas del servidor y del celular; `docs/CONSENTIMIENTO.md` | Verde |
| Admin normal no ve gestión de admins (403) | Pruebas del servidor y del panel contra la API real | Verde |
| Resultados anónimos, mínimo 3 votos, fotos de 3 en 3 (D2) | Pruebas del servidor, del celular, del tablero y del panel; `docs/TRIAGE.md` | Verde (pasada 4 de TRIAGE y su integración) |

Pruebas integradas al 19-oct 14:15 (`tools/test.sh` sobre las ramas de las 4 áreas): 436 de 441 en verde; las 4 rojas eran pruebas e2e del celular que aún esperaban «Voto registrado» en vez de la vista en vivo por defecto (TRIAGE #31). Tras la integración del 19-oct: 457 de 458 en verde, 1 omitida. Recorrido en navegador a 360 y 1920 px en verde.

## 8. Pendientes conocidos
- Revisión de la semilla con Sebastián: `docs/PROPUESTA_SEMILLA.md`.
- Supresión de datos y vencimiento de respaldos (B-5) y el resto de `docs/RECOMENDACIONES_ESTRATEGICAS.md`.
- Hallazgos abiertos de `docs/TRIAGE.md`.
- Formulario de respaldo en línea del plan B (Paola, cuenta de Estratek).
- Fuera de alcance v1 (SPEC §10): multiempresa, portafolios propios, TAM normalizado, análisis por perfil, PDF, correos. Idea a futuro: panel unificado de herramientas (`docs/BACKLOG_EXTRA.md`).
