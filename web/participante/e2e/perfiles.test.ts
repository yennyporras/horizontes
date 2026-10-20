// Recorrido del participante en 3 celulares emulados contra la API real: Chrome Android (Chromium),
// Safari iOS (WebKit, el motor real de Safari) y Samsung Internet (Chromium con su user agent).
// Inscripción, 2 rondas de votación, resultado de la ronda 1, comparación R1→R2, recarga y sala cerrada.
// Sin WebKit instalado (`npx playwright-core install webkit`), ese perfil se omite con aviso. Sin Chromium, en CI falla.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calificar, revisarTabla, sinDesborde, tactiles, titulo, ver } from './ayudas'
import { sinNavegador } from '../../../tests/navegador'
import { accion, celularPerfil, crearSala, hayNavegador, iniciar, inscribirApi, PERFILES_MOVILES, votarApi, type Entorno } from './entorno'

const disponibles = PERFILES_MOVILES.filter((p) => hayNavegador(p.motor))
// Sin Chromium no corre ningún perfil (en CI falla); sin WebKit solo se omite Safari, con aviso (CI no lo instala).
if (!hayNavegador('chromium')) sinNavegador('[e2e perfiles]', 'No hay Chromium de Playwright para los celulares emulados.')
for (const p of PERFILES_MOVILES.filter((x) => x.motor !== 'chromium' && !disponibles.includes(x))) {
  console.warn(`[e2e perfiles] No hay ${p.motor} de Playwright: se omite ${p.nombre}.`)
}

describe.skipIf(disponibles.length === 0)('recorrido del participante en celulares emulados', () => {
  let e: Entorno
  beforeAll(async () => {
    e = await iniciar()
  }, 120_000)
  afterAll(async () => {
    await e?.cerrar()
  }, 30_000)

  it.each(disponibles.map((p) => [p.nombre, p] as const))(
    '%s',
    async (nombre, perfil) => {
      const sala = await crearSala(e, `Perfiles ${nombre}`)
      const mesa = sala.mesas[0].codigo
      const n = disponibles.indexOf(perfil)
      await accion(e, sala.id, 'abrir_inscripcion')
      const ctx = await celularPerfil(e, perfil)
      const p = await ctx.newPage()
      const errores: string[] = []
      p.on('pageerror', (err) => errores.push(err.message))
      // WebKit en Windows es varias veces más lento que Chromium con la suite completa en paralelo.
      const espera = perfil.motor === 'webkit' ? 40_000 : 15_000
      p.setDefaultTimeout(espera)
      try {
        // Inscripción con consentimiento.
        await p.goto(`${e.web}/m/${mesa}`)
        await titulo(p, 'Te damos la bienvenida al taller Horizontes', 60_000)
        expect(await p.evaluate(() => navigator.userAgent)).toBe(perfil.contexto.userAgent)
        await sinDesborde(p)
        await tactiles(p)
        await p.getByLabel('Tu nombre').fill('Ana Pérez')
        await p.getByLabel('Tu correo').fill(`ana.perfil${n}@empresa.com`)
        await p.getByRole('checkbox').check()
        await p.getByRole('button', { name: 'Inscribirme' }).click()
        await titulo(p, /^Tu perfil es /, espera)
        const tokenB = await inscribirApi(e, mesa, 'Beto Ruiz', `beto.perfil${n}@empresa.com`)
        const tokenC = await inscribirApi(e, mesa, 'Ciro Ríos', `ciro.perfil${n}@empresa.com`)

        // Ronda 1: califica los 2 proyectos con toques en las rúbricas.
        await accion(e, sala.id, 'abrir_ronda_1')
        await p.getByRole('button', { name: 'Leer el caso' }).click()
        await titulo(p, 'El caso y tu hoja', espera)
        await sinDesborde(p)
        await p.getByRole('button', { name: 'Calificar proyectos' }).click()
        await titulo(p, 'Ronda 1: califica los 2 proyectos', espera)
        for (const [proyecto, valor] of [
          ['INSUMEX', 7],
          ['NUTRIWHAT', 3],
        ] as const) {
          await p.getByRole('button', { name: `Calificar ${proyecto}` }).click()
          await titulo(p, proyecto, espera)
          await calificar(p, valor)
          await sinDesborde(p)
          await p.getByRole('button', { name: 'Guardar calificación' }).click()
        }
        // Por defecto (acta A2, C5): tras votar, el consolidado parcial de la sala (D2: se renueva de 3 en 3). Con 1 voto, el aviso de mínimo.
        await titulo(p, 'Resultado parcial de la sala', espera)
        await ver(p, 'Hacen falta al menos 3 votos para mostrar estos resultados.', espera)
        await votarApi(e, tokenB, 'insumex', 1)
        await votarApi(e, tokenC, 'insumex', 1)
        await votarApi(e, tokenB, 'nutriwhat', 1)
        await votarApi(e, tokenC, 'nutriwhat', 1)
        await ver(p, /^Todos votaron en Mesa 1/, espera)
        await accion(e, sala.id, 'cerrar_ronda_1')
        await titulo(p, 'Ronda 1 cerrada', espera)
        await p.locator('.hzp-matriz svg.hz-matriz').waitFor()
        await sinDesborde(p)

        // Ronda 2 y comparación R1→R2.
        await accion(e, sala.id, 'abrir_ronda_2')
        await titulo(p, 'Ronda 2: califica los 2 proyectos', espera)
        await p.getByRole('button', { name: 'Calificar INSUMEX' }).click()
        await calificar(p, 9)
        await p.getByRole('button', { name: 'Guardar calificación' }).click()
        for (const t of [tokenB, tokenC]) for (const pid of ['insumex', 'nutriwhat']) await votarApi(e, t, pid, 2)
        await p.getByRole('button', { name: 'Calificar NUTRIWHAT' }).click()
        await calificar(p, 1)
        await p.getByRole('button', { name: 'Guardar calificación' }).click()
        await titulo(p, 'Voto registrado', espera)
        // Triage #15: guarda y la ronda se cierra enseguida; el "guardada" no pasa a la pantalla de ronda cerrada.
        await ver(p, 'Calificación de NUTRIWHAT guardada.', espera)
        await accion(e, sala.id, 'cerrar_ronda_2')
        await titulo(p, 'Ronda 2 cerrada', espera)
        expect(await p.getByText(/Calificación de .* guardada\./).count()).toBe(0)
        const matriz = p.locator('.hzp-matriz svg.hz-matriz')
        await matriz.waitFor()
        expect(await matriz.locator('.hz-r1').count()).toBeGreaterThanOrEqual(2)
        await revisarTabla(p, mesa)
        await sinDesborde(p)

        // Recarga: vuelve a la misma pantalla (sesión guardada en el celular).
        await p.reload()
        await titulo(p, 'Ronda 2 cerrada', 2 * espera)

        await accion(e, sala.id, 'cerrar_sala')
        await titulo(p, 'El taller terminó', espera)
        expect(await p.locator('body').textContent()).not.toContain('—')
        expect(errores).toEqual([])
      } catch (err) {
        // Para diagnosticar: qué decía la pantalla cuando falló.
        console.log(`[${nombre}] pantalla al fallar:
${await p
  .locator('body')
  .innerText()
  .catch(() => '(sin página)')}`)
        throw err
      } finally {
        await ctx.close()
      }
    },
    300_000,
  )
})
