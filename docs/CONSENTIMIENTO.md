# Consentimiento · Autorización de tratamiento de datos (Horizontes)

Dueño del documento: T4. Lo consumen T1 (guardar y servir el texto) y T2 (pantalla de inscripción).

## 1. Componente que se reutiliza del IRMI

Repo IRMI: `C:\Users\ypaol\irmi` (monorepo pnpm, web React 18 + Vite, servidor Fastify + Drizzle + Postgres).

| Pieza | Ruta en el IRMI | Qué hace |
|---|---|---|
| Parser del texto legal | `apps/irmi/web/src/pages/sala/consentimiento.ts` | `seccionesConsentimiento(texto)` parte un markdown por encabezados `###` en secciones; `partesTratamiento(texto)` separa el aviso (para leer) del texto de la **casilla obligatoria**. |
| Bloque de UI | `apps/irmi/web/src/pages/sala/SalaParticipante.tsx` (líneas ~454-485) | Título "Autorización de tratamiento de datos", región con scroll y foco (`.consent`, `tabIndex=0`, `role="region"`), casilla obligatoria (`.check--req`), botón deshabilitado sin aceptación y pista "Marca la autorización de tratamiento de datos para continuar." |
| Estilos | `apps/irmi/web/src/styles/global.css` (`.consent`, `.consent__seccion`, `.consent__titulo`, `.check`, `.check--req`) | Caja con scroll, foco visible, casilla resaltada. |
| Texto legal base | `docs/contexto/legal/autorizacion-v1.1.md` | Aviso de privacidad aprobado por jurídica (9-oct-2026) con los datos de ESTRATEK S.A.S. |
| Modelo | `apps/irmi/server/src/db/schema.ts` (`consent_texts`, `consents`) | Textos versionados y evidencia de aceptación. |

Cómo se reutiliza en Horizontes (T2):
- Copiar `consentimiento.ts` tal cual a `web/shared/ui/consentimiento.ts` (o a `web/participante/`) y el bloque JSX como componente `<Consentimiento texto aceptado onChange />`. Se toma solo el bloque de tratamiento de datos; **no** se trae la casilla opcional de uso comercial (`commercial_use`): en Horizontes los datos son solo para fines informativos del taller.
- El texto llega de la API: `GET /api/mesas/{codigoMesa}` devuelve `consentimiento:{version, texto_autorizacion, politica_url}`. `texto_autorizacion` usa el mismo formato markdown con `###`, así el parser del IRMI funciona sin cambios.
- Sin la casilla marcada, el botón queda deshabilitado y el servidor responde `422 CONSENTIMIENTO_REQUERIDO`.

## 2. Política de Tratamiento de Datos Personales de Estratek

- `POLITICA_PRIVACIDAD_URL=https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/`
- Fuente: es la URL que cita el aviso aprobado del IRMI (`autorizacion-v1.1.md`) y la que Paola dejó en `.env`. Vive como variable de entorno; el servidor la inyecta en `politica_url` y en el texto (marcador `{POLITICA_URL}`).

## 3. Texto de autorización (versión `hz-1.0`)

Se guarda como `data/` o semilla del servidor (lo decide T1) con este contenido exacto. `{POLITICA_URL}` se reemplaza por la variable de entorno al servir el texto. Sin rayas, tuteo, como el IRMI.

```markdown
### Aviso de privacidad

ESTRATEK S.A.S., NIT 900.523.670-4, con domicilio en la CL 5G 29A 57 CA 10 de Medellín, Colombia, es responsable del tratamiento de los datos personales que entregas en este formulario: tu nombre y tu correo.

Usaremos tus datos solo con fines informativos del taller Portafolio por Horizontes: registrar tu participación, asignarte una mesa y un perfil, y mostrar los resultados consolidados de tu mesa y de la sala.

Tus calificaciones individuales no se muestran a nadie. Los resultados siempre se presentan como promedios de la mesa o de la sala, sin nombres.

Como titular tienes derecho a conocer, actualizar, rectificar y suprimir tus datos; a solicitar prueba de esta autorización y revocarla; a ser informado sobre el uso que se les da; a acceder a ellos gratuitamente; y a presentar quejas ante la Superintendencia de Industria y Comercio. Para ejercer tus derechos escribe al Área Administrativa de Estratek a info@estratek.com.co. Consulta nuestra Política de Tratamiento de Datos Personales en {POLITICA_URL}.

### Casilla obligatoria

Declaro que soy mayor de edad y autorizo a ESTRATEK S.A.S. a tratar mi nombre y mi correo con fines informativos del taller, conforme a la Ley 1581 de 2012 y a su Política de Tratamiento de Datos Personales.
```

Notas:
- Responsable, NIT, domicilio, canal de derechos y URL salen del texto ya aprobado por jurídica para el IRMI (v1.1). Lo nuevo es la finalidad (solo informativa) y los datos (solo nombre y correo).
- Se omitió el párrafo de transferencia internacional del IRMI porque Horizontes corre en el VPS de Hostinger y no usa terceros (sin correo, sin IA). Pendiente para Paola: confirmar la ubicación del VPS; si está fuera de Colombia, se agrega el párrafo en la versión `hz-1.1` (ver `docs/BLOQUEOS.md`).
- Cambiar una coma del texto exige subir la versión (`hz-1.1`, ...). Las aceptaciones viejas quedan con su versión y su hash.

## 4. Qué se guarda (tabla `consentimientos`, ver `docs/MODELO_DATOS.md`)

| Campo | Valor |
|---|---|
| `participante_id` | El inscrito |
| `version_aviso` | `hz-1.0` (la que el cliente manda en `consentimiento.version` y el servidor valida contra la vigente) |
| `politica_url` | Valor de `POLITICA_PRIVACIDAD_URL` al momento de aceptar |
| `texto_hash` | sha256 del texto mostrado, ya con la URL reemplazada |
| `aceptado_at` | Fecha y hora del servidor (America/Bogota) |
| `ip` | IP real del cliente (detrás del proxy de Coolify: confiar en 1 salto, como `TRUST_PROXY_HOPS=1` del IRMI) |
| `user_agent` | Recortado a 255 caracteres |

Reglas:
- Sin `consentimiento.aceptado = true` y versión vigente no se crea el participante (`422 CONSENTIMIENTO_REQUERIDO`).
- Si el correo ya está inscrito en la sala (`409 CORREO_YA_INSCRITO`), se agrega un nuevo registro de consentimiento con la aceptación actual; no se borra el anterior.
- El export de inscritos (admin) incluye `consentimiento` (versión y fecha). Ninguna respuesta fuera de `/api/admin/*` trae nombre ni correo.
- Supresión: a solicitud del titular, el admin desactiva y T1 anonimiza nombre y correo (pendiente para v1.1 si no alcanza; el canal es info@estratek.com.co).
