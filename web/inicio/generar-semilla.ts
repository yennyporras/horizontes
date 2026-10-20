// Regenera web/inicio/semilla_inicio.json desde data/seed_foodsume.json: `npx tsx web/inicio/generar-semilla.ts`.
// No lo importa la app; lo corre quien cambie la semilla (semilla.test.ts avisa si quedó desfasado).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import seed from '../../data/seed_foodsume.json'
import { proyectarSemilla } from './semilla'

const destino = fileURLToPath(new URL('semilla_inicio.json', import.meta.url))
writeFileSync(destino, JSON.stringify(proyectarSemilla(seed), null, 2) + '\n')
console.log(`Escrito ${destino}`)
