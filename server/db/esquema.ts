// Esquema SQLite según docs/MODELO_DATOS.md. Cada entrada de MIGRACIONES se aplica una vez
// (PRAGMA user_version guarda la última aplicada). Para cambios futuros: agrega, no edites.

export const MIGRACIONES: string[] = [
  `
CREATE TABLE admins (
  id            INTEGER PRIMARY KEY,
  usuario       VARCHAR(60) UNIQUE NOT NULL,
  nombre        VARCHAR(120) NOT NULL,
  correo        VARCHAR(160) NULL,
  rol           VARCHAR(12)  NOT NULL DEFAULT 'admin' CHECK (rol IN ('superadmin','admin')),
  activo        BOOLEAN      NOT NULL DEFAULT 1,
  debe_cambiar_clave BOOLEAN NOT NULL DEFAULT 1,
  creado_por    INTEGER      NULL REFERENCES admins(id),
  clave_hash    VARCHAR(255) NOT NULL,
  creado_at     DATETIME NOT NULL
);

CREATE TABLE sesiones_admin (
  token_hash  VARCHAR(64) PRIMARY KEY,
  admin_id    INTEGER NOT NULL REFERENCES admins(id),
  creada_at   DATETIME NOT NULL,
  expira_at   DATETIME NOT NULL
);

CREATE TABLE salas (
  id                          VARCHAR(16) PRIMARY KEY,
  codigo                      VARCHAR(8)  UNIQUE NOT NULL,
  nombre                      VARCHAR(120) NOT NULL,
  plantilla                   VARCHAR(40)  NOT NULL,
  estado                      VARCHAR(20)  NOT NULL,
  ronda_actual                TINYINT      NOT NULL DEFAULT 0,
  alcance_resultados          VARCHAR(5)   NOT NULL DEFAULT 'mesa',
  vista_participante          VARCHAR(10)  NOT NULL DEFAULT 'registrado',
  revelar_hojas               BOOLEAN      NOT NULL DEFAULT 0,
  cierre_programado_ronda_at  DATETIME     NULL,
  cierre_programado_sala_at   DATETIME     NULL,
  token_tablero_hash          VARCHAR(255) NOT NULL,
  token_tablero               VARCHAR(64)  NOT NULL,
  version                     INTEGER      NOT NULL DEFAULT 1,
  creada_at                   DATETIME     NOT NULL
);

CREATE TABLE mesas (
  id        VARCHAR(16) PRIMARY KEY,
  sala_id   VARCHAR(16) NOT NULL REFERENCES salas(id),
  numero    TINYINT     NOT NULL,
  nombre    VARCHAR(40) NOT NULL,
  codigo    VARCHAR(12) UNIQUE NOT NULL,
  UNIQUE (sala_id, numero)
);

CREATE TABLE proyectos (
  id          VARCHAR(40) NOT NULL,
  sala_id     VARCHAR(16) NOT NULL REFERENCES salas(id),
  nombre      VARCHAR(60) NOT NULL,
  tipo        VARCHAR(20), sector VARCHAR(40), descripcion TEXT,
  modo        VARCHAR(5)  NOT NULL CHECK (modo IN ('fijo','vivo')),
  orden       TINYINT     NOT NULL,
  tam         DECIMAL(4,2) NOT NULL,
  inputs_json TEXT NULL,
  PRIMARY KEY (sala_id, id)
);

CREATE TABLE hojas (
  sala_id     VARCHAR(16) NOT NULL,
  proyecto_id VARCHAR(40) NOT NULL,
  perfil_id   VARCHAR(30) NOT NULL,
  texto       TEXT NOT NULL,
  PRIMARY KEY (sala_id, proyecto_id, perfil_id)
);

CREATE TABLE contenido_sala (
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
  activo      BOOLEAN      NOT NULL DEFAULT 1,
  creado_at   DATETIME     NOT NULL,
  UNIQUE (sala_id, correo)
);
CREATE INDEX ix_participantes_token ON participantes (token_hash);
CREATE INDEX ix_participantes_mesa ON participantes (mesa_id);

CREATE TABLE consentimientos (
  id              INTEGER PRIMARY KEY,
  participante_id VARCHAR(16) NOT NULL REFERENCES participantes(id),
  version_aviso   VARCHAR(20) NOT NULL,
  politica_url    VARCHAR(255) NOT NULL,
  texto_hash      VARCHAR(64) NOT NULL,
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

CREATE TABLE eventos (
  id        INTEGER PRIMARY KEY,
  sala_id   VARCHAR(16) NOT NULL,
  at        DATETIME    NOT NULL,
  tipo      VARCHAR(40) NOT NULL,
  por       VARCHAR(60) NOT NULL,
  detalle_json TEXT
);
CREATE INDEX ix_eventos_sala ON eventos (sala_id, id);
`,
  // Acta del 16-oct: país y zona horaria por sala; IP de la inscripción y del último voto (solo para el admin);
  // país del aviso aceptado (los tres textos comparten versión y el admin puede cambiar el país de la sala).
  // SQLite no cambia el DEFAULT de una columna existente: la visibilidad por defecto de las salas nuevas
  // (alcance 'sala', vista 'en_vivo') la fija CONFIG_POR_DEFECTO en el código; las salas existentes no cambian.
  `
ALTER TABLE salas ADD COLUMN pais VARCHAR(2) NOT NULL DEFAULT 'CO' CHECK (pais IN ('CO','PE','GT'));
ALTER TABLE salas ADD COLUMN zona_horaria VARCHAR(20) NOT NULL DEFAULT 'America/Bogota';
ALTER TABLE participantes ADD COLUMN ip VARCHAR(45) NULL;
ALTER TABLE votos ADD COLUMN ip VARCHAR(45) NULL;
ALTER TABLE consentimientos ADD COLUMN pais VARCHAR(2) NOT NULL DEFAULT 'CO';
`,
  // Rúbricas editables (19-oct): las que el admin marca «Usar también en las salas nuevas». Al crear una sala se
  // aplican sobre las de la semilla; las salas existentes no cambian (cada una tiene su copia en contenido_sala).
  `
CREATE TABLE rubricas_plantilla (
  plantilla       VARCHAR(40) NOT NULL,
  criterio_id     VARCHAR(40) NOT NULL,
  rubrica_json    TEXT        NOT NULL,
  actualizado_at  DATETIME    NOT NULL,
  por             VARCHAR(60) NOT NULL,
  PRIMARY KEY (plantilla, criterio_id)
);
`,
  // Cambios del 19-oct (docs/DECISIONES.md, pedidos del 19-oct, S2 y S4): apertura y cierre programados por sala y por ronda,
  // modo de preguntas y pregunta guiada. `cierre_programado_ronda_at` queda como columna sin uso: la API lo sirve como
  // alias del cierre de la ronda abierta (o de la siguiente). Lo que tenía programado pasa a la ronda que habría cerrado.
  `
ALTER TABLE salas ADD COLUMN apertura_programada_sala_at DATETIME NULL;
ALTER TABLE salas ADD COLUMN apertura_programada_r1_at DATETIME NULL;
ALTER TABLE salas ADD COLUMN cierre_programado_r1_at DATETIME NULL;
ALTER TABLE salas ADD COLUMN apertura_programada_r2_at DATETIME NULL;
ALTER TABLE salas ADD COLUMN cierre_programado_r2_at DATETIME NULL;
ALTER TABLE salas ADD COLUMN modo_preguntas VARCHAR(10) NOT NULL DEFAULT 'automatico' CHECK (modo_preguntas IN ('automatico','guiado'));
ALTER TABLE salas ADD COLUMN pregunta_guiada_proyecto_id VARCHAR(40) NULL;
ALTER TABLE salas ADD COLUMN pregunta_guiada_criterio_id VARCHAR(40) NULL;
UPDATE salas SET cierre_programado_r1_at = cierre_programado_ronda_at
 WHERE cierre_programado_ronda_at IS NOT NULL AND (estado = 'r1_abierta' OR ronda_actual = 0);
UPDATE salas SET cierre_programado_r2_at = cierre_programado_ronda_at
 WHERE cierre_programado_ronda_at IS NOT NULL AND NOT (estado = 'r1_abierta' OR ronda_actual = 0);
UPDATE salas SET cierre_programado_ronda_at = NULL;
`,
  // D1 (20-oct): «Dar acceso de nuevo». El facilitador genera un enlace personal de un solo uso que vence a los 15 min;
  // se guarda solo el hash. Reemplaza la recuperación de la sesión con solo el correo.
  `
CREATE TABLE accesos_participante (
  token_hash      VARCHAR(64) PRIMARY KEY,
  participante_id VARCHAR(16) NOT NULL REFERENCES participantes(id),
  sala_id         VARCHAR(16) NOT NULL,
  creado_at       DATETIME    NOT NULL,
  vence_at        DATETIME    NOT NULL,
  usado_at        DATETIME    NULL,
  por             VARCHAR(60) NOT NULL
);
CREATE INDEX ix_accesos_participante ON accesos_participante (participante_id);
`,
  // D2 (20-oct): consolidado en vivo de 3 en 3. Con la ronda abierta se publica la última foto del agregado de cada
  // alcance ('sala' o id de la mesa), ronda y proyecto; se renueva cuando 3 o más personas votaron o cambiaron su voto
  // desde la foto anterior. `huellas_json` = {participante_id: "135799"} de los votos incluidos, para contar los cambios.
  `
CREATE TABLE fotos_agregado (
  sala_id       VARCHAR(16) NOT NULL,
  alcance       VARCHAR(16) NOT NULL,
  ronda         TINYINT     NOT NULL CHECK (ronda IN (1,2)),
  proyecto_id   VARCHAR(40) NOT NULL,
  n_votos       INTEGER     NOT NULL,
  agregado_json TEXT        NULL,
  huellas_json  TEXT        NOT NULL,
  version_sala  INTEGER     NOT NULL,
  PRIMARY KEY (sala_id, alcance, ronda, proyecto_id)
);
`,
  // S-12 (20-oct): el token del tablero queda con una sola fuente, `token_tablero` (el panel necesita volver a mostrar el
  // enlace, así que el hash al lado no protegía nada). La columna del hash no se borra (migraciones aditivas): queda vacía.
  `
UPDATE salas SET token_tablero_hash = '';
`,
  // QA por roles (20-oct): tipo de sala (los ensayos no cuentan en las métricas del negocio), empresa cliente y sector
  // opcionales. Las salas existentes quedan como `taller`. Índice para buscar el consentimiento de cada participante
  // (detalle de sala y export de inscritos lo consultan por participante).
  `
ALTER TABLE salas ADD COLUMN tipo VARCHAR(7) NOT NULL DEFAULT 'taller' CHECK (tipo IN ('taller','ensayo'));
ALTER TABLE salas ADD COLUMN empresa VARCHAR(80) NULL;
ALTER TABLE salas ADD COLUMN sector VARCHAR(12) NULL CHECK (sector IS NULL OR sector IN ('alimentos','energia','financiero','comercio','salud','manufactura','otro'));
CREATE INDEX ix_consentimientos_participante ON consentimientos (participante_id);
`,
]
