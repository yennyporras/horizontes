# Modelo de datos v1

SQL portable (SQLite y MySQL 8). El servidor lo implementa en SQLite (`node:sqlite`) sin cambiar nombres ni semántica.

```sql
CREATE TABLE admins (
  id            INTEGER PRIMARY KEY,
  usuario       VARCHAR(60) UNIQUE NOT NULL,
  nombre        VARCHAR(120) NOT NULL,
  correo        VARCHAR(160) NULL,
  rol           VARCHAR(12)  NOT NULL DEFAULT 'admin',   -- superadmin|admin (superadmin solo desde .env)
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  debe_cambiar_clave BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por    INTEGER      NULL REFERENCES admins(id),
  clave_hash    VARCHAR(255) NOT NULL,
  creado_at     DATETIME NOT NULL
);

CREATE TABLE salas (
  id                          VARCHAR(16) PRIMARY KEY,      -- s_xxxx
  codigo                      VARCHAR(8)  UNIQUE NOT NULL,  -- HZ7K2
  nombre                      VARCHAR(120) NOT NULL,
  plantilla                   VARCHAR(40)  NOT NULL,        -- foodsume_2026
  estado                      VARCHAR(20)  NOT NULL,        -- preparada|inscripcion|r1_abierta|r1_cerrada|r2_abierta|r2_cerrada|cerrada
  ronda_actual                TINYINT      NOT NULL DEFAULT 0,
  alcance_resultados          VARCHAR(5)   NOT NULL DEFAULT 'mesa',       -- mesa|sala (salas nuevas desde el 19-oct: 'sala', lo fija el código)
  vista_participante          VARCHAR(10)  NOT NULL DEFAULT 'registrado', -- registrado|en_vivo (salas nuevas desde el 19-oct: 'en_vivo')
  revelar_hojas               BOOLEAN      NOT NULL DEFAULT FALSE,
  cierre_programado_ronda_at  DATETIME     NULL,             -- sin uso desde la migración 4: la API lo deriva de r1/r2
  cierre_programado_sala_at   DATETIME     NULL,
  apertura_programada_sala_at DATETIME     NULL,             -- 19-oct (migración 4): abre la inscripción
  apertura_programada_r1_at   DATETIME     NULL,
  cierre_programado_r1_at     DATETIME     NULL,
  apertura_programada_r2_at   DATETIME     NULL,
  cierre_programado_r2_at     DATETIME     NULL,
  modo_preguntas              VARCHAR(10)  NOT NULL DEFAULT 'automatico', -- automatico|guiado (migración 4)
  pregunta_guiada_proyecto_id VARCHAR(40)  NULL,             -- pregunta que fija el admin en modo guiado (migración 4)
  pregunta_guiada_criterio_id VARCHAR(40)  NULL,
  pais                        VARCHAR(2)   NOT NULL DEFAULT 'CO',             -- CO|PE|GT (acta del 16-oct)
  zona_horaria                VARCHAR(20)  NOT NULL DEFAULT 'America/Bogota', -- America/Bogota|America/Lima|America/Guatemala (acta del 16-oct)
  token_tablero_hash          VARCHAR(255) NOT NULL,          -- sin uso desde la migración 7 (20-oct, S-12): vacía
  token_tablero               VARCHAR(64)  NOT NULL,          -- única fuente del token del tablero (?t=); en claro porque el panel vuelve a mostrar el enlace
  version                     INTEGER      NOT NULL DEFAULT 1, -- sube con cada cambio
  creada_at                   DATETIME     NOT NULL,
  tipo                        VARCHAR(7)   NOT NULL DEFAULT 'taller', -- taller|ensayo (migración 8, 20-oct): ensayo no cuenta en las métricas; duplicar crea ensayo
  empresa                     VARCHAR(80)  NULL,             -- empresa cliente, opcional (migración 8)
  sector                      VARCHAR(12)  NULL              -- alimentos|energia|financiero|comercio|salud|manufactura|otro, opcional (migración 8)
);

CREATE TABLE mesas (
  id        VARCHAR(16) PRIMARY KEY,
  sala_id   VARCHAR(16) NOT NULL REFERENCES salas(id),
  numero    TINYINT     NOT NULL,
  nombre    VARCHAR(40) NOT NULL,          -- Mesa 1
  codigo    VARCHAR(12) UNIQUE NOT NULL,   -- HZ7K2QX4AB-1: código de la sala + 5 al azar + número (M-1c, hasta 13 caracteres: SQLite no aplica el largo de VARCHAR); antes HZ7K2QX4-1 (S-5) o HZ7K2-1
  UNIQUE (sala_id, numero)
);

CREATE TABLE proyectos (
  id          VARCHAR(40) NOT NULL,        -- slug de la semilla
  sala_id     VARCHAR(16) NOT NULL REFERENCES salas(id),
  nombre      VARCHAR(60) NOT NULL,
  tipo        VARCHAR(20), sector VARCHAR(40), descripcion TEXT,
  modo        VARCHAR(5)  NOT NULL,        -- fijo|vivo
  orden       TINYINT     NOT NULL,
  tam         DECIMAL(4,2) NOT NULL,
  inputs_json TEXT NULL,                   -- solo fijos: promedios precargados
  PRIMARY KEY (sala_id, id)
);

CREATE TABLE hojas (
  sala_id     VARCHAR(16) NOT NULL,
  proyecto_id VARCHAR(40) NOT NULL,
  perfil_id   VARCHAR(30) NOT NULL,        -- cliente|regulacion|financiero|tecnica_operaciones|estrategica|produccion
  texto       TEXT NOT NULL,
  PRIMARY KEY (sala_id, proyecto_id, perfil_id)
);

CREATE TABLE contenido_sala (               -- caso general, copiado de la semilla al crear la sala
  sala_id         VARCHAR(16) PRIMARY KEY,
  caso_json       TEXT NOT NULL,
  criterios_json  TEXT NOT NULL,
  pesos_json      TEXT NOT NULL,
  grafico_json    TEXT NOT NULL
);

CREATE TABLE participantes (
  id          VARCHAR(16) PRIMARY KEY,
  sala_id     VARCHAR(16) NOT NULL REFERENCES salas(id),
  mesa_id     VARCHAR(16) NOT NULL REFERENCES mesas(id),
  nombre      VARCHAR(120) NOT NULL,
  correo      VARCHAR(160) NOT NULL,
  perfil_id   VARCHAR(30)  NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_at   DATETIME     NOT NULL,
  ip          VARCHAR(45)  NULL,              -- IP de la inscripción (acta del 16-oct, solo admin)
  UNIQUE (sala_id, correo)
);

CREATE TABLE consentimientos (
  id              INTEGER PRIMARY KEY,
  participante_id VARCHAR(16) NOT NULL REFERENCES participantes(id),
  version_aviso   VARCHAR(20) NOT NULL,
  politica_url    VARCHAR(255) NOT NULL,   -- política de tratamiento de datos de Estratek vigente
  texto_hash      VARCHAR(64) NOT NULL,    -- sha256 del aviso mostrado
  aceptado_at     DATETIME    NOT NULL,
  ip              VARCHAR(45), user_agent VARCHAR(255),
  pais            VARCHAR(2)  NOT NULL DEFAULT 'CO'  -- país del aviso aceptado (acta del 16-oct)
);
CREATE INDEX ix_consentimientos_participante ON consentimientos (participante_id);  -- migración 8

CREATE TABLE votos (
  participante_id VARCHAR(16) NOT NULL REFERENCES participantes(id),
  sala_id         VARCHAR(16) NOT NULL,
  proyecto_id     VARCHAR(40) NOT NULL,
  ronda           TINYINT     NOT NULL CHECK (ronda IN (1,2)),
  alistamiento_tecnico          TINYINT NOT NULL CHECK (alistamiento_tecnico IN (1,3,5,7,9)),
  conocimiento_cliente          TINYINT NOT NULL CHECK (conocimiento_cliente IN (1,3,5,7,9)),
  regulacion                    TINYINT NOT NULL CHECK (regulacion IN (1,3,5,7,9)),
  capacidades_organizacionales  TINYINT NOT NULL CHECK (capacidades_organizacionales IN (1,3,5,7,9)),
  alineacion_core               TINYINT NOT NULL CHECK (alineacion_core IN (1,3,5,7,9)),
  inversion_requerida           TINYINT NOT NULL CHECK (inversion_requerida IN (1,3,5,7,9)),
  actualizado_at  DATETIME NOT NULL,
  ip              VARCHAR(45) NULL,           -- IP del último guardado (acta del 16-oct, solo admin)
  PRIMARY KEY (participante_id, proyecto_id, ronda)
);
CREATE INDEX ix_votos_sala_ronda ON votos (sala_id, ronda, proyecto_id);

CREATE TABLE rubricas_plantilla (           -- rúbricas que el admin marcó «Usar también en las salas nuevas» (migración 3)
  plantilla       VARCHAR(40) NOT NULL,      -- foodsume_2026
  criterio_id     VARCHAR(40) NOT NULL,
  rubrica_json    TEXT        NOT NULL,      -- [{valor, texto}] en el orden de la semilla
  actualizado_at  DATETIME    NOT NULL,
  por             VARCHAR(60) NOT NULL,      -- admin:usuario
  PRIMARY KEY (plantilla, criterio_id)
);

CREATE TABLE accesos_participante (         -- «Dar acceso de nuevo» (D1, 20-oct, migración 5)
  token_hash      VARCHAR(64) PRIMARY KEY,   -- sha256 del código de acceso; el código solo viaja en la URL que ve el admin
  participante_id VARCHAR(16) NOT NULL REFERENCES participantes(id),
  sala_id         VARCHAR(16) NOT NULL,
  creado_at       DATETIME    NOT NULL,
  vence_at        DATETIME    NOT NULL,      -- creado_at + 15 min; un acceso nuevo de la misma persona vence los pendientes
  usado_at        DATETIME    NULL,          -- un solo uso
  por             VARCHAR(60) NOT NULL       -- admin:usuario
);
CREATE INDEX ix_accesos_participante ON accesos_participante (participante_id);

CREATE TABLE fotos_agregado (               -- consolidado en vivo de 3 en 3 (D2, 20-oct, migración 6)
  sala_id       VARCHAR(16) NOT NULL,
  alcance       VARCHAR(16) NOT NULL,        -- 'sala' o id de la mesa
  ronda         TINYINT     NOT NULL CHECK (ronda IN (1,2)),
  proyecto_id   VARCHAR(40) NOT NULL,
  n_votos       INTEGER     NOT NULL,
  agregado_json TEXT        NULL,            -- {n_votos, promedios, distribucion, t2m, eje_x, eje_y, total} publicado
  huellas_json  TEXT        NOT NULL,        -- {participante_id: "135799"}: votos incluidos, para contar los cambios
  version_sala  INTEGER     NOT NULL,        -- versión de la sala cuando se tomó
  PRIMARY KEY (sala_id, alcance, ronda, proyecto_id)
);

CREATE TABLE eventos (                      -- auditoría y bitácora visible al admin
  id        INTEGER PRIMARY KEY,
  sala_id   VARCHAR(16) NOT NULL,
  at        DATETIME    NOT NULL,
  tipo      VARCHAR(40) NOT NULL,            -- ronda_abierta|ronda_cerrada|cierre_programado|precierre|config|reinicio|...
  por       VARCHAR(60) NOT NULL,            -- admin:usuario | programado | sistema
  detalle_json TEXT
);
```

## Reglas
- Agregados se calculan al leer (datos pequeños). El tablero se cachea en memoria por sala y alcance (`sala` o mesa, rondas, preliminar y si lleva `por_mesa`); al subir la `version` de la sala se descarta todo lo de esa sala. La clave no lleva el participante: todos los celulares de un alcance comparten la vista y solo cambia la `version` de la respuesta.
- Consolidado de 3 en 3 (D2, 20-oct): con la ronda abierta, lo publicado de cada alcance, ronda y proyecto es la fila de `fotos_agregado`; se renueva al leer cuando el umbral de participantes distintos (1 en todas las salas desde el 21-oct; antes 3) votaron, cambiaron su voto o salieron del alcance (desactivados o cambiados de mesa) desde la foto. Con la ronda cerrada se publica el exacto y queda como foto. `reabrir_ronda` deja como foto el exacto de todos los alcances; `reiniciar_ronda` borra las fotos de esa ronda; `reiniciar_desde_ronda` (21-oct), las de las rondas que borra; `volver_ronda_anterior` hacia la ronda 1 deja como foto el exacto de la ronda 1; `reiniciar_sala` y el reinicio limpio, todas las de la sala. Antes de la primera foto con valores solo se publica el conteo (con `bajo_minimo`).
- El token del tablero tiene una sola fuente, `salas.token_tablero` (S-12). La migración 7 vació `token_tablero_hash`, que queda sin uso (no se borra: las migraciones solo agregan). Se compara en tiempo constante.
- Accesos de participante: se guarda solo el hash; se rechazan con la sala cerrada o el participante inactivo. El canje cambia `participantes.token_hash`, así que cada participante tiene una sola sesión vigente. El reinicio limpio los borra.
- `version` de la sala sube en la misma transacción de cualquier escritura.
- Votos de participantes con `activo = false` no cuentan para promedios ni para precierre.
- Horas programadas en UTC ISO. Desde el 20-oct (S-7, S-8) la API solo acepta ISO con zona y año de 4 dígitos, y los vencimientos se comparan en milisegundos, no como texto. Se aplican y se consumen (NULL) a su hora, o se descartan si la transición no vale en ese momento; la transición manual consume la suya. La migración 4 pasó el `cierre_programado_ronda_at` que hubiera a `cierre_programado_r1_at` (sala sin ronda o con R1 abierta) o a `cierre_programado_r2_at` (lo demás) y dejó la columna en NULL.
- La pregunta guiada se borra con cualquier cambio de estado de la sala, al cambiar `modo_preguntas` y en el reinicio limpio (que también borra la programación y vuelve a `automatico`).
- Migración 8 (20-oct): las salas que ya existían quedan `taller`, sin empresa ni sector. `tipo` y `sector` llevan CHECK con los valores permitidos.
- R1 oculta (20-oct): la caché del tablero guarda la vista completa; la máscara de la ronda 1 (`oculta`) se aplica al responder según quién pide y si el alcance está en precierre. La convergencia se calcula al armar la vista, desde la distribución publicada (la foto con la ronda abierta), no desde los votos al día.
- Modo demo (20-oct): no tiene tabla propia. Es una sala `ensayo` normal; los pasos pendientes viven en temporizadores del proceso y se pierden si el servidor se reinicia (la sala queda donde iba).
- `contenido_sala.criterios_json` es la copia de los criterios de cada sala: al crearla sale de la semilla con las rúbricas de `rubricas_plantilla` encima; al duplicarla, de la sala original. El admin cambia sus textos de rúbrica mientras la sala no tenga votos. Reiniciar una ronda o la sala no la toca.
