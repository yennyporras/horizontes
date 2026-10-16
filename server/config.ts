import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Carga .env si existe (Node >= 21.7). En producción las variables llegan del entorno.
const envFile = resolve(process.cwd(), '.env')
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile)

export const RAIZ = process.cwd()

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '127.0.0.1',
  useMocks: process.env.USE_MOCKS === '1' || process.argv.includes('--mocks'),
  dbPath: process.env.DB_PATH ?? resolve(RAIZ, 'data', 'horizontes.sqlite'),
  baseUrl: process.env.BASE_URL ?? 'http://localhost:5173',
  politicaUrl: process.env.POLITICA_PRIVACIDAD_URL ?? 'https://estratek.com.co/politica-de-tratamiento-de-datos',
  superadminUsuario: process.env.SUPERADMIN_USUARIO ?? '',
  superadminClave: process.env.SUPERADMIN_CLAVE ?? '',
}
