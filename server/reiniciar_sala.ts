// Reinicio limpio de la sala del taller: respalda la BD y deja la sala como recién creada (sin participantes,
// votos ni eventos), con las mismas mesas, QR y enlace del tablero. Pensado para después del ensayo general.
// Uso (local):      npm run sala:reiniciar -- --sala <id o código> --confirmar
// Uso (producción): docker exec <contenedor> node_modules/.bin/tsx server/reiniciar_sala.ts --sala <código> --confirmar
// Sin --confirmar solo muestra qué se borraría. Se puede correr con el servidor arriba (SQLite en WAL).
import { argumento } from './cli.js'
import { config } from './config.js'
import { abrirDb, uno } from './db/index.js'
import { reiniciarSalaLimpia, respaldarBd } from './dominio/mantenimiento.js'
import { cargarSala } from './dominio/salas.js'

const salaArg = argumento('sala')
if (!salaArg) {
  console.error('Falta --sala <id o código>.')
  process.exit(2)
}
const db = abrirDb(config.dbPath)
try {
  const sala = cargarSala(db, salaArg)
  const contar = (sql: string) => (uno<{ n: number }>(db, sql, sala.id)?.n ?? 0)
  const resumen = {
    participantes: contar('SELECT COUNT(*) AS n FROM participantes WHERE sala_id = ?'),
    votos: contar('SELECT COUNT(*) AS n FROM votos WHERE sala_id = ?'),
    eventos: contar('SELECT COUNT(*) AS n FROM eventos WHERE sala_id = ?'),
  }
  console.log(`Sala ${sala.nombre} · id ${sala.id} · código ${sala.codigo} · estado ${sala.estado}`)
  console.log(`Se borrarían ${resumen.participantes} participantes (con sus consentimientos), ${resumen.votos} votos y ${resumen.eventos} eventos.`)
  if (!process.argv.includes('--confirmar')) {
    console.log('Nada cambió. Repite con --confirmar para reiniciar.')
  } else {
    const respaldo = respaldarBd(db, config.dbPath, sala.id, 'antes_reinicio_limpio', Date.now(), sala.zona_horaria)
    console.log(`Respaldo: ${respaldo ?? '(BD en memoria, sin respaldo)'}`)
    const r = reiniciarSalaLimpia(db, sala.id, Date.now())
    console.log(`Listo: sala en estado ${r.sala.estado}. Borrados: ${JSON.stringify(r.borrados)}.`)
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  db.close()
}
