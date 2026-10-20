// Recorrido completo del participante en un celular de 360 px contra la API real (BD en memoria):
// inscripción con consentimiento, perfil, caso y hoja, 2 rondas de votación, edición, sin señal (cola),
// recarga, precierre con resultado preliminar, sesión reemplazada y acceso nuevo del facilitador (D1), 6 hojas en R2,
// ronda cerrada mientras califica, comparación R1→R2 en la matriz y sala cerrada.
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { ESPERA, avisarSiCongelada, calificar, capturar, focoVisible, revisarTabla, sinDesborde, tactiles, titulo, ver } from './ayudas'
import { REINTENTOS_E2E, sinNavegador } from '../../../tests/navegador'
import { accion, celular, configurar, crearSala, darAcceso, fijarPregunta, hayChromium, iniciar, inscribirApi, votarApi, type Entorno } from './entorno'

const conNavegador = hayChromium()
if (!conNavegador) sinNavegador('[e2e participante]', 'No hay Chromium de Playwright para el recorrido.')

describe.skipIf(!conNavegador)('recorrido del participante en 360 px contra la API real', { retry: REINTENTOS_E2E }, () => {
  let e: Entorno
  beforeAll(async () => {
    e = await iniciar()
  }, 120_000)
  afterAll(async () => {
    await e?.cerrar()
  }, 30_000)

  it('2 rondas completas con resiliencia, precierre y comparación R1→R2', async () => {
    const sala = await crearSala(e, 'Ensayo e2e celular')
    const mesa = sala.mesas[0].codigo
    // Este recorrido prueba «Voto registrado» y el resultado de la mesa. Por defecto (C5) una sala nueva muestra
    // el consolidado parcial de la sala; eso lo prueba el segundo caso.
    await configurar(e, sala.id, { vista_participante: 'registrado', alcance_resultados: 'mesa' })
    await accion(e, sala.id, 'abrir_inscripcion')
    const ctx = await celular(e)
    const p = await ctx.newPage()
    onTestFailed(() => avisarSiCongelada(p))
    const errores: string[] = []
    p.on('pageerror', (err) => errores.push(err.message))
    // Saltos de diseño (CLS) acumulados desde la primera carga.
    await p.addInitScript(() => {
      const w = window as unknown as { __cls: number }
      w.__cls = 0
      new PerformanceObserver((l) => l.getEntries().forEach((e) => {
        const s = e as unknown as { value: number; hadRecentInput: boolean; sources: { node?: Element; previousRect: DOMRect; currentRect: DOMRect }[] }
        if (!s.hadRecentInput) w.__cls += s.value
        ;(window as unknown as { __src: string[] }).__src ??= []
        for (const x of s.sources ?? []) (window as unknown as { __src: string[] }).__src.push(`${Math.round(e.startTime)} ${s.value.toFixed(3)} ${x.node?.nodeName}.${(x.node as Element)?.className} ${JSON.stringify(x.previousRect)} -> ${JSON.stringify(x.currentRect)} fonts=${document.fonts.status}`)
      })).observe({ type: 'layout-shift', buffered: true })
    })

    // Inscripción: sin consentimiento el botón no avanza.
    await p.goto(`${e.web}/m/${mesa}`)
    await titulo(p, 'Te damos la bienvenida al taller Horizontes', 60_000)
    await sinDesborde(p)
    await p.waitForTimeout(500)
    const cls = await p.evaluate(() => (window as unknown as { __cls: number }).__cls)
    if (cls >= 0.05) console.log(await p.evaluate(() => (window as unknown as { __src: string[] }).__src))
    expect(cls).toBeLessThan(0.05)
    await p.getByLabel('Tu nombre').fill('Ana Pérez')
    await p.getByLabel('Tu correo').fill('ana.e2e@empresa.com')
    const inscribirme = p.getByRole('button', { name: 'Inscribirme' })
    expect(await inscribirme.getAttribute('aria-disabled')).toBe('true')
    await inscribirme.click({ force: true })
    await titulo(p, 'Te damos la bienvenida al taller Horizontes')
    expect(await p.getByRole('link', { name: /Política de Tratamiento de Datos/ }).getAttribute('target')).toBe('_blank')
    // Aviso de datos (Ley 1581) resumido de la política real de Estratek, con canal para ejercer derechos.
    await ver(p, 'Quién trata tus datos')
    // Acta P4: sala sin país = Colombia, con su ley y su autoridad.
    await ver(p, 'La Ley 1581 de 2012 de Colombia')
    await ver(p, /Superintendencia de Industria y Comercio/)
    // La casilla trae el texto hz-1.1 que sirve el servidor para Colombia (C6).
    expect(await p.locator('.hz-casilla__texto').textContent()).toContain('Ley 1581 de 2012')
    expect(await p.getByRole('link', { name: 'info@estratek.com.co' }).getAttribute('href')).toBe('mailto:info@estratek.com.co')
    expect(await p.getByRole('link', { name: /Política de Tratamiento de Datos/ }).getAttribute('href')).toMatch(/^https:\/\/estratek\.com\.co\/politica/)
    await capturar(p, '01-inscripcion')
    await tactiles(p)
    await focoVisible(p, 6)
    await p.getByRole('checkbox').check()
    await inscribirme.click()

    // Perfil asignado, caso y su hoja.
    await titulo(p, /^Tu perfil es /)
    await p.getByRole('button', { name: 'Leer el caso' }).click()
    await titulo(p, 'El caso y tu hoja')
    await ver(p, 'La ronda 1 aún no está abierta. Mientras tanto, lee el caso y tu hoja.')
    await p.getByRole('tab', { name: 'Tu hoja' }).click()
    await p.getByRole('heading', { name: /^Tu hoja como / }).waitFor()
    await sinDesborde(p)

    // Otra persona de la mesa (otro celular, por API).
    const tokenB = await inscribirApi(e, mesa, 'Beto Ruiz', 'beto.e2e@empresa.com')
    const tokenC = await inscribirApi(e, mesa, 'Ciro Ríos', 'ciro.e2e@empresa.com')

    // Ronda 1: el celular se entera solo (polling).
    await accion(e, sala.id, 'abrir_ronda_1')
    await p.getByRole('button', { name: 'Calificar proyectos' }).click({ timeout: ESPERA })
    await titulo(p, 'Ronda 1: califica los 2 proyectos')
    // Acta A7: la ronda 1 es individual y en silencio, con R1 en su insignia.
    await ver(p, 'Individual y en silencio')
    expect(await p.locator('.hzp-fase .hz-insignia--r1').textContent()).toBe('R1')
    await p.getByRole('button', { name: 'Calificar INSUMEX' }).click()
    await titulo(p, 'INSUMEX')
    // C19-5 (P1): una pregunta por pantalla, con su encabezado, su grupo de radios y la barra de progreso.
    await ver(p, 'Pregunta 1 de 6 · INSUMEX')
    expect(await p.locator('fieldset.hz-rubrica').count()).toBe(1)
    expect(await p.getByRole('heading', { level: 2, name: /^Pregunta 1 de 6: / }).count()).toBe(1)
    // Rúbrica para lector de pantalla: grupo con nombre del criterio, pregunta como descripción y opciones "9: texto".
    const grupo = p.getByRole('radiogroup')
    expect(await grupo.getAttribute('aria-required')).toBe('true')
    const descripcion = await grupo.evaluate((g) =>
      (g.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' '),
    )
    expect(descripcion.trim().length).toBeGreaterThan(10)
    expect(await grupo.getByRole('radio', { name: /^9: / }).count()).toBe(1)
    await sinDesborde(p)
    await tactiles(p)
    await focoVisible(p, 8)
    await capturar(p, '02-calificar')
    // Siguiente sin responder y Anterior de vuelta.
    await p.getByRole('button', { name: 'Siguiente' }).click()
    await ver(p, 'Pregunta 2 de 6 · INSUMEX')
    await p.getByRole('button', { name: 'Anterior' }).click()
    await ver(p, 'Pregunta 1 de 6 · INSUMEX')
    // Al elegir pasa sola; tras la sexta, el resumen con Guardar.
    await calificar(p, 7)
    await p.getByRole('heading', { name: 'Revisa tus respuestas' }).waitFor()
    expect(await p.getByRole('button', { name: /^Cambiar / }).count()).toBe(6)
    expect(await p.locator('.hzp-resumen__cifra').allTextContents()).toEqual(['7', '7', '7', '7', '7', '7'])
    await sinDesborde(p)
    await tactiles(p)
    await capturar(p, '02b-resumen')
    await p.getByRole('button', { name: 'Guardar calificación' }).click()
    await ver(p, 'Calificación de INSUMEX guardada.')

    // Sin señal al guardar NUTRIWHAT: queda en la cola y se envía sola al volver.
    await p.getByRole('button', { name: 'Calificar NUTRIWHAT' }).click()
    await titulo(p, 'NUTRIWHAT')
    await calificar(p, 3)
    await ctx.setOffline(true)
    await p.getByRole('button', { name: 'Guardar calificación' }).click()
    await ver(p, '1 calificación por enviar')
    await titulo(p, 'Voto guardado en este celular')
    await capturar(p, '03-sin-senal')
    await ctx.setOffline(false)
    await ver(p, 'Enviamos tu calificación de NUTRIWHAT.')
    await titulo(p, 'Voto registrado')
    await ver(p, '1 de 3 completaron en Mesa 1')

    // Recarga: vuelve a donde iba.
    await p.reload()
    await titulo(p, 'Voto registrado', 30_000)

    // Edición mientras la ronda sigue abierta.
    await p.getByRole('button', { name: 'Editar mis calificaciones' }).click()
    await p.getByRole('button', { name: 'Editar INSUMEX' }).click()
    await titulo(p, 'INSUMEX')
    // Con el voto guardado abre el resumen; corregir una pregunta vuelve al resumen.
    expect(await p.locator('.hzp-resumen__cifra').allTextContents()).toEqual(['7', '7', '7', '7', '7', '7'])
    await calificar(p, 9, [0])
    await p.getByRole('heading', { name: 'Revisa tus respuestas' }).waitFor()
    expect(await p.locator('.hzp-resumen__cifra').allTextContents()).toEqual(['9', '7', '7', '7', '7', '7'])
    await p.getByRole('button', { name: 'Guardar calificación' }).click()
    await ver(p, 'Calificación de INSUMEX guardada.')
    await titulo(p, 'Voto registrado')

    // Precierre: todos votaron en la mesa → aviso y resultado preliminar con la matriz.
    await votarApi(e, tokenB, 'insumex', 1)
    await votarApi(e, tokenC, 'insumex', 1)
    await votarApi(e, tokenB, 'nutriwhat', 1)
    await votarApi(e, tokenC, 'nutriwhat', 1)
    await ver(p, 'Todos votaron en Mesa 1')
    await p.getByRole('heading', { name: 'Resultado preliminar de tu mesa' }).waitFor()
    await ver(p, 'Preliminar')
    await p.locator('.hzp-matriz svg.hz-matriz').waitFor()
    await sinDesborde(p)
    await capturar(p, '04-precierre')

    // Cierre de la ronda 1: resultado sin "Preliminar".
    await accion(e, sala.id, 'cerrar_ronda_1')
    await titulo(p, 'Ronda 1 cerrada')
    await p.locator('.hzp-matriz svg.hz-matriz').waitFor()
    expect(await p.getByText('Preliminar', { exact: true }).count()).toBe(0)
    // C19-3 (P3): junto a cada promedio de INSUMEX, tu calificación (9 en la primera tras corregir, 7 en las demás).
    const insumexR1 = p.locator('.hzp-resultado__proyecto', { hasText: 'INSUMEX' })
    expect(await insumexR1.locator('.hzp-tabla__mia').allTextContents()).toEqual(['Tu calificación: Tú 9', ...Array(5).fill('Tu calificación: Tú 7')])
    await sinDesborde(p)

    // D1: con el mismo correo ya no se entra a la sesión de nadie; el acceso nuevo lo da el facilitador.
    const otro = await celular(e)
    const q = await otro.newPage()
    await q.goto(`${e.web}/m/${mesa}`)
    await q.getByLabel('Tu nombre').fill('Otra Persona', { timeout: 60_000 })
    await q.getByLabel('Tu correo').fill('ANA.E2E@empresa.com')
    await q.getByRole('checkbox').check()
    await q.getByRole('button', { name: 'Inscribirme' }).click()
    await ver(q, /ya está inscrito/)
    expect(await q.evaluate((c) => localStorage.getItem(`hz_token:${c}`), mesa.toUpperCase())).toBeNull()
    await sinDesborde(q)
    // Este celular sigue con su sesión: nadie la tomó con el correo.
    await p.waitForTimeout(3000)
    await titulo(p, 'Ronda 1 cerrada')
    // El facilitador le da acceso en el otro celular: entra, el enlace sale de la URL y este celular pierde la sesión.
    const pid = await p.evaluate(async (c) => {
      const r = await fetch('/api/yo', { headers: { 'X-Participante-Token': localStorage.getItem(`hz_token:${c}`) ?? '' } })
      return ((await r.json()) as { participante: { id: string } }).participante.id
    }, mesa.toUpperCase())
    const primero = await darAcceso(e, pid)
    await q.goto(`${e.web}${primero}`)
    await ver(q, 'Listo, entraste de nuevo. Retomas donde ibas.')
    await titulo(q, 'Ronda 1 cerrada')
    expect(q.url()).not.toContain('acceso=')
    await titulo(p, 'Tu sesión ya no está activa')
    await ver(p, /«Dar acceso de nuevo»/)
    expect(await p.getByRole('button', { name: /Recuperar/ }).count()).toBe(0)
    await sinDesborde(p)
    // Acceso nuevo para este celular: retoma donde iba.
    await p.goto(`${e.web}${await darAcceso(e, pid)}`)
    await ver(p, 'Listo, entraste de nuevo. Retomas donde ibas.')
    await titulo(p, 'Ronda 1 cerrada')
    expect(p.url()).not.toContain('acceso=')
    // Un enlace ya usado no sirve otra vez.
    await q.goto(`${e.web}${primero}`)
    await titulo(q, 'Este enlace ya venció')
    await sinDesborde(q)
    await otro.close()

    // Ronda 2: se revelan las 6 hojas, con la propia primero.
    await accion(e, sala.id, 'abrir_ronda_2')
    await titulo(p, 'Ronda 2: califica los 2 proyectos')
    await ver(p, 'Discusión en la mesa')
    expect(await p.locator('.hzp-fase .hz-insignia--r2').textContent()).toBe('R2')
    await p.getByRole('button', { name: 'Leer el caso y las hojas' }).click()
    await titulo(p, 'El caso y las hojas')
    await p.getByRole('tab', { name: 'Hojas' }).click()
    await ver(p, 'Ya puedes ver la información de los 6 perfiles.')
    const hojas = await p.getByRole('heading', { level: 3 }).allTextContents()
    expect(new Set(hojas.map((h) => h.replace('Tu hoja', '').trim())).size).toBeGreaterThanOrEqual(6)
    expect(hojas[0]).toContain('Tu hoja')
    await sinDesborde(p)
    await p.getByRole('button', { name: 'Calificar proyectos' }).click()
    await p.getByRole('button', { name: 'Calificar INSUMEX' }).click()
    // Triage #16: con las 6 hojas abiertas, el plegable las muestra todas (la propia primero).
    await p.getByRole('button', { name: 'Ver las hojas de este proyecto' }).click()
    expect(await p.locator('#hzp-hojas-calificar .hz-hoja').count()).toBeGreaterThanOrEqual(6)
    await p.getByRole('button', { name: 'Ocultar las hojas de este proyecto' }).click()
    await calificar(p, 9)
    await p.getByRole('button', { name: 'Guardar calificación' }).click()
    await ver(p, 'Calificación de INSUMEX guardada.')
    await p.getByRole('button', { name: 'Calificar NUTRIWHAT' }).click()
    await calificar(p, 1)
    await p.getByRole('button', { name: 'Guardar calificación' }).click()
    await titulo(p, 'Voto registrado')
    await votarApi(e, tokenB, 'insumex', 2)
    await votarApi(e, tokenC, 'insumex', 2)
    await votarApi(e, tokenB, 'nutriwhat', 2)
    await votarApi(e, tokenC, 'nutriwhat', 2)
    await ver(p, 'Todos votaron en Mesa 1')

    // La ronda se cierra mientras edita: mensaje claro y lo marcado no se pierde.
    await p.getByRole('button', { name: 'Editar mis calificaciones' }).click()
    await p.getByRole('button', { name: 'Editar INSUMEX' }).click()
    await calificar(p, 5, [0])
    await accion(e, sala.id, 'cerrar_ronda_2')
    await ver(p, /La ronda 2 se cerró mientras calificabas INSUMEX/)
    await ver(p, /Esos cambios no alcanzaron a guardarse/)
    await titulo(p, 'Ronda 2 cerrada')
    const borrador = await p.evaluate((c) => sessionStorage.getItem(`hz_borrador_insumex_r2:${c}`), mesa.toUpperCase())
    expect(JSON.parse(borrador ?? '{}')).toMatchObject({ alistamiento_tecnico: 5 })

    // Comparación R1→R2 en la matriz: los 2 vivos con su burbuja de cada ronda.
    await ver(p, 'Así se movieron INSUMEX y NUTRIWHAT de la ronda 1 a la ronda 2 en tu mesa.')
    const matriz = p.locator('.hzp-matriz svg.hz-matriz')
    await matriz.waitFor()
    expect(await matriz.locator('.hz-r1').count()).toBeGreaterThanOrEqual(2)
    await sinDesborde(p)
    await capturar(p, '05-comparacion')
    // Estilos globales de otras áreas (p. ej. .hz-cifra del tablero) no deben agrandar el texto del celular.
    const letra = await p.locator('.hzp-tabla td .hzp-tabla__promedio').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(letra).toBeLessThanOrEqual(16)
    // Acta A3 y A4 y preentrega 19-oct: solo los 6 criterios (sin Total), sin ejes ni votos; R1 y R2 con su color y su forma.
    await revisarTabla(p, mesa)
    const encabezado = await p.locator('.hzp-tabla thead th').last().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(encabezado).toBeLessThan(letra)

    // Triage #23: la columna del criterio se queda con el ancho; las cifras, lo justo.
    const anchoCriterio = await p.locator('.hzp-tabla tbody th').first().evaluate((el) => el.getBoundingClientRect().width)
    expect(anchoCriterio).toBeGreaterThan(170)

    // Triage #25: el celular abierto en escritorio muestra la matriz grande y sin desborde.
    await p.setViewportSize({ width: 1920, height: 1080 })
    await p.waitForFunction(() => (document.querySelector('.hzp-matriz svg')?.getBoundingClientRect().width ?? 0) > 900)
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920)
    await capturar(p, '06-comparacion-1920')
    await p.setViewportSize({ width: 360, height: 740 })

    // Triage #17: sin el margen de 8 px del navegador alrededor de la página.
    expect(await p.evaluate(() => getComputedStyle(document.body).marginTop)).toBe('0px')

    // Fin del taller.
    await accion(e, sala.id, 'cerrar_sala')
    await titulo(p, 'El taller terminó')
    expect(await p.locator('body').textContent()).not.toContain('—')
    expect(errores).toEqual([])
    await ctx.close()
  }, 240_000)

  it('por defecto (acta A2, C5): tras votar ve el consolidado parcial de la sala (D2), sin la fila Total', async () => {
    // Sin tocar la configuración: una sala nueva nace con alcance «sala» y vista «en vivo».
    const sala = await crearSala(e, 'En vivo e2e celular')
    await accion(e, sala.id, 'abrir_ronda_1')
    const otro = await inscribirApi(e, sala.mesas[1].codigo, 'Caro Díaz', 'caro.e2e@empresa.com')
    await votarApi(e, otro, 'insumex', 1)
    const otro2 = await inscribirApi(e, sala.mesas[1].codigo, 'Gabo Paz', 'gabo.e2e@empresa.com')
    await votarApi(e, otro2, 'insumex', 1)
    // Alguien de la mesa 1 aún no vota: sin precierre, la pantalla es la del resultado parcial.
    await inscribirApi(e, sala.mesas[0].codigo, 'Eli Mora', 'eli.e2e@empresa.com')
    const ctx = await celular(e)
    const p = await ctx.newPage()
    onTestFailed(() => avisarSiCongelada(p))
    await p.goto(`${e.web}/m/${sala.mesas[0].codigo}`)
    // Un nombre largo sin espacios no ensancha la bienvenida (QA-P-04).
    await p.getByLabel('Tu nombre').fill(`Dani${'a'.repeat(76)}`, { timeout: 60_000 })
    await p.getByLabel('Tu correo').fill('dani.e2e@empresa.com')
    await p.getByRole('checkbox').check()
    await p.getByRole('button', { name: 'Inscribirme' }).click()
    await titulo(p, /^Tu perfil es /)
    await sinDesborde(p)
    await p.getByRole('button', { name: 'Leer el caso' }).click()
    await p.getByRole('button', { name: 'Calificar proyectos' }).click()
    // El botón atrás del celular vuelve al caso y no sale de la app (QA-P-02).
    await titulo(p, 'Ronda 1: califica los 2 proyectos')
    await p.goBack()
    await titulo(p, 'El caso y tu hoja')
    await p.goForward()
    await titulo(p, 'Ronda 1: califica los 2 proyectos')
    for (const nombre of ['INSUMEX', 'NUTRIWHAT']) {
      await p.getByRole('button', { name: `Calificar ${nombre}` }).click()
      await calificar(p, 5)
      await p.getByRole('button', { name: 'Guardar calificación' }).click()
    }
    await titulo(p, 'Resultado parcial de la sala').catch(async (err) => {
      console.log(await p.locator('body').innerText())
      throw err
    })
    await p.locator('.hzp-matriz svg.hz-matriz').waitFor()
    // INSUMEX suma 3 votos en la sala (2 de la mesa 2 y el propio): tabla con los promedios del servidor y tu calificación, sin Total.
    // NUTRIWHAT tiene 1: no se muestra.
    await revisarTabla(p, sala.mesas[0].codigo)
    await ver(p, 'Hacen falta al menos 3 votos para mostrar este proyecto.')
    await sinDesborde(p)
    await ctx.close()
  }, 120_000)

  it('modo guiado (C19-5, P1): ve solo la pregunta del facilitador, envía al completar el proyecto y corrige', async () => {
    const sala = await crearSala(e, 'Guiado e2e celular')
    // La pregunta guiada se borra con cada cambio de estado o de modo: primero el modo y la ronda, después la pregunta.
    await configurar(e, sala.id, { modo_preguntas: 'guiado' })
    await accion(e, sala.id, 'abrir_ronda_1')
    const ctx = await celular(e)
    const p = await ctx.newPage()
    onTestFailed(() => avisarSiCongelada(p))
    const errores: string[] = []
    p.on('pageerror', (err) => errores.push(err.message))
    const codigo = sala.mesas[0].codigo
    await p.goto(`${e.web}/m/${codigo}`)
    await p.getByLabel('Tu nombre').fill('Fer Lara', { timeout: 60_000 })
    await p.getByLabel('Tu correo').fill('fer.e2e@empresa.com')
    await p.getByRole('checkbox').check()
    await p.getByRole('button', { name: 'Inscribirme' }).click()
    await p.getByRole('button', { name: 'Leer el caso' }).click()
    await p.getByRole('button', { name: 'Ir a la pregunta' }).click()
    await titulo(p, 'Espera la pregunta del facilitador')
    await sinDesborde(p)

    const misRespuestas = () =>
      p.evaluate(async (c) => {
        const r = await fetch('/api/yo', { headers: { 'X-Participante-Token': localStorage.getItem(`hz_token:${c.toUpperCase()}`) ?? '' } })
        const yo = (await r.json()) as { mis_votos: { proyecto_id: string; ronda: number; respuestas: Record<string, number> }[] }
        return yo.mis_votos.find((v) => v.proyecto_id === 'insumex' && v.ronda === 1)?.respuestas ?? null
      }, codigo)
    const elegir = (valor: number) => p.locator('label.hz-opcion', { has: p.locator(`input[value="${valor}"]`) }).click()
    const criterios = ['alistamiento_tecnico', 'conocimiento_cliente', 'regulacion', 'capacidades_organizacionales', 'alineacion_core', 'inversion_requerida']

    for (const [i, criterio_id] of criterios.entries()) {
      await fijarPregunta(e, sala.id, { proyecto_id: 'insumex', criterio_id })
      await ver(p, `Pregunta ${i + 1} de 6 · INSUMEX`)
      expect(await p.locator('fieldset.hz-rubrica').count()).toBe(1)
      expect(await p.getByRole('button', { name: /^(Siguiente|Anterior)$/ }).count()).toBe(0)
      if (i === 0) {
        await titulo(p, 'INSUMEX')
        await sinDesborde(p)
        await tactiles(p)
        await capturar(p, '07-guiado')
      }
      await elegir(7)
      await ver(p, 'Espera la siguiente pregunta del facilitador')
      // Hasta completar las 6 del proyecto la respuesta queda en el celular: el servidor no tiene voto.
      if (i < 5) expect(await misRespuestas()).toBeNull()
    }
    await ver(p, 'Tus 6 respuestas de INSUMEX quedaron guardadas. Puedes cambiar esta mientras la ronda siga abierta.')
    expect(await misRespuestas()).toEqual(Object.fromEntries(criterios.map((c) => [c, 7])))

    // El facilitador vuelve a Regulación: aparece con la respuesta marcada y el cambio se reenvía completo.
    await fijarPregunta(e, sala.id, { proyecto_id: 'insumex', criterio_id: 'regulacion' })
    await ver(p, 'Pregunta 3 de 6 · INSUMEX')
    expect(await p.locator('fieldset.hz-rubrica input[value="7"]').isChecked()).toBe(true)
    await elegir(3)
    await expect.poll(async () => (await misRespuestas())?.regulacion, { timeout: ESPERA }).toBe(3)
    expect(errores).toEqual([])
    await ctx.close()
  }, 120_000)
})
