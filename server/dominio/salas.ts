import { type Db, ejecutar, todos, transaccion, uno } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { semilla } from './semilla.js'
import { codigoSala, idAleatorio, isoUtc, sha256, tokenAleatorio } from './util.js'

export type EstadoSala = 'preparada' | 'inscripcion' | 'r1_abierta' | 'r1_cerrada' | 'r2_abierta' | 'r2_cerrada' | 'cerrada'

export interface SalaFila {
  id: string
  codigo: string
  nombre: string
  plantilla: string
  estado: EstadoSala
  ronda_actual: number
  alcance_resultados: 'mesa' | 'sala'
  vista_participante: 'registrado' | 'en_vivo'
  revelar_hojas: number
  cierre_programado_ronda_at: string | null
  cierre_programado_sala_at: string | null
  token_tablero_hash: string
  token_tablero: string
  version: number
  creada_at: string
}

export interface MesaFila {
  id: string
  sala_id: string
  numero: number
  nombre: string
  codigo: string
}

export const MAX_MESAS = 30

export function cargarSala(db: Db, idOCodigo: string): SalaFila {
  const s = uno<SalaFila>(db, 'SELECT * FROM salas WHERE id = ? OR codigo = ?', idOCodigo, idOCodigo.toUpperCase())
  if (!s) throw new ErrorApi(404, 'SALA_NO_EXISTE', 'No encontramos esa sala.')
  return s
}

export function mesasDeSala(db: Db, salaId: string): MesaFila[] {
  return todos<MesaFila>(db, 'SELECT * FROM mesas WHERE sala_id = ? ORDER BY numero', salaId)
}

/** Sube la versión de la sala (cualquier escritura que cambie lo que ven los clientes). */
export function tocar(db: Db, salaId: string) {
  ejecutar(db, 'UPDATE salas SET version = version + 1 WHERE id = ?', salaId)
}

export function registrarEvento(db: Db, salaId: string, at: number, tipo: string, por: string, detalle?: unknown) {
  ejecutar(
    db,
    'INSERT INTO eventos (sala_id, at, tipo, por, detalle_json) VALUES (?, ?, ?, ?, ?)',
    salaId,
    isoUtc(at),
    tipo,
    por,
    detalle === undefined ? null : JSON.stringify(detalle),
  )
}

export function agregarMesas(db: Db, salaId: string, cantidad: number) {
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new ErrorApi(422, 'CANTIDAD_INVALIDA', 'Indica cuántas mesas quieres agregar (1 o más).')
  return transaccion(db, () => {
    const sala = cargarSala(db, salaId)
    const max = uno<{ n: number | null }>(db, 'SELECT MAX(numero) AS n FROM mesas WHERE sala_id = ?', salaId)?.n ?? 0
    if (max + cantidad > MAX_MESAS) throw new ErrorApi(422, 'CANTIDAD_INVALIDA', `Una sala admite hasta ${MAX_MESAS} mesas.`)
    for (let n = max + 1; n <= max + cantidad; n++) {
      ejecutar(db, 'INSERT INTO mesas (id, sala_id, numero, nombre, codigo) VALUES (?, ?, ?, ?, ?)', idAleatorio('m', 6), salaId, n, `Mesa ${n}`, `${sala.codigo}-${n}`)
    }
    tocar(db, salaId)
    return mesasDeSala(db, salaId)
  })
}

export interface NuevaSala {
  nombre: string
  plantilla: string
  mesas: number
}

/** Crea sala desde la plantilla foodsume_2026: proyectos, hojas, contenido, mesas y token del tablero. */
export function crearSalaDesdePlantilla(db: Db, datos: NuevaSala, ahora: number, por: string) {
  const sem = semilla()
  if (datos.plantilla !== sem.plantilla.id) throw new ErrorApi(422, 'PLANTILLA_NO_EXISTE', `La plantilla "${datos.plantilla}" no existe. Usa "${sem.plantilla.id}".`)
  const nombre = (datos.nombre ?? '').trim()
  if (!nombre || nombre.length > 120) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Escribe un nombre para la sala (máximo 120 caracteres).')
  const nMesas = datos.mesas ?? 1
  if (!Number.isInteger(nMesas) || nMesas < 1 || nMesas > MAX_MESAS) throw new ErrorApi(422, 'CANTIDAD_INVALIDA', `Indica entre 1 y ${MAX_MESAS} mesas.`)

  return transaccion(db, () => {
    let id = idAleatorio('s', 6)
    while (uno(db, 'SELECT 1 FROM salas WHERE id = ?', id)) id = idAleatorio('s', 6)
    let codigo = codigoSala()
    while (uno(db, 'SELECT 1 FROM salas WHERE codigo = ?', codigo)) codigo = codigoSala()
    const token = tokenAleatorio()
    ejecutar(
      db,
      `INSERT INTO salas (id, codigo, nombre, plantilla, estado, token_tablero_hash, token_tablero, creada_at)
       VALUES (?, ?, ?, ?, 'preparada', ?, ?, ?)`,
      id,
      codigo,
      nombre,
      sem.plantilla.id,
      sha256(token),
      token,
      isoUtc(ahora),
    )
    for (const p of sem.plantilla.proyectos) {
      ejecutar(
        db,
        'INSERT INTO proyectos (id, sala_id, nombre, tipo, sector, descripcion, modo, orden, tam, inputs_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        p.id,
        id,
        p.nombre,
        p.tipo,
        p.sector,
        p.descripcion,
        p.modo,
        p.orden,
        p.tam,
        p.modo === 'fijo' && p.inputs ? JSON.stringify(p.inputs) : null,
      )
    }
    for (const h of sem.plantilla.hojas) {
      ejecutar(db, 'INSERT INTO hojas (sala_id, proyecto_id, perfil_id, texto) VALUES (?, ?, ?, ?)', id, h.proyecto_id, h.perfil_id, h.texto)
    }
    ejecutar(
      db,
      'INSERT INTO contenido_sala (sala_id, caso_json, criterios_json, pesos_json, grafico_json) VALUES (?, ?, ?, ?, ?)',
      id,
      JSON.stringify(sem.plantilla.caso),
      JSON.stringify(sem.motor.criterios),
      JSON.stringify(sem.motor.pesos),
      JSON.stringify({ ejes: sem.motor.ejes, grafico: sem.motor.grafico, escala: sem.motor.escala_permitida }),
    )
    agregarMesas(db, id, nMesas)
    registrarEvento(db, id, ahora, 'sala_creada', por, { plantilla: sem.plantilla.id, mesas: nMesas })
    return cargarSala(db, id)
  })
}

/** Sala nueva para ensayos: misma plantilla, mismas mesas y misma configuración de visibilidad; sin inscritos ni votos. */
export function duplicarSala(db: Db, idOCodigo: string, nombre: unknown, ahora: number, por: string) {
  const orig = cargarSala(db, idOCodigo)
  const nMesas = mesasDeSala(db, orig.id).length
  if (nombre !== undefined && nombre !== null && typeof nombre !== 'string') throw new ErrorApi(422, 'DATOS_INVALIDOS', 'El nombre de la sala debe ser texto.')
  const nuevoNombre = (nombre ?? '').trim() || `${orig.nombre.slice(0, 110)} (copia)`
  return transaccion(db, () => {
    const s = crearSalaDesdePlantilla(db, { nombre: nuevoNombre, plantilla: orig.plantilla, mesas: Math.max(1, nMesas) }, ahora, por)
    ejecutar(db, 'UPDATE salas SET alcance_resultados = ?, vista_participante = ? WHERE id = ?', orig.alcance_resultados, orig.vista_participante, s.id)
    registrarEvento(db, s.id, ahora, 'sala_duplicada', por, { desde: orig.id })
    return cargarSala(db, s.id)
  })
}
