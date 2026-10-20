// @vitest-environment jsdom
// QA por roles del 20-oct (inversionista, Nicolai, Paula, empresa cliente, jurado y Paola CTO), en el panel y contra el
// simulador: métricas y tipo de sala, modo demo, Sala en vivo, Exportar, el panel sin la semilla y los textos.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { CLAVE_GUIA } from './componentes/GuiaUso'
import { CRITERIOS_BASE, contenidoDe } from './contenido'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar(usuario = 'paola') {
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: usuario } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'demo1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
}

const nav = () => within(screen.getByRole('navigation', { name: 'Secciones del panel' }))

/** La sala demo del simulador: ronda 1 abierta, modo guiado, Mesa 1 completa y las demás con gente pendiente. */
async function abrirDemo(usuario = 'paola') {
  montar('/admin/login')
  await entrar(usuario)
  fireEvent.click(screen.getAllByRole('link', { name: 'Abrir' })[0])
  await screen.findByRole('heading', { name: 'Sala en vivo' })
}

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  localStorage.removeItem('hz_admin_sala')
  localStorage.setItem(CLAVE_GUIA, '1,2,3,4,5')
  usarTransporte(responderMock)
})
afterEach(cleanup)

/** Archivos del panel que viajan al navegador (sin pruebas ni el simulador, que solo existe en desarrollo). */
function archivosDelPanel(dir = __dirname): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f)
    if (statSync(ruta).isDirectory()) return f === 'mock' ? [] : archivosDelPanel(ruta)
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [ruta] : []
  })
}

describe('el panel sin la semilla (fuga de datos del caso)', () => {
  it('ningún archivo del panel importa data/seed_foodsume.json', () => {
    const conSemilla = archivosDelPanel().filter((f) => /(from|import)\s*\(?\s*['"][^'"]*seed_foodsume/.test(readFileSync(f, 'utf8')))
    expect(conSemilla).toEqual([])
  })

  it('los criterios salen en el orden del motor con los nombres cortos compartidos y el detalle manda si los trae', () => {
    expect(CRITERIOS_BASE.map((c) => c.corto)).toEqual([
      'Alistamiento técnico',
      'Conocimiento del cliente',
      'Regulación',
      'Capacidades organizacionales',
      'Alineación con el core',
      'Inversión para probar',
    ])
    const c = contenidoDe(
      { criterios: [{ id: 'regulacion', nombre: 'Regulación vigente', pregunta: '¿Qué tan regulado?' }], proyectos_vivos: [{ id: 'x', nombre: 'X' }], perfiles: [{ id: 'p', nombre: 'P' }] },
      { proyectosVivos: [{ id: 'y', nombre: 'Y' }] },
    )
    expect(c.criterios).toEqual([{ id: 'regulacion', nombre: 'Regulación vigente', corto: 'Regulación', pregunta: '¿Qué tan regulado?' }])
    expect(c.proyectosVivos).toEqual([{ id: 'x', nombre: 'X' }])
    expect(c.perfiles).toEqual([{ id: 'p', nombre: 'P' }])
  })

  it('sin criterios ni proyectos en el detalle, la pregunta guiada y Respuestas los toman de las rúbricas y las hojas de la sala', async () => {
    await abrirDemo()
    const guiada = screen.getByRole('region', { name: 'Pregunta en pantalla' })
    // La pregunta de la sala demo: INSUMEX · Regulación, con su texto de la rúbrica.
    expect(await within(guiada).findByText('INSUMEX · Regulación')).toBeTruthy()
    expect(within(guiada).getByText(/Pregunta 3 de 6 · INSUMEX · ronda 1/)).toBeTruthy()
    const proyecto = within(guiada).getByLabelText('Proyecto') as HTMLSelectElement
    expect([...proyecto.options].map((o) => o.textContent)).toEqual(['INSUMEX', 'NUTRIWHAT'])
    fireEvent.click(nav().getByText('Participantes'))
    const perfil = (await screen.findByLabelText('Perfil de Ana Pérez')) as HTMLSelectElement
    expect([...perfil.options].map((o) => o.textContent)).toContain('Estratégica')
  })
})
