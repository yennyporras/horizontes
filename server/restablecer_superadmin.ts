// Restablece la cuenta superadministradora con la clave del entorno (SUPERADMIN_CLAVE). Para cuando se pierde la clave:
// ninguna otra cuenta puede restablecerla desde el panel. Si la cuenta no existe, la crea. Cierra sus sesiones abiertas.
// Uso (local):      SUPERADMIN_CLAVE='…' npm run admin:restablecer -- --confirmar
// Uso (producción): en la terminal del contenedor en Coolify, con la clave nueva ya puesta en SUPERADMIN_CLAVE:
//                   node_modules/.bin/tsx server/restablecer_superadmin.ts --confirmar
// Opcional: --usuario <usuario> (por defecto SUPERADMIN_USUARIO). Sin --confirmar solo dice qué haría.
// La clave nunca se imprime. Se puede correr con el servidor arriba (SQLite en WAL).
import { argumento } from './cli.js'
import { config } from './config.js'
import { abrirDb, uno } from './db/index.js'
import { restablecerSuperadmin } from './dominio/admins.js'

const usuario = (argumento('usuario') ?? config.superadminUsuario).trim().toLowerCase()
const clave = config.superadminClave
if (!usuario || !clave) {
  console.error('Faltan SUPERADMIN_USUARIO (o --usuario) y SUPERADMIN_CLAVE en el entorno. No se cambió nada.')
  process.exit(2)
}
const db = abrirDb(config.dbPath)
try {
  const existe = uno<{ rol: string }>(db, 'SELECT rol FROM admins WHERE usuario = ?', usuario)
  const que = existe ? `restablecer la clave de "${usuario}" con SUPERADMIN_CLAVE y cerrar sus sesiones` : `crear la cuenta superadministradora "${usuario}" con SUPERADMIN_CLAVE`
  if (!process.argv.includes('--confirmar')) {
    console.log(`Se va a ${que}. Nada cambió. Repite con --confirmar.`)
  } else {
    const r = restablecerSuperadmin(db, usuario, clave, Date.now())
    console.log(r === 'creado' ? `Listo: cuenta superadministradora "${usuario}" creada.` : `Listo: clave de "${usuario}" restablecida. Sus sesiones abiertas se cerraron.`)
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  db.close()
}
