// Servidor simulado en memoria con la forma de docs/CONTRATO_API.md y los ejemplos de mocks/.
// Solo para desarrollo: usuarios de prueba paola/demo1234 (superadmin) y jorge/demo1234 (admin).
import detalleBase from '../../../../mocks/GET_api_admin_salas_id.json'
import type { Accion, AdminFila, AdminYo, EstadoSala, SalaDetalle, SalaResumen } from '../tipos'
import { ACCIONES_POR_ESTADO } from '../textos'
import type { Respuesta } from '../api'

const CLAVE_DEMO = 'demo1234'
const LLAVE_SESION = 'hz_admin_mock'

type AdminInterno = AdminFila & { clave: string }

interface Estado {
  admins: AdminInterno[]
  salas: SalaDetalle[]
  version: number
}

function inicial(): Estado {
  const base = structuredClone(detalleBase) as SalaDetalle
  return {
    version: 123,
    admins: [
      { id: 1, usuario: 'paola', nombre: 'Paola Porras', correo: 'desarrollo@estratek.com.co', rol: 'superadmin', activo: true, debe_cambiar_clave: false, clave: CLAVE_DEMO },
      { id: 2, usuario: 'jorge', nombre: 'Jorge Puentes', correo: null, rol: 'admin', activo: true, debe_cambiar_clave: false, clave: CLAVE_DEMO },
    ],
    salas: [base],
  }
}

let estado = inicial()

export function reiniciarMock() {
  estado = inicial()
  sessionStorage.removeItem(LLAVE_SESION)
}

const ok = (body: unknown, status = 200): Respuesta => ({ status, body })
const error = (status: number, codigo: string, mensaje: string): Respuesta => ({ status, body: { error: { codigo, mensaje } } })

function sesion(): AdminInterno | undefined {
  const id = Number(sessionStorage.getItem(LLAVE_SESION))
  return estado.admins.find((a) => a.id === id && a.activo)
}

const yo = (a: AdminFila): AdminYo => ({ id: a.id, usuario: a.usuario, nombre: a.nombre, rol: a.rol, debe_cambiar_clave: a.debe_cambiar_clave })

function filaPublica(a: AdminInterno): AdminFila {
  const { clave: _clave, ...resto } = a
  return resto
}

function resumen(s: SalaDetalle): SalaResumen {
  const { config: _config, ...resto } = s.sala
  return resto
}

function tocar(s: SalaDetalle, tipo: string, por: string, detalle: Record<string, unknown> = {}) {
  estado.version += 1
  s.version = `v-${String(estado.version).padStart(6, '0')}`
  s.eventos.unshift({ at: new Date().toISOString(), tipo, detalle, por })
}

const SIGUIENTE: Partial<Record<Accion, EstadoSala>> = {
  abrir_inscripcion: 'inscripcion',
  abrir_ronda_1: 'r1_abierta',
  cerrar_ronda_1: 'r1_cerrada',
  abrir_ronda_2: 'r2_abierta',
  cerrar_ronda_2: 'r2_cerrada',
  cerrar_sala: 'cerrada',
  reabrir_sala: 'r2_cerrada',
}

function aplicarAccion(s: SalaDetalle, accion: Accion): EstadoSala | null {
  if (!ACCIONES_POR_ESTADO[s.sala.estado].includes(accion)) return null
  if (accion === 'reiniciar_ronda') return s.sala.estado
  if (accion === 'reabrir_ronda') return s.sala.estado === 'r1_cerrada' ? 'r1_abierta' : 'r2_abierta'
  return SIGUIENTE[accion] ?? null
}

function crearSala(b: Record<string, unknown>, por: string): Respuesta {
  const nombre = String(b.nombre ?? '').trim()
  const n = Number(b.mesas)
  if (!nombre || !(n >= 1 && n <= 20)) return error(422, 'DATOS_INVALIDOS', 'Escribe un nombre y entre 1 y 20 mesas.')
  const codigo = Math.random().toString(36).slice(2, 7).toUpperCase()
  const nueva = structuredClone(estado.salas[0])
  nueva.sala = {
    ...nueva.sala,
    id: `s_${codigo.toLowerCase()}`,
    codigo,
    nombre,
    estado: 'preparada',
    ronda_actual: 0,
    creada_at: new Date().toISOString(),
    config: { alcance_resultados: 'mesa', vista_participante: 'registrado', revelar_hojas: false, cierre_programado_ronda_at: null, cierre_programado_sala_at: null },
  }
  nueva.mesas = Array.from({ length: n }, (_, i) => ({
    id: `m${i + 1}`,
    nombre: `Mesa ${i + 1}`,
    codigo: `${codigo}-${i + 1}`,
    url_participante: `https://horizontes.estratek.com.co/m/${codigo}-${i + 1}`,
    url_tablero: `https://horizontes.estratek.com.co/tablero/${codigo}?mesa=m${i + 1}&t=TOKEN`,
    inscritos: 0,
    completos: 0,
    precierre: false,
    perfiles: {},
  }))
  nueva.participantes = []
  nueva.eventos = []
  tocar(nueva, 'sala_creada', por)
  estado.salas.push(nueva)
  return ok(resumen(nueva), 201)
}

function admins(metodo: string, camino: string, b: Record<string, unknown>, a: AdminInterno): Respuesta {
  if (a.rol !== 'superadmin') return error(403, 'SOLO_SUPERADMIN', 'Solo el superadmin puede gestionar administradores.')
  if (metodo === 'GET') return ok(estado.admins.map(filaPublica))
  if (metodo === 'POST') {
    if (!b.usuario || !b.nombre || !b.clave_temporal) return error(422, 'DATOS_INVALIDOS', 'Usuario, nombre y clave temporal son obligatorios.')
    if (estado.admins.some((x) => x.usuario === b.usuario)) return error(409, 'USUARIO_EXISTE', 'Ese usuario ya existe.')
    const nuevo: AdminInterno = {
      id: Math.max(...estado.admins.map((x) => x.id)) + 1,
      usuario: String(b.usuario),
      nombre: String(b.nombre),
      correo: (b.correo as string) || null,
      rol: 'admin',
      activo: true,
      debe_cambiar_clave: true,
      clave: String(b.clave_temporal),
    }
    estado.admins.push(nuevo)
    return ok(filaPublica(nuevo), 201)
  }
  const objetivo = estado.admins.find((x) => x.id === Number(camino.split('/').pop()))
  if (metodo === 'PATCH' && objetivo) {
    if (objetivo.rol === 'superadmin') return error(409, 'NO_EDITABLE', 'El superadmin se administra desde el servidor.')
    if (typeof b.activo === 'boolean') objetivo.activo = b.activo
    if (typeof b.nombre === 'string') objetivo.nombre = b.nombre
    if (typeof b.correo === 'string') objetivo.correo = b.correo
    if (typeof b.restablecer_clave === 'string') {
      objetivo.clave = b.restablecer_clave
      objetivo.debe_cambiar_clave = true
    }
    return ok(filaPublica(objetivo))
  }
  return error(404, 'NO_EXISTE', 'Ese administrador no existe.')
}

export async function responderMock(metodo: string, ruta: string, cuerpo?: unknown, etag?: string): Promise<Respuesta> {
  const [camino] = ruta.split('?')
  const b = (cuerpo ?? {}) as Record<string, unknown>

  if (metodo === 'POST' && camino === '/api/admin/login') {
    const a = estado.admins.find((x) => x.usuario === b.usuario && x.activo)
    if (!a || a.clave !== b.clave) return error(401, 'CREDENCIALES_INVALIDAS', 'Usuario o clave incorrectos.')
    sessionStorage.setItem(LLAVE_SESION, String(a.id))
    return ok(yo(a))
  }
  if (metodo === 'POST' && camino === '/api/admin/logout') {
    sessionStorage.removeItem(LLAVE_SESION)
    return ok({ ok: true })
  }

  const a = sesion()
  if (!a) return error(401, 'NO_AUTENTICADO', 'Tu sesión terminó. Vuelve a iniciar sesión.')
  const por = `admin:${a.usuario}`

  if (metodo === 'GET' && camino === '/api/admin/yo') return ok(yo(a))

  if (metodo === 'POST' && camino === '/api/admin/cambiar-clave') {
    if (b.actual !== a.clave) return error(422, 'CLAVE_ACTUAL_INVALIDA', 'La clave actual no coincide.')
    if (typeof b.nueva !== 'string' || b.nueva.length < 10) return error(422, 'CLAVE_DEBIL', 'La clave nueva debe tener al menos 10 caracteres.')
    a.clave = b.nueva
    a.debe_cambiar_clave = false
    return ok(yo(a))
  }

  if (camino.startsWith('/api/admin/admins')) return admins(metodo, camino, b, a)

  if (camino === '/api/admin/salas') {
    if (metodo === 'GET') return ok(estado.salas.map(resumen))
    if (metodo === 'POST') return crearSala(b, por)
  }

  const m = /^\/api\/admin\/salas\/([^/]+)(\/.*)?$/.exec(camino)
  if (m) {
    const s = estado.salas.find((x) => x.sala.id === m[1])
    if (!s) return error(404, 'SALA_NO_EXISTE', 'Esa sala no existe.')
    const resto = m[2] ?? ''
    if (metodo === 'GET' && resto === '') {
      if (etag && etag === s.version) return { status: 304, body: null, etag }
      return { status: 200, body: { ...structuredClone(s), admin_actual: yo(a) }, etag: s.version }
    }
    if (metodo === 'PATCH' && resto === '/config') {
      Object.assign(s.sala.config, b)
      tocar(s, 'config', por, b)
      return ok(s.sala.config)
    }
    if (metodo === 'POST' && resto === '/acciones') {
      const destino = aplicarAccion(s, b.accion as Accion)
      if (!destino) return error(409, 'TRANSICION_INVALIDA', 'Esa acción no aplica en el estado actual de la sala.')
      s.sala.estado = destino
      if (destino === 'r1_abierta') s.sala.ronda_actual = 1
      if (destino === 'r2_abierta') {
        s.sala.ronda_actual = 2
        s.sala.config.revelar_hojas = true
      }
      tocar(s, String(b.accion), por)
      return ok({ estado: destino })
    }
  }

  const p = /^\/api\/admin\/participantes\/([^/]+)$/.exec(camino)
  if (metodo === 'PATCH' && p) {
    for (const s of estado.salas) {
      const par = s.participantes.find((x) => x.id === p[1])
      if (par) {
        Object.assign(par, b)
        tocar(s, 'participante_editado', por, { id: par.id })
        return ok(par)
      }
    }
    return error(404, 'PARTICIPANTE_NO_EXISTE', 'Ese participante no existe.')
  }

  return error(404, 'RUTA_NO_EXISTE', `El simulador no conoce ${metodo} ${camino}.`)
}
