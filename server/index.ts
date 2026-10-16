import { config } from './config.js'
import { construirApp } from './app.js'

const app = await construirApp({ mocks: config.useMocks, logger: true })
await app.listen({ port: config.port, host: config.host })
app.log.info(`Horizontes API en http://${config.host}:${config.port} (${config.useMocks ? 'MOCKS' : 'API real'})`)
