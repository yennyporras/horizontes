// Rúbricas editables por el admin (pedido de Paola, 19-oct): si los rangos llegan a cambiar, se ajustan sin tocar código.
// Solo cambian los textos de los 5 niveles; valores, pesos, nombres de criterio y motor quedan igual.
import { type Db, ejecutar, transaccion, uno } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { contenido, olvidarContenido } from './resultados.js'
import { cargarSala, registrarEvento, tocar } from './salas.js'
import { sinRayas } from './semilla.js'
import { isoUtc } from './util.js'

export const MAX_TEXTO_RUBRICA = 300
const VALORES = [1, 3, 5, 7, 9]
// Sin caracteres de control, llaves ni marcado: el texto sale en el celular, el panel y la papeleta. > y < sueltos sí
// (rangos como «> USD 1MM», que ya trae la semilla); < pegado a una letra, / ! o ? parece una etiqueta y no.
const RE_PROHIBIDO = /[\u0000-\u001f\u007f{}]|<[a-zA-Z/!?]/

export const MOTIVO_CON_VOTOS =
  'La sala ya tiene votos. Las rúbricas solo se editan antes del primer voto, para que todos califiquen con los mismos rangos. Si necesitas otros rangos, duplica la sala y edítalos en la copia.'

const tieneVotos = (db: Db, salaId: string) => Boolean(uno(db, 'SELECT 1 FROM votos WHERE sala_id = ? LIMIT 1', salaId))

export function rubricasSala(db: Db, idOCodigo: string) {
  const sala = cargarSala(db, idOCodigo)
  const editable = !tieneVotos(db, sala.id)
  return {
    criterios: contenido(db, sala.id).criterios.map((c) => ({ id: c.id, nombre: c.nombre, pregunta: c.pregunta, rubrica: c.rubrica })),
    editable,
    ...(editable ? {} : { motivo_no_editable: MOTIVO_CON_VOTOS }),
  }
}

export interface CambioRubrica {
  rubrica?: unknown
  usar_en_salas_nuevas?: unknown
}

const invalida = (mensaje: string) => new ErrorApi(422, 'RUBRICA_INVALIDA', mensaje)

/** Textos por valor, ya recortados y sin rayas. 422 RUBRICA_INVALIDA si algo no cumple. */
function validarRubrica(rubrica: unknown): Map<number, string> {
  const niveles = Array.isArray(rubrica) ? (rubrica as { valor?: unknown; texto?: unknown }[]) : []
  const valores = niveles.map((n) => (n && typeof n === 'object' ? n.valor : undefined))
  if (niveles.length !== VALORES.length || !VALORES.every((v) => valores.includes(v))) {
    throw invalida('La rúbrica debe traer un texto para cada valor: 1, 3, 5, 7 y 9, sin repetir ninguno.')
  }
  const textos = new Map<number, string>()
  for (const n of niveles) {
    const texto = typeof n.texto === 'string' ? sinRayas(n.texto.trim()).trim() : ''
    if (!texto) throw invalida(`Escribe el texto del nivel ${n.valor}.`)
    if (texto.length > MAX_TEXTO_RUBRICA) throw invalida(`El texto del nivel ${n.valor} pasa de ${MAX_TEXTO_RUBRICA} caracteres. Acórtalo.`)
    if (RE_PROHIBIDO.test(texto)) throw invalida(`El texto del nivel ${n.valor} tiene caracteres no permitidos: llaves { }, saltos de línea o un < pegado a una letra. Para un rango escribe, por ejemplo, < USD 10k.`)
    textos.set(n.valor as number, texto)
  }
  return textos
}

/** Cambia los textos de la rúbrica de un criterio de la sala; opcionalmente, también para las salas nuevas de su plantilla. */
export function editarRubrica(db: Db, idOCodigo: string, criterioId: string, d: CambioRubrica, ahora: number, por: string) {
  const sala = cargarSala(db, idOCodigo)
  const criterios = contenido(db, sala.id).criterios
  const criterio = criterios.find((c) => c.id === criterioId)
  if (!criterio) throw new ErrorApi(422, 'CRITERIO_NO_EXISTE', `El criterio "${criterioId}" no existe en esta sala.`)
  const textos = validarRubrica(d.rubrica)
  if (d.usar_en_salas_nuevas !== undefined && typeof d.usar_en_salas_nuevas !== 'boolean') {
    throw invalida('usar_en_salas_nuevas debe ser true o false.')
  }
  const paraNuevas = d.usar_en_salas_nuevas === true
  // Mismo orden y mismos valores que ya tenía el criterio: solo cambian los textos.
  const rubrica = criterio.rubrica.map((r) => ({ valor: r.valor, texto: textos.get(r.valor)! }))

  transaccion(db, () => {
    if (tieneVotos(db, sala.id)) throw new ErrorApi(409, 'RUBRICA_CON_VOTOS', MOTIVO_CON_VOTOS)
    const nuevos = criterios.map((c) => (c.id === criterioId ? { ...c, rubrica } : c))
    ejecutar(db, 'UPDATE contenido_sala SET criterios_json = ? WHERE sala_id = ?', JSON.stringify(nuevos), sala.id)
    olvidarContenido(db, sala.id)
    if (paraNuevas) {
      ejecutar(
        db,
        `INSERT INTO rubricas_plantilla (plantilla, criterio_id, rubrica_json, actualizado_at, por) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (plantilla, criterio_id) DO UPDATE SET rubrica_json = excluded.rubrica_json, actualizado_at = excluded.actualizado_at, por = excluded.por`,
        sala.plantilla,
        criterioId,
        JSON.stringify(rubrica),
        isoUtc(ahora),
        por,
      )
    }
    registrarEvento(db, sala.id, ahora, 'rubrica_editada', por, { criterio_id: criterioId, usar_en_salas_nuevas: paraNuevas })
    tocar(db, sala.id)
  })
  return rubricasSala(db, sala.id)
}
