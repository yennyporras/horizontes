# Entrega · Horizontes

Qué recibe Estratek, dónde está, qué falta y qué hace Paola para ponerlo en producción. Estado al 19-oct, R4 (cambios del acta del 16-oct).

## 1. Qué es
App web del taller "Portafolio por Horizontes" (caso Foodsume). Los participantes se inscriben con el QR de su mesa, leen el caso y su hoja de perfil, califican INSUMEX y NUTRIWHAT en 6 criterios (1, 3, 5, 7, 9) en 2 rondas (R1 individual y en silencio, R2 con discusión), y la matriz de burbujas muestra cómo se mueven sobre 8 proyectos fijos: R1 en verde y R2 en rojo.

## 2. Dónde vive
| Qué | Dónde | Estado |
|---|---|---|
| Código | `github.com/yennyporras/horizontes` (rama `main`) | Arriba. Pasa a la cuenta de Estratek: `docs/MIGRACION_GITHUB.md` |
| Producción | `https://horizontes.estratek.com.co` → luego `https://horizontes.com.co` | **Falta**: Coolify, `deploy/.env.deploy` y DNS (sección 5) |
| Staging | `https://staging-horizontes.estratek.com.co` | **Falta**: lo mismo |
| Servidor | Coolify en el VPS de Hostinger, 1 contenedor, SQLite en el volumen `/data` | Imagen probada en local (`tools/deploy.sh local`) |

Rutas de la app (en cualquier dominio): `/admin` (panel), `/m/{código de mesa}` (celular, lo abre el QR), `/tablero/{sala}?t=...` (proyector, el enlace sale del panel).

## 3. Accesos (sin claves en este archivo)
- **Superadmin:** usuario `paola`. La clave inicial la elige Paola y va solo en `deploy/.env.deploy` (`SUPERADMIN_CLAVE_STAGING` y `SUPERADMIN_CLAVE_PROD`), nunca en git. Cuenta solo la primera vez que arranca una base vacía; después se cambia desde el panel.
- **Administradores:** Paola los crea en el panel (**Administradores** → *Nuevo administrador*, con clave temporal). Cada uno cambia su clave en el primer ingreso. Un admin normal no ve la gestión de administradores.
- **Coolify y Hostinger:** cuenta de Paola.
- **Tablero:** cada sala tiene su enlace con token; se abre desde **Sala en vivo** → *Abrir tablero de la sala*.

## 4. Qué está listo
- Inscripción con aviso de datos según el país de la sala (Colombia: Ley 1581 de 2012; Perú: Ley 29733; Guatemala: política de Estratek), versión `hz-1.1`. Sin autorización no hay inscripción.
- Votación 1-3-5-7-9 en 6 criterios, 2 rondas, precierre cuando todos votan, cierres programados en la hora del país de la sala.
- Resultados anónimos: tablas con los 6 criterios y la fila «Total» (eje X + eje Y, del servidor); mínimo de 3 votos para mostrar un alcance; por defecto toda la sala ve el consolidado apenas vota.
- Registro interno solo para el admin: país e IP de cada inscripción y voto en el panel y en `inscritos.csv` / `votos.csv`.
- Panel: salas, duplicar para ensayo, mesas y QR (hoja A4 imprimible), participantes, configuración (visibilidad, país, zona horaria, cierres), exportar, administradores, salud.
- Plan B en papel y Excel (`docs/PLAN_B.md`), guía del facilitador de una página (`docs/GUIA_FACILITADOR.md`).

## 5. Lo que hace Paola, en orden

### 5.1 Antes de producción (hoy)
1. **Texto legal.** Lee los tres textos de autorización (CO, PE, GT) en `docs/CONSENTIMIENTO.md` y confirma o corrige. Confirma también en qué país está el VPS (Hostinger → **VPS** → **Resumen** → ubicación): si no es Colombia, avisa para agregar el párrafo de transferencia internacional.
2. **Coolify: proyecto y apps.** Coolify → **Projects** → **+ Add** → `Horizontes`, con los ambientes `staging` y `production`. En cada ambiente: **+ New** → **Application** → **Private Repository (with GitHub App)** → App `coolify-estratek` → repo `yennyporras/horizontes` (si no aparece: **Sources** → `coolify-estratek` → *Install Repositories on GitHub* → agrégalo) → rama `main` → **Build Pack** `Dockerfile` → *Dockerfile Location* `/deploy/Dockerfile`, *Base Directory* `/` → *Ports Exposes* `3000` → **Save**. Nombres: `horizontes-staging` y `horizontes-prod`. En `horizontes-prod`, **Advanced** → apaga *Auto Deploy*.
3. **Volumen.** En cada app → **Persistent Storage** → **+ Add** → *Volume Mount*: nombre `horizontes-datos-staging` (o `horizontes-datos-prod`), *Destination Path* `/data` → **Save**.
4. **UUID de las apps.** Abre cada app: el UUID es el último tramo de la URL del navegador (`.../application/<uuid>`). Anótalos.
5. **Token de API.** Coolify → **Keys & Tokens** → **API tokens** → *Create New Token* con permisos `read`, `write` y `deploy` → copia el token (se ve una sola vez).
6. **DNS.** Hostinger → **Dominios** → `estratek.com.co` → **DNS / Nameservers** → **Registros DNS** → agrega dos `A`: nombre `staging-horizontes` y nombre `horizontes`, valor la IP del VPS (Hostinger → **VPS** → **Resumen**), TTL `3600`. No toques los demás registros (el correo depende de ellos).
7. **`deploy/.env.deploy` en tu equipo.** En la carpeta del repo: `cp deploy/env.deploy.ejemplo deploy/.env.deploy` y llena `COOLIFY_URL` (la dirección del panel de Coolify, sin `/` final), `COOLIFY_TOKEN` (paso 5), `COOLIFY_APP_STAGING` y `COOLIFY_APP_PROD` (paso 4), `SUPERADMIN_CLAVE_STAGING` y `SUPERADMIN_CLAVE_PROD` (12 caracteres o más, distintas). Este archivo no se sube a git.
8. **Diagnóstico.** En Git Bash: `tools/deploy.sh diagnostico staging`. Repite hasta que todo diga `[ok]` (te dice qué falta y dónde).
9. **Staging.** `tools/deploy.sh staging`: corre las pruebas, publica `main`, fija dominio, certificado, healthcheck y variables, despliega y comprueba HTTPS.
10. **Prueba en staging (10 min).** Entra a `https://staging-horizontes.estratek.com.co/admin` con `paola`, cambia la clave, crea una sala de 2 mesas, elige el país, escanea un QR con el celular, inscríbete, vota, mira el tablero y cierra la sala.
11. **Producción.** `tools/deploy.sh diagnostico produccion` y luego `tools/deploy.sh produccion` (exige que staging corra el mismo commit de `main`).
12. **Respaldo diario.** Coolify → `horizontes-prod` → **Scheduled Tasks** → **+ Add**: frecuencia `0 8 * * *` y el comando de `deploy/README.md` (sección "Respaldo de SQLite"). Repite en staging si quieres.
13. **Cuentas.** En `https://horizontes.estratek.com.co/admin`: cambia la clave del superadmin y crea los administradores (por ejemplo Nicolai) en **Administradores**.

### 5.2 Para el taller
14. **Sala real.** Panel → **Salas** → nombre del taller y número de mesas → **Crear sala** → **Configuración** → país.
15. **Hoja de QR A4 en PDF.** Panel → sala → **Mesas y QR** → *Imprimir hoja de QR* → destino "Guardar como PDF", tamaño A4, márgenes predeterminados. Sin abrir el navegador, desde el repo (cuando el dominio ya responda):
    ```sh
    HZ_ADMIN_CLAVE='<tu clave>' node QA-tests/hoja_qr_pdf.cjs https://horizontes.estratek.com.co paola <CÓDIGO DE SALA> hoja-qr.pdf
    ```
    Cuatro mesas por hoja. El script avisa si los QR apuntan a otro dominio distinto del que le pasaste (señal de un `BASE_URL` mal puesto en Coolify).
16. **Plan B impreso:** papeletas (`deploy/plan_b/papeleta.html`, 2 por persona) y la plantilla Excel en el portátil (`docs/PLAN_B.md`). Opcional: el formulario en línea de respaldo (lo crea Paola en la cuenta de Estratek).

### 5.3 Después (cuando se pueda)
17. **Dominio `horizontes.com.co`:** `docs/DESPLIEGUE.md` §6 (compra, DNS, dominio en Coolify, `BASE_URL`, `HZ_DOMINIO_PROD` y reimpresión de QR).
18. **GitHub corporativo:** `docs/MIGRACION_GITHUB.md` (transferir o espejar, `git remote set-url`, GitHub App de Coolify, accesos y protección de `main`).
19. **Preguntas abiertas para Sebastian** (`docs/BLOQUEOS.md`): solapes de los rangos de inversión del deck (P5) y confirmar que el diseño usa 6 perfiles (P1).

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
| 40 celulares, 4 mesas, 2 rondas, p95 < 500 ms, sin errores | Simulador de T1 contra la imagen de producción (R3: 0 errores, p95 entre 231 y 457 ms) | En local. Falta repetirlo en staging |
| Puntos = cálculo independiente (golden) | `tests/golden/motor_golden.json` al 100 % en `tools/test.sh` | Verde |
| Precierre solo con todos los activos, preliminar, sin cerrar | e2e de T1, T2 y T4; recorrido en navegador | Verde |
| Cierre programado a la hora (± 15 s) | e2e de T1 con reloj real | Verde |
| Cambios de visibilidad en el celular en < 5 s | e2e de T1 y T3 | Verde |
| Sin consentimiento no hay inscripción; versión y política guardadas | Pruebas de T1 y T2; `docs/CONSENTIMIENTO.md` | Verde |
| Admin normal no ve gestión de admins (403) | Pruebas de T1 y del panel contra la API real | Verde |
| Resultados anónimos, mínimo 3 votos, «Total» (acta) | Pruebas de T1, T2, T3 y del panel; `docs/TRIAGE.md` | Ver la pasada R4 en TRIAGE |

Pruebas integradas al 19-oct 14:15 (`tools/test.sh` sobre las 4 ramas): 436 de 441 en verde; las 4 rojas son pruebas e2e del celular que aún esperan «Voto registrado» en vez de la vista en vivo por defecto (TRIAGE #31, T2). Recorrido en navegador a 360 y 1920 px en verde.

## 8. Pendientes conocidos
- Staging y producción: sección 5.1 (credenciales de Coolify y DNS, solo Paola).
- Hallazgos abiertos de `docs/TRIAGE.md`.
- Formulario de respaldo en línea del plan B (Paola, cuenta de Estratek).
- Fuera de alcance v1 (SPEC §10): multiempresa, portafolios propios, TAM normalizado, análisis por perfil, PDF, correos. Idea a futuro: panel unificado de herramientas (`docs/BACKLOG_EXTRA.md`).
