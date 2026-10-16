// Administradores (SPEC §9): superadmin (solo desde .env) y admin (solo lo crea el superadmin).
// Tablas y sesiones separadas de los participantes: no existe ruta para promover a un participante.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { type Db, ejecutar, todos, transaccion, uno } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { isoBogota, isoUtc, sha256, tokenAleatorio } from './util.js'

export interface AdminFila {
  id: number
  usuario: string
  nombre: string
  correo: string | null
  rol: 'superadmin' | 'admin'
  activo: number
  debe_cambiar_clave: number
  creado_por: number | null
  clave_hash: string
  creado_at: string
}

export const DURACION_SESION_MS = 12 * 3600_000
export const LARGO_MINIMO_CLAVE = 8

export function hashClave(clave: string): string {
  const sal = randomBytes(16)
  const h = scryptSync(clave, sal, 32)
  return `scrypt$${sal.toString('base64')}$${h.toString('base64')}`
}

export function verificarClave(clave: string, guardado: string): boolean {
  const [alg, sal, h] = guardado.split('$')
  if (alg !== 'scrypt' || !sal || !h) return false
  const esperado = Buffer.from(h, 'base64')
  const calc = scryptSync(clave, Buffer.from(sal, 'base64'), esperado.length)
  return timingSafeEqual(esperado, calc)
}

export const adminPublico = (a: AdminFila) => ({
  id: a.id,
  usuario: a.usuario,
  nombre: a.nombre,
  correo: a.correo,
  rol: a.rol,
  activo: Boolean(a.activo),
  debe_cambiar_clave: Boolean(a.debe_cambiar_clave),
  creado_at: isoBogota(a.creado_at),
})

const RE_USUARIO = /^[a-z0-9._-]{3,60}$/

function validarClave(clave: unknown): string {
  if (typeof clave !== 'string' || clave.length < LARGO_MINIMO_CLAVE || clave.length > 200) {
    throw new ErrorApi(422, 'CLAVE_INVALIDA', `La clave debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`)
  }
  return clave
}

/** Crea el superadmin desde .env si no existe (idempotente: si ya existe, no toca su clave). */
export function asegurarSuperadmin(db: Db, usuario: string, clave: string, ahora: number): 'creado' | 'existente' | 'sin_config' {
  const u = usuario.trim().toLowerCase()
  if (!u || !clave) return 'sin_config'
  if (uno(db, 'SELECT 1 FROM admins WHERE usuario = ?', u)) return 'existente'
  ejecutar(
    db,
    `INSERT INTO admins (usuario, nombre, correo, rol, activo, debe_cambiar_clave, creado_por, clave_hash, creado_at)
     VALUES (?, ?, NULL, 'superadmin', 1, 0, NULL, ?, ?)`,
    u,
    u,
    hashClave(clave),
    isoUtc(ahora),
  )
  return 'creado'
}

// Hash ficticio para que un usuario inexistente tarde lo mismo que uno real (sin enumeración por tiempo).
let hashFicticio: string | null = null

export function login(db: Db, usuario: unknown, clave: unknown, ahora: number) {
  const a = uno<AdminFila>(db, 'SELECT * FROM admins WHERE usuario = ?', String(usuario ?? '').trim().toLowerCase())
  const ok = verificarClave(typeof clave === 'string' ? clave : '', a?.clave_hash ?? (hashFicticio ??= hashClave('ficticia-no-usar')))
  if (!a || typeof clave !== 'string' || !ok || !a.activo) {
    throw new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'Usuario o clave incorrectos.')
  }
  const token = tokenAleatorio()
  ejecutar(db, 'DELETE FROM sesiones_admin WHERE expira_at <= ?', isoUtc(ahora))
  ejecutar(db, 'INSERT INTO sesiones_admin (token_hash, admin_id, creada_at, expira_at) VALUES (?, ?, ?, ?)', sha256(token), a.id, isoUtc(ahora), isoUtc(ahora + DURACION_SESION_MS))
  return { token, admin: a }
}

export function logout(db: Db, token: string | undefined) {
  if (token) ejecutar(db, 'DELETE FROM sesiones_admin WHERE token_hash = ?', sha256(token))
}

export function adminDeSesion(db: Db, token: string | undefined, ahora: number): AdminFila | null {
  if (!token) return null
  const a = uno<AdminFila>(
    db,
    `SELECT a.* FROM sesiones_admin s JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ? AND s.expira_at > ? AND a.activo = 1`,
    sha256(token),
    isoUtc(ahora),
  )
  return a ?? null
}

export function cambiarClave(db: Db, a: AdminFila, actual: unknown, nueva: unknown) {
  if (typeof actual !== 'string' || !verificarClave(actual, a.clave_hash)) throw new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'La clave actual no es correcta.')
  const n = validarClave(nueva)
  if (n === actual) throw new ErrorApi(422, 'CLAVE_INVALIDA', 'La clave nueva debe ser distinta de la actual.')
  ejecutar(db, 'UPDATE admins SET clave_hash = ?, debe_cambiar_clave = 0 WHERE id = ?', hashClave(n), a.id)
}

// --- Gestión de administradores (solo superadmin) ------------------------------------

export function exigirSuperadmin(a: AdminFila) {
  if (a.rol !== 'superadmin') throw new ErrorApi(403, 'SOLO_SUPERADMIN', 'Solo la superadministradora puede gestionar administradores.')
}

export function listarAdmins(db: Db) {
  return todos<AdminFila>(db, 'SELECT * FROM admins ORDER BY id').map(adminPublico)
}

export interface DatosAdmin {
  usuario?: unknown
  nombre?: unknown
  correo?: unknown
  clave_temporal?: unknown
}

export function crearAdmin(db: Db, por: AdminFila, d: DatosAdmin, ahora: number) {
  exigirSuperadmin(por)
  const usuario = typeof d.usuario === 'string' ? d.usuario.trim().toLowerCase() : ''
  const nombre = typeof d.nombre === 'string' ? d.nombre.trim() : ''
  const correo = typeof d.correo === 'string' && d.correo.trim() ? d.correo.trim().toLowerCase() : null
  if (!RE_USUARIO.test(usuario)) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'El usuario debe tener entre 3 y 60 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
  if (!nombre || nombre.length > 120) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Escribe el nombre del administrador.')
  const clave = validarClave(d.clave_temporal)
  return transaccion(db, () => {
    if (uno(db, 'SELECT 1 FROM admins WHERE usuario = ?', usuario)) throw new ErrorApi(409, 'USUARIO_EXISTE', 'Ya existe un administrador con ese usuario.')
    // El rol siempre es admin: por API no se crea otro superadmin.
    const r = ejecutar(
      db,
      `INSERT INTO admins (usuario, nombre, correo, rol, activo, debe_cambiar_clave, creado_por, clave_hash, creado_at)
       VALUES (?, ?, ?, 'admin', 1, 1, ?, ?, ?)`,
      usuario,
      nombre,
      correo,
      por.id,
      hashClave(clave),
      isoUtc(ahora),
    )
    return adminPublico(uno<AdminFila>(db, 'SELECT * FROM admins WHERE id = ?', Number(r.lastInsertRowid))!)
  })
}

export interface CambiosAdmin {
  activo?: unknown
  nombre?: unknown
  correo?: unknown
  restablecer_clave?: unknown
}

export function editarAdmin(db: Db, por: AdminFila, id: number, d: CambiosAdmin) {
  exigirSuperadmin(por)
  return transaccion(db, () => {
    const a = uno<AdminFila>(db, 'SELECT * FROM admins WHERE id = ?', id)
    if (!a) throw new ErrorApi(404, 'ADMIN_NO_EXISTE', 'Ese administrador no existe.')
    if (a.rol === 'superadmin' && (d.activo === false || d.restablecer_clave !== undefined)) {
      throw new ErrorApi(409, 'OPERACION_INVALIDA', 'La cuenta superadministradora no se desactiva ni se restablece desde aquí.')
    }
    let claveTemporal: string | undefined
    if (d.activo !== undefined) {
      if (typeof d.activo !== 'boolean') throw new ErrorApi(422, 'DATOS_INVALIDOS', 'activo debe ser true o false.')
      ejecutar(db, 'UPDATE admins SET activo = ? WHERE id = ?', d.activo ? 1 : 0, id)
      if (!d.activo) ejecutar(db, 'DELETE FROM sesiones_admin WHERE admin_id = ?', id)
    }
    if (d.nombre !== undefined) {
      if (typeof d.nombre !== 'string' || !d.nombre.trim()) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Escribe el nombre del administrador.')
      ejecutar(db, 'UPDATE admins SET nombre = ? WHERE id = ?', d.nombre.trim(), id)
    }
    if (d.correo !== undefined) {
      ejecutar(db, 'UPDATE admins SET correo = ? WHERE id = ?', typeof d.correo === 'string' && d.correo.trim() ? d.correo.trim().toLowerCase() : null, id)
    }
    if (d.restablecer_clave !== undefined && d.restablecer_clave !== false) {
      // true → el servidor genera una clave temporal; texto → se usa como clave temporal.
      claveTemporal = d.restablecer_clave === true ? randomBytes(9).toString('base64url') : validarClave(d.restablecer_clave)
      ejecutar(db, 'UPDATE admins SET clave_hash = ?, debe_cambiar_clave = 1 WHERE id = ?', hashClave(claveTemporal), id)
      ejecutar(db, 'DELETE FROM sesiones_admin WHERE admin_id = ?', id)
    }
    const r = adminPublico(uno<AdminFila>(db, 'SELECT * FROM admins WHERE id = ?', id)!)
    return claveTemporal ? { ...r, clave_temporal: claveTemporal } : r
  })
}
