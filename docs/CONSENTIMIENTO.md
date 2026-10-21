# Consentimiento · Autorización de tratamiento de datos (Horizontes)

Responsable del documento: equipo del panel. Lo consumen el servidor (guardar y servir el texto) y el celular (pantalla de inscripción).

## 1. Componente que se reutiliza del IRMI

Repo IRMI: https://github.com/yennyporras/IRMI (monorepo pnpm, web React 18 + Vite, servidor Fastify + Drizzle + Postgres).

| Pieza | Ruta en el IRMI | Qué hace |
|---|---|---|
| Parser del texto legal | `apps/irmi/web/src/pages/sala/consentimiento.ts` | `seccionesConsentimiento(texto)` parte un markdown por encabezados `###` en secciones; `partesTratamiento(texto)` separa el aviso (para leer) del texto de la **casilla obligatoria**. |
| Bloque de UI | `apps/irmi/web/src/pages/sala/SalaParticipante.tsx` (líneas ~454-485) | Título "Autorización de tratamiento de datos", región con scroll y foco (`.consent`, `tabIndex=0`, `role="region"`), casilla obligatoria (`.check--req`), botón deshabilitado sin aceptación y pista "Marca la autorización de tratamiento de datos para continuar." |
| Estilos | `apps/irmi/web/src/styles/global.css` (`.consent`, `.consent__seccion`, `.consent__titulo`, `.check`, `.check--req`) | Caja con scroll, foco visible, casilla resaltada. |
| Texto legal base | `docs/contexto/legal/autorizacion-v1.1.md` | Aviso de privacidad aprobado por jurídica (9-oct-2026) con los datos de ESTRATEK S.A.S. |
| Modelo | `apps/irmi/server/src/db/schema.ts` (`consent_texts`, `consents`) | Textos versionados y evidencia de aceptación. |

Cómo se reutiliza en Horizontes (celular):
- Copiar `consentimiento.ts` tal cual a `web/shared/ui/consentimiento.ts` (o a `web/participante/`) y el bloque JSX como componente `<Consentimiento texto aceptado onChange />`. Se toma solo el bloque de tratamiento de datos; **no** se trae la casilla opcional de uso comercial (`commercial_use`): en Horizontes los datos son solo para fines informativos del taller.
- El texto llega de la API: `GET /api/mesas/{codigoMesa}` devuelve `consentimiento:{version, texto_autorizacion, politica_url}`. `texto_autorizacion` usa el mismo formato markdown con `###`, así el parser del IRMI funciona sin cambios.
- Sin la casilla marcada, el botón queda deshabilitado y el servidor responde `422 CONSENTIMIENTO_REQUERIDO`.

## 2. Política de Tratamiento de Datos Personales de Estratek

- `POLITICA_PRIVACIDAD_URL=https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/`
- Fuente: es la URL que cita el aviso aprobado del IRMI (`autorizacion-v1.1.md`) y la que Paola dejó en `.env`. Vive como variable de entorno; el servidor la inyecta en `politica_url` y en el texto (marcador `{POLITICA_URL}`).

## 3. Texto de autorización (versión `hz-1.0`)

Se guarda como `data/` o semilla del servidor (lo decide el equipo del servidor) con este contenido exacto. `{POLITICA_URL}` se reemplaza por la variable de entorno al servir el texto. Sin rayas, tuteo, como el IRMI.

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
- Se omitió el párrafo de transferencia internacional del IRMI porque Horizontes corre en el VPS de Hostinger y no usa terceros (sin correo ni servicios externos). Pendiente para Paola: confirmar la ubicación del VPS; si está fuera de Colombia, se agrega el párrafo en la versión `hz-1.1` (ver `docs/ENTREGA.md` §5.1, paso 1).
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
- Supresión: a solicitud del titular, el admin desactiva y el servidor anonimiza nombre y correo (pendiente para v1.1 si no alcanza; el canal es info@estratek.com.co).

## 5. Versión `hz-1.3` por país (decisiones 2 de Paola, 20 y 21-oct)

`hz-1.3` (21-oct): desde la decisión 1 de Paola del 21-oct, el tablero y los celulares muestran los resultados desde 1 voto y se actualizan con cada calificación, en todas las salas. La promesa de `hz-1.2` («solo se muestran promedios de 3 o más personas») dejó de ser cierta. El aviso ahora dice: «En el tablero y en los celulares nadie ve mi nombre: se ven los promedios de mi mesa o de la sala, que se actualizan con cada calificación. El equipo de Estratek que facilita el taller sí ve mis calificaciones con mi nombre, para conducirlo.» (en el aviso corto y en la landing, con «tu» y «tus»). Las aceptaciones de `hz-1.2` quedan con su versión y su hash; desde `hz-1.3` el servidor rechaza `hz-1.2` con `422 CONSENTIMIENTO_REQUERIDO`, como antes con `hz-1.1`. El resto de esta sección cuenta el cambio de `hz-1.2`.

Antes, `hz-1.1` (acta del 16-oct, P4 y C6) decía que solo se trataban «nombre y correo» con «fines informativos». El QA por roles del 20-oct mostró que no era fiel: el servidor también guarda las calificaciones con el nombre, y por seguridad la IP, el país del aviso y el navegador (user agent) de la inscripción y de cada voto; el facilitador ve las calificaciones de cada persona en el panel (Respuestas); y el servidor (VPS de Hostinger) no está en Perú. Paola decidió un aviso fiel a lo que pasa (`hz-1.2`). Las aceptaciones de `hz-1.1` quedan con su versión y su hash; desde `hz-1.2` el servidor rechaza la versión anterior con `422 CONSENTIMIENTO_REQUERIDO` («El aviso de datos cambió. Recarga la página y vuelve a aceptarlo.»).

Sin plazo de conservación todavía: prometerlo requiere B-5 (borrado o anonimización automática de los datos de una sala vieja), que no está construido.

Cómo se arma la pantalla de inscripción:
- **Casilla obligatoria:** `texto_autorizacion` lo sirve el servidor según `sala.pais` (`GET /api/mesas/{codigo}` → `consentimiento.texto_autorizacion`, versión `hz-1.3`). Es texto plano de un párrafo; el celular le agrega al final el enlace «Lee la Política de Tratamiento de Datos Personales de Estratek» (`politica_url`). El hash que guarda el servidor es el de este texto.
- **Aviso corto encima de la casilla:** lo arma el celular (`web/participante/pantallas/Inscripcion.tsx`) con `sala.pais`, con los textos de §5.2. El servidor no los sirve.
- Sin `pais` en la respuesta, el celular asume Colombia.

### 5.1 Texto de la casilla (`texto_autorizacion`)

> Estos son los textos vigentes que sirve el servidor (`server/dominio/consentimiento.ts`, `TEXTOS_AUTORIZACION`, versión `hz-1.3`). Una prueba verifica que coinciden.

**Colombia (`CO`)**

```text
Declaro que soy mayor de edad y autorizo a Estratek S.A.S. a tratar mi nombre, mi correo y mis calificaciones, y por seguridad la IP, el país y el navegador de mi conexión, para identificarme en mi mesa, evitar inscripciones dobles y devolverme el acceso si cambio de celular durante este taller. No se usan para publicidad ni se entregan a terceros. En el tablero y en los celulares nadie ve mi nombre: se ven los promedios de mi mesa o de la sala, que se actualizan con cada calificación. El equipo de Estratek que facilita el taller sí ve mis calificaciones con mi nombre, para conducirlo. Esta autorización se rige por la Ley 1581 de 2012 de Colombia y por la Política de Tratamiento de Datos Personales de Estratek. Puedo conocer, actualizar, rectificar o suprimir mis datos y revocar esta autorización escribiendo a info@estratek.com.co.
```

**Perú (`PE`)**

```text
Declaro que soy mayor de edad y autorizo a Estratek S.A.S. a tratar mi nombre, mi correo y mis calificaciones, y por seguridad la IP, el país y el navegador de mi conexión, para identificarme en mi mesa, evitar inscripciones dobles y devolverme el acceso si cambio de celular durante este taller. No se usan para publicidad ni se entregan a terceros. En el tablero y en los celulares nadie ve mi nombre: se ven los promedios de mi mesa o de la sala, que se actualizan con cada calificación. El equipo de Estratek que facilita el taller sí ve mis calificaciones con mi nombre, para conducirlo. Esta autorización se rige por la Ley 29733, Ley de Protección de Datos Personales del Perú, y por la Política de Tratamiento de Datos Personales de Estratek. Mis datos se guardan en servidores fuera del Perú. Puedo ejercer mis derechos de acceso, rectificación, cancelación y oposición, y revocar esta autorización, escribiendo a info@estratek.com.co.
```

**Guatemala (`GT`)**

```text
Declaro que soy mayor de edad y autorizo a Estratek S.A.S. a tratar mi nombre, mi correo y mis calificaciones, y por seguridad la IP, el país y el navegador de mi conexión, para identificarme en mi mesa, evitar inscripciones dobles y devolverme el acceso si cambio de celular durante este taller. No se usan para publicidad ni se entregan a terceros. En el tablero y en los celulares nadie ve mi nombre: se ven los promedios de mi mesa o de la sala, que se actualizan con cada calificación. El equipo de Estratek que facilita el taller sí ve mis calificaciones con mi nombre, para conducirlo. Esta autorización se rige por la Política de Tratamiento de Datos Personales de Estratek, que se aplica a los participantes en Guatemala. Puedo conocer, actualizar, rectificar o suprimir mis datos y revocar esta autorización escribiendo a info@estratek.com.co.
```

### 5.2 Aviso corto (lo muestra el celular)

| Dato | CO | PE | GT |
|---|---|---|---|
| Quién trata tus datos | Estratek S.A.S., Medellín, Colombia. | igual | igual |
| Qué datos | Tu nombre, tu correo y tus calificaciones. Por seguridad también guardamos la dirección IP, el país y el navegador desde los que te conectas. | igual | igual |
| Para qué | Identificarte en tu mesa, evitar inscripciones dobles y devolverte el acceso si cambias de celular. No los usamos para publicidad ni los compartimos con terceros. | igual | igual |
| Quién ve qué | En el tablero y en los celulares nadie ve tu nombre: se ven los promedios de tu mesa o de la sala, que se actualizan con cada calificación. El equipo de Estratek que facilita el taller sí ve tus calificaciones con tu nombre, para conducirlo. | igual | igual |
| Dónde se guardan | (no se muestra) | En servidores ubicados fuera del Perú. | (no se muestra) |
| Qué norma aplica | La Ley 1581 de 2012 de Colombia y la política de Estratek. | La Ley 29733 de Perú y la política de Estratek. | La Política de Tratamiento de Datos Personales de Estratek. |
| Tus derechos | Conocer, actualizar, rectificar o suprimir tus datos y revocar esta autorización. Escribe a info@estratek.com.co: respondemos en un plazo máximo de 10 días hábiles. También puedes acudir a la Superintendencia de Industria y Comercio. | «Acceso, rectificación, cancelación y oposición sobre tus datos, y revocar esta autorización.», el mismo correo y plazo, y «… a la Autoridad Nacional de Protección de Datos Personales.» | igual que Colombia, sin autoridad (Guatemala no tiene ley general de datos personales). |

Los textos de esta tabla son los de `AVISO_DATOS` y `LEY_DATOS` en `web/participante/pantallas/Inscripcion.tsx`; una prueba (`web/participante/__tests__/aviso_datos.test.ts`) verifica que coincidan.

### 5.3 Preguntas de la versión `hz-1.1`, ya resueltas
1. **Perú, flujo transfronterizo:** sí. La casilla de `PE` dice «Mis datos se guardan en servidores fuera del Perú.» y el aviso corto lo repite.
2. **Plazo de respuesta:** se quedan los 10 días hábiles de la política de Estratek para los tres países.
3. **IP:** sí. «Qué datos» nombra la IP, el país y el navegador, por seguridad.
4. **Pendiente:** plazo de conservación de los datos (requiere B-5) y la misma pregunta del flujo transfronterizo para Colombia si el VPS está fuera del país (`docs/ENTREGA.md` §5.1).
