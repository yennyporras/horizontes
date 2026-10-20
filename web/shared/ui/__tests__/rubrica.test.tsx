// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Rubrica } from '../Rubrica'

afterEach(cleanup)

const opciones = [1, 3, 5, 7, 9].map((valor) => ({ valor, texto: `Nivel ${valor}` }))

describe('Rubrica: lectura de la escala (QA por roles del 20-oct)', () => {
  it('con `escala`, la línea va bajo la pregunta y el grupo la anuncia después de la pregunta', () => {
    render(<Rubrica criterioId="c" nombre="Regulación" pregunta="¿Qué tantas barreras?" opciones={opciones} valor={null} onCambio={() => undefined} escala="1 es cerca; 9, lejos." />)
    const grupo = screen.getByRole('radiogroup')
    const ids = (grupo.getAttribute('aria-describedby') ?? '').split(' ')
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual(['¿Qué tantas barreras?', '1 es cerca; 9, lejos.'])
    expect(screen.getByText('1 es cerca; 9, lejos.').closest('legend')).toBeTruthy()
  })

  it('sin `escala` no agrega nada', () => {
    const { container } = render(<Rubrica criterioId="c" nombre="C" pregunta="P" opciones={opciones} valor={null} onCambio={() => undefined} />)
    expect(container.querySelector('.hz-rubrica__escala')).toBeNull()
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')!.split(' ')).toHaveLength(1)
  })
})
