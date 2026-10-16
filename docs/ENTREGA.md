# Entrega · Horizontes (borrador R3, se cierra en R4)

Qué recibe Estratek, dónde está y cómo se usa. Estado al 16-oct, R3 adelantada.

## 1. Qué es
App web del taller "Portafolio por Horizontes" (caso Foodsume). Los participantes se inscriben con el QR de su mesa, leen el caso y su hoja de perfil, califican INSUMEX y NUTRIWHAT en 6 criterios (1, 3, 5, 7, 9) en 2 rondas, y la matriz de burbujas muestra cómo se mueven sobre 8 proyectos fijos.

## 2. Dónde vive
| Qué | Dónde | Estado |
|---|---|---|
| Código | `github.com/yennyporras/horizontes` (rama `main`) | Arriba |
| Producción | `https://horizontes.estratek.com.co` (`/admin`, `/m/{mesa}`, `/tablero/{sala}`) | Pendiente: Coolify y DNS (`docs/BLOQUEOS.md`) |
| Staging | `https://staging-horizontes.estratek.com.co` | Pendiente: lo mismo |
| Servidor | Coolify en el VPS de Hostinger, 1 contenedor, SQLite en el volumen `/data` | Imagen probada en local |

## 3. Cómo se despliega
`tools/deploy.sh diagnostico` → `tools/deploy.sh staging` → `tools/deploy.sh produccion`. Detalle en `deploy/README.md` y `docs/DESPLIEGUE.md`. Respaldos: automático al cerrar cada sala (últimos 30) y tarea diaria en Coolify.

## 4. Cómo se usa
- Facilitador: `docs/GUIA_FACILITADOR.md` (1 página).
- Si la app falla: `docs/PLAN_B.md` (papeleta A4 y plantilla Excel con el mismo cálculo).
- Accesos: superadmin Paola (clave en `deploy/.env.deploy`, nunca en git). Ella crea los demás administradores desde el panel; cada uno cambia su clave en el primer ingreso.

## 5. Qué garantiza (SPEC §11) y con qué evidencia
| Criterio | Evidencia | Estado |
|---|---|---|
| 40 celulares, 4 mesas, 2 rondas, p95 < 500 ms, sin errores | Simulador de T1 contra la imagen de producción: 0 errores, p95 296 ms y 457 ms (con el recorrido en navegador en paralelo) | En local. Falta repetirlo en staging y producción |
| Puntos = cálculo independiente (golden) | `tests/golden/motor_golden.json` al 100 % en `tools/test.sh`; simulador verifica los puntos de la sala | Verde |
| Precierre solo con todos los activos, preliminar, sin cerrar | e2e de T1, T2 y T4; recorrido en navegador | Verde |
| Cierre programado a la hora (± 15 s) | e2e de T1 con reloj real | Verde |
| Cambios de visibilidad en el celular en < 5 s | e2e de T1 y T3 (medido ~2 s) | Verde |
| Sin consentimiento no hay inscripción; versión y política guardadas | Pruebas de T1 y T2; `docs/CONSENTIMIENTO.md` | Verde |
| Admin normal no ve gestión de admins (403) | Pruebas de T1 y del panel contra la API real | Verde |

## 6. Datos personales (Ley 1581)
Nombre y correo solo con fines informativos, con autorización según la Política de Tratamiento de Datos Personales de Estratek. Se guarda versión del aviso, fecha, IP y user agent. Ningún resultado muestra nombres ni respuestas individuales; los datos salen solo en el export CSV del panel. Pendiente: confirmar el país del VPS (si está fuera de Colombia, aviso `hz-1.1` con transferencia internacional; ver `docs/BLOQUEOS.md`).

## 7. Calidad
- `tools/test.sh`: typecheck + Vitest (motor, API, e2e en navegador de participante, tablero y panel). Integrado en R3: 369 pruebas en verde.
- QA integrada y hallazgos: `docs/TRIAGE.md`.

## 8. Pendientes conocidos
- Staging y producción (credenciales de Coolify y DNS).
- Hallazgos abiertos de `docs/TRIAGE.md` (se cierran en R4).
- Formulario de respaldo en línea del plan B (lo crea Paola en la cuenta de Estratek).
- Fuera de alcance v1 (SPEC §10): multiempresa, portafolios propios, TAM normalizado, análisis por perfil, PDF, correos.
