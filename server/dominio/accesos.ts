// Acceso de nuevo dado por el facilitador (D1, 20-oct): reemplaza la recuperación de la sesión con solo el correo.
// El facilitador genera desde el panel un enlace personal de un solo uso (`/m/{codigoMesa}?acceso=…`) que vence a los
// 15 minutos; el celular lo canjea por un token nuevo, que cierra las demás sesiones de esa persona. Se guarda solo el hash.
import { type Db, ejecutar, todos, transaccion, uno } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { type ParticipanteFila, participantePublico } from './participantes.js'
import { type MesaFila, cargarSala, registrarEvento, tocar } from './salas.js'
import { isoEnZona, isoUtc, sha256, tokenAleatorio } from './util.js'

export const MENSAJE_CORREO_YA_INSCRITO = 'Ese correo ya está inscrito en esta sala. Pide al facilitador que te dé acceso de nuevo.'
export const MENSAJE_ACCESO_VENCIDO = 'Este enlace de acceso ya se usó o venció. Pide al facilitador que te dé acceso de nuevo.'
export const MENSAJE_ACCESO_INVALIDO = 'Este enlace de acceso no es válido. Pide al facilitador que te dé acceso de nuevo.'

/** Vigencia del enlace de acceso. */
export const VIGENCIA_ACCESO_MS = 15 * 60_000

interface AccesoFila {
  token_hash: string
  participante_id: string
  sala_id: string
  creado_at: string
  vence_at: string
  usado_at: string | null
  por: string
}

/**
 * «Dar acceso de nuevo» (panel): enlace de un solo uso para la persona. Un enlace nuevo vence los anteriores sin usar.
 * 409 SALA_CERRADA (no hay recuperación con la sala cerrada) · 409 PARTICIPANTE_INACTIVO · 404 PARTICIPANTE_NO_EXISTE.
 */
export function darAcceso(db: Db, participanteId: string, baseUrl: string, ahora: number, por: string) {
  return transaccion(db, () => {
    const p = uno<ParticipanteFila>(db, 'SELECT * FROM participantes WHERE id = ?', participanteId)
    if (!p) throw new ErrorApi(404, 'PARTICIPANTE_NO_EXISTE', 'Ese participante no existe.')
    const sala = cargarSala(db, p.sala_id)
    if (sala.estado === 'cerrada') throw new ErrorApi(409, 'SALA_CERRADA', 'La sala está cerrada: ya no se puede dar acceso de nuevo.')
    if (!p.activo) throw new ErrorApi(409, 'PARTICIPANTE_INACTIVO', 'Ese participante está desactivado. Actívalo antes de darle acceso de nuevo.')
    const mesa = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE id = ?', p.mesa_id)!
    const pendientes = todos<Pick<AccesoFila, 'token_hash' | 'vence_at'>>(
      db,
      'SELECT token_hash, vence_at FROM accesos_participante WHERE participante_id = ? AND usado_at IS NULL',
      p.id,
    )
    for (const a of pendientes) {
      if (Date.parse(a.vence_at) > ahora) ejecutar(db, 'UPDATE accesos_participante SET vence_at = ? WHERE token_hash = ?', isoUtc(ahora), a.token_hash)
    }
    const token = tokenAleatorio()
    const vence = ahora + VIGENCIA_ACCESO_MS
    ejecutar(
      db,
      'INSERT INTO accesos_participante (token_hash, participante_id, sala_id, creado_at, vence_at, usado_at, por) VALUES (?, ?, ?, ?, ?, NULL, ?)',
      sha256(token),
      p.id,
      sala.id,
      isoUtc(ahora),
      isoUtc(vence),
      por,
    )
    const venceAt = isoEnZona(vence, sala.zona_horaria)!
    registrarEvento(db, sala.id, ahora, 'acceso_reemitido', por, { participante_id: p.id, vence_at: venceAt })
    tocar(db, sala.id)
    return { url: `${baseUrl.replace(/\/+$/, '')}/m/${encodeURIComponent(mesa.codigo)}?acceso=${token}`, vence_at: venceAt }
  })
}

/**
 * Canje del enlace en el celular: token nuevo (el anterior deja de servir) y el enlace queda gastado.
 * 404 ACCESO_INVALIDO · 410 ACCESO_VENCIDO · 409 SALA_CERRADA · 403 PARTICIPANTE_INACTIVO · 422 DATOS_INVALIDOS.
 */
export function canjearAcceso(db: Db, acceso: unknown, ahora: number) {
  const valor = typeof acceso === 'string' ? acceso.trim() : ''
  if (!valor || valor.length > 200) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Falta el código de acceso. Abre de nuevo el enlace que te dio el facilitador.')
  return transaccion(db, () => {
    const a = uno<AccesoFila>(db, 'SELECT * FROM accesos_participante WHERE token_hash = ?', sha256(valor))
    const p = a && uno<ParticipanteFila>(db, 'SELECT * FROM participantes WHERE id = ?', a.participante_id)
    if (!a || !p) throw new ErrorApi(404, 'ACCESO_INVALIDO', MENSAJE_ACCESO_INVALIDO)
    if (a.usado_at || !(Date.parse(a.vence_at) > ahora)) throw new ErrorApi(410, 'ACCESO_VENCIDO', MENSAJE_ACCESO_VENCIDO)
    const sala = cargarSala(db, p.sala_id)
    if (sala.estado === 'cerrada') throw new ErrorApi(409, 'SALA_CERRADA', 'Esta sala ya se cerró.')
    if (!p.activo) throw new ErrorApi(403, 'PARTICIPANTE_INACTIVO', 'Tu inscripción está desactivada. Habla con el facilitador.')
    const token = tokenAleatorio()
    // Una sola sesión por participante: el hash nuevo reemplaza al anterior, así se cierran las demás.
    ejecutar(db, 'UPDATE participantes SET token_hash = ? WHERE id = ?', sha256(token), p.id)
    ejecutar(db, 'UPDATE accesos_participante SET usado_at = ? WHERE token_hash = ?', isoUtc(ahora), a.token_hash)
    registrarEvento(db, sala.id, ahora, 'acceso_canjeado', 'sistema', { participante_id: p.id })
    tocar(db, sala.id)
    const mesa = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE id = ?', p.mesa_id)!
    return { token, participante: participantePublico(p, mesa) }
  })
}
