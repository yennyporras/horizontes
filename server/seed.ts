// Semilla: crea el superadmin desde .env (idempotente) y, opcionalmente, una sala desde la plantilla.
// Uso:
//   npm run seed                                   -> solo superadmin (SUPERADMIN_USUARIO / SUPERADMIN_CLAVE)
//   npm run seed -- --sala "Taller Jorge" --mesas 4 -> además crea una sala foodsume_2026 con 4 mesas
import { config } from './config.js'
import { abrirDb } from './db/index.js'
import { asegurarSuperadmin } from './dominio/admins.js'
import { mesasDeSala, crearSalaDesdePlantilla } from './dominio/salas.js'
import { urls } from './dominio/gestion.js'

const arg = (nombre: string) => {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const db = abrirDb(config.dbPath)
const r = asegurarSuperadmin(db, config.superadminUsuario, config.superadminClave, Date.now())
console.log(
  r === 'sin_config'
    ? 'Superadmin: falta SUPERADMIN_USUARIO / SUPERADMIN_CLAVE en el entorno. No se creó.'
    : `Superadmin "${config.superadminUsuario}": ${r === 'creado' ? 'creado' : 'ya existía (no se tocó la clave)'}`,
)

const nombreSala = arg('sala')
if (nombreSala) {
  const sala = crearSalaDesdePlantilla(db, { nombre: nombreSala, plantilla: 'foodsume_2026', mesas: Number(arg('mesas') ?? 4) }, Date.now(), 'sistema')
  console.log(`Sala ${sala.nombre} · id ${sala.id} · código ${sala.codigo}`)
  console.log(`Tablero: ${urls(config.baseUrl, sala).url_tablero}`)
  for (const m of mesasDeSala(db, sala.id)) console.log(`  ${m.nombre}: ${urls(config.baseUrl, sala, m).url_participante}`)
}
db.close()
