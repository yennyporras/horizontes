// Proceso hijo del simulador: la API real sin log por stdout (en Windows escribir a un pipe es síncrono
// y frena el event loop). Manda al padre, por IPC y en lotes, el tiempo de cada respuesta dentro del servidor.
import { construirApp } from '../../server/app.js'
import { config } from '../../server/config.js'

const app = await construirApp({ mocks: false, logger: false })
let lote: number[] = []
app.addHook('onResponse', async (_req, reply) => {
  lote.push(reply.elapsedTime)
})
const t = setInterval(() => {
  if (lote.length) process.send?.({ tiempos: lote })
  lote = []
}, 500)
process.on('message', async (m: { cerrar?: boolean }) => {
  if (!m.cerrar) return
  clearInterval(t)
  if (lote.length) process.send?.({ tiempos: lote })
  await app.close()
  process.exit(0)
})
await app.listen({ port: config.port, host: config.host })
process.send?.({ listo: true })
