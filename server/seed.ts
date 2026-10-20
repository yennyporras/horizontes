// Semilla: crea el superadmin desde .env (idempotente) y, opcionalmente, una sala desde la plantilla.
// Uso:
//   npm run seed                                   -> solo superadmin (SUPERADMIN_USUARIO / SUPERADMIN_CLAVE)
//   npm run seed -- --sala "Taller Jorge" --mesas 4 -> además crea una sala foodsume_2026 con 4 mesas
import { argumento } from './cli.js'
import { config } from './config.js'
import { abrirDb } from './db/index.js'
import { asegurarSuperadmin } from './dominio/admins.js'
import { mesasDeSala, crearSalaDesdePlantilla } from './dominio/salas.js'
import { urls } from './dominio/gestion.js'

const db = abrirDb(config.dbPath)
const r = asegurarSuperadmin(db, config.superadminUsuario, config.superadminClave, Date.now())
console.log(
  r === 'sin_config'
    ? 'Superadmin: falta SUPERADMIN_USUARIO / SUPERADMIN_CLAVE en el entorno. No se creó.'
    : `Superadmin "${config.superadminUsuario}": ${r === 'creado' ? 'creado' : 'ya existía (no se tocó la clave)'}`,
)

const nombreSala = argumento('sala')
if (nombreSala) {
  const sala = crearSalaDesdePlantilla(db, { nombre: nombreSala, plantilla: 'foodsume_2026', mesas: Number(argumento('mesas') ?? 4) }, Date.now(), 'sistema')
  console.log(`Sala ${sala.nombre} · id ${sala.id} · código ${sala.codigo}`)
  console.log(`Tablero: ${urls(config.baseUrl, sala).url_tablero}`)
  for (const m of mesasDeSala(db, sala.id)) console.log(`  ${m.nombre}: ${urls(config.baseUrl, sala, m).url_participante}`)
}
db.close()
