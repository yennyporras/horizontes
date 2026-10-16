# Modelo de datos v1

SQL portable (SQLite y MySQL 8). T1 lo adapta al motor que fije R0 sin cambiar nombres ni semántica.

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
  alcance_resultados          VARCHAR(5)   NOT NULL DEFAULT 'mesa',       -- mesa|sala
  vista_participante          VARCHAR(10)  NOT NULL DEFAULT 'registrado', -- registrado|en_vivo
  revelar_hojas               BOOLEAN      NOT NULL DEFAULT FALSE,
  cierre_programado_ronda_at  DATETIME     NULL,
  cierre_programado_sala_at   DATETIME     NULL,
  token_tablero_hash          VARCHAR(255) NOT NULL,
  version                     INTEGER      NOT NULL DEFAULT 1, -- sube con cada cambio
  creada_at                   DATETIME     NOT NULL
);

CREATE TABLE mesas (
  id        VARCHAR(16) PRIMARY KEY,
  sala_id   VARCHAR(16) NOT NULL REFERENCES salas(id),
  numero    TINYINT     NOT NULL,
  nombre    VARCHAR(40) NOT NULL,          -- Mesa 1
  codigo    VARCHAR(12) UNIQUE NOT NULL,   -- HZ7K2-1
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
  UNIQUE (sala_id, correo)
);

CREATE TABLE consentimientos (
  id              INTEGER PRIMARY KEY,
  participante_id VARCHAR(16) NOT NULL REFERENCES participantes(id),
  version_aviso   VARCHAR(20) NOT NULL,
  politica_url    VARCHAR(255) NOT NULL,   -- política de tratamiento de datos de Estratek vigente
  texto_hash      VARCHAR(64) NOT NULL,    -- sha256 del aviso mostrado
  aceptado_at     DATETIME    NOT NULL,
  ip              VARCHAR(45), user_agent VARCHAR(255)
);

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
  PRIMARY KEY (participante_id, proyecto_id, ronda)
);
CREATE INDEX ix_votos_sala_ronda ON votos (sala_id, ronda, proyecto_id);

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
- Agregados se calculan al leer (datos pequeños). Si el tablero supera 50 ms, cachear por `(sala_id, version, alcance, mesa)`.
- `version` de la sala sube en la misma transacción de cualquier escritura.
- Votos de participantes con `activo = false` no cuentan para promedios ni para precierre.
