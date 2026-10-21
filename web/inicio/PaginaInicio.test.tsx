// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import PaginaInicio from './PaginaInicio'
import { codigoDeMesa } from './EntradaMesa'
import { HORIZONTES, LECTURA_EJES, LECTURA_ESCALA, NOMBRE_CORTO } from '../shared/criterios'

function Mesa() {
  return <p>Mesa destino {useParams().codigo}</p>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/m/:codigo" element={<Mesa />} />
        <Route path="/admin" element={<p>Panel</p>} />
        <Route path="*" element={<PaginaInicio />} />
      </Routes>
    </MemoryRouter>,
  )
}

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const mesa = (estado: string, inscripcion_abierta: boolean) => ({
  sala: { id: 's1', nombre: 'Taller Bogotá', estado },
  mesa: { id: 'm1', nombre: 'Mesa 2' },
  inscripcion_abierta,
  consentimiento: { version: 'hz-1.1', texto_autorizacion: '', politica_url: '' },
})

function escribirCodigo(texto: string) {
  fireEvent.change(screen.getByLabelText('Código de tu mesa'), { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a mi mesa' }))
}

/** El menú plegable común (EncabezadoProducto), si está abierto. */
const desplegable = () => document.querySelector<HTMLElement>('.hz-producto__desplegable')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('landing de la raíz', () => {
  it('muestra qué es Horizontes, las anclas con su sección y el acceso al panel', () => {
    const { container } = montar()
    expect(screen.getByRole('heading', { level: 1, name: 'La mesa mueve el portafolio' })).toBeTruthy()
    expect(document.title).toContain('Horizontes')
    const secciones = screen.getByRole('navigation', { name: 'Secciones' })
    const anclas = [...secciones.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(anclas).toEqual(['#entrar', '#como-funciona', '#que-se-evalua', '#facilitadores', '#privacidad'])
    for (const a of anclas) expect(container.querySelector(a!)).toBeTruthy()
    const panel = screen.getAllByRole('link', { name: 'Ingresar al panel' })
    expect(panel.length).toBeGreaterThanOrEqual(2)
    for (const l of panel) expect(l.getAttribute('href')).toBe('/admin')
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(6)
    expect(container.textContent).not.toContain('—')
  })

  it('se ve en el tema claro con la barra superior carbón, la marca de Horizontes y el logo oficial de Estratek (20-oct)', () => {
    const { container, unmount } = montar()
    expect(container.querySelector('.hz-inicio')!.getAttribute('data-tema')).toBe('claro')
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro')
    // El carbón queda solo en la barra: el <header> y nada más.
    expect([...container.querySelectorAll('[data-tema="carbon"]')]).toEqual([screen.getByRole('banner')])
    expect(screen.getByRole('link', { name: /Horizontes\s*por Estratek/ }).getAttribute('href')).toBe('#inicio')
    expect(screen.getByRole('heading', { level: 1 }).querySelector('.in-clave')!.textContent).toBe('portafolio')
    // Logo oficial pintado con la tinta del tema (carbón sobre el claro del pie).
    expect(screen.getByRole('img', { name: 'Estratek' }).className).toContain('hz-logo-estratek')
    expect(container.querySelector('footer')!.contains(screen.getByRole('img', { name: 'Estratek' }))).toBe(true)
    unmount()
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false)
  })

  it('explica los 6 criterios con su nombre corto, los dos ejes y la escala impar sin pesos', () => {
    const { container } = montar()
    for (const n of Object.values(NOMBRE_CORTO)) expect(container.textContent).toContain(`${n}.`)
    for (const n of ['Time 2 Market', 'Value Generation Capacity']) expect(container.textContent).toContain(n)
    expect(container.textContent).toContain('1, 3, 5, 7 y 9')
    expect(container.textContent).not.toMatch(/0,3|0,35|0,6|0,7|30 ?%/)
    fireEvent.click(screen.getByRole('radio', { name: /^1:/ }))
    expect(screen.getByText(/Marcaste 1\./)).toBeTruthy()
  })

  it('el código válido consulta la mesa y lleva a /m/:codigo', async () => {
    const f = vi.fn(async () => json(200, mesa('inscripcion', true)))
    vi.stubGlobal('fetch', f)
    montar()
    escribirCodigo('  hz7k2-1 ')
    expect(await screen.findByText('Mesa destino HZ7K2-1')).toBeTruthy()
    expect(f).toHaveBeenCalledWith('/api/mesas/HZ7K2-1', expect.anything())
  })

  it('el código que no existe muestra el error en la misma página', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(404, { error: { codigo: 'MESA_NO_EXISTE', mensaje: 'No encontramos esa mesa.' } })))
    montar()
    escribirCodigo('HZ000-9')
    expect(await screen.findByText(/No encontramos una mesa con el código HZ000-9/)).toBeTruthy()
    expect(screen.getByLabelText('Código de tu mesa').getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByText(/Mesa destino/)).toBeNull()
  })

  it('un texto sin forma de código no llama al servidor', () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    montar()
    escribirCodigo('hola')
    expect(screen.getByText(/no tiene la forma de un código de mesa/)).toBeTruthy()
    expect(f).not.toHaveBeenCalled()
  })

  it('con la inscripción cerrada lo dice y deja ir a la mesa a quien ya se inscribió', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, mesa('cerrada', false))))
    montar()
    escribirCodigo('HZ7K2-2')
    expect((await screen.findByRole('alert')).textContent).toContain('Taller Bogotá ya terminó y no recibe más inscripciones')
    expect(screen.getByRole('link', { name: 'entra a Mesa 2' }).getAttribute('href')).toBe('/m/HZ7K2-2')
  })

  it('la inscripción que aún no abre también se explica', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, mesa('preparada', false))))
    montar()
    escribirCodigo('HZ7K2-2')
    expect((await screen.findByRole('alert')).textContent).toContain('La inscripción de Mesa 2 todavía no abre')
  })
})

describe('codigoDeMesa', () => {
  it('acepta el código o el enlace del QR y rechaza lo demás', () => {
    expect(codigoDeMesa('hz7k2-1')).toBe('HZ7K2-1')
    expect(codigoDeMesa('https://horizontes.estratek.com.co/m/HZ7K2-12')).toBe('HZ7K2-12')
    expect(codigoDeMesa('HZ7K2')).toBeNull()
    expect(codigoDeMesa('')).toBeNull()
    expect(codigoDeMesa('../admin-1')).toBeNull()
  })
})

describe('correcciones de la QA de la landing', () => {
  it('normaliza lo que se teclea en el celular: espacios, sin guion o con guion tipográfico (QA-P-15)', () => {
    expect(codigoDeMesa('HZ5MG - 1')).toBe('HZ5MG-1')
    expect(codigoDeMesa('HZ5MG 1')).toBe('HZ5MG-1')
    expect(codigoDeMesa('hz5mg1')).toBe('HZ5MG-1')
    expect(codigoDeMesa('HZ5MG–1')).toBe('HZ5MG-1')
    expect(codigoDeMesa(' HZ5MG-12 ')).toBe('HZ5MG-12')
    // Formato de mesa con 3 caracteres al azar (S-5): HZ7K2QX4-1.
    expect(codigoDeMesa('hz7k2qx4 - 1')).toBe('HZ7K2QX4-1')
    expect(codigoDeMesa('HZ7K2QX41')).toBe('HZ7K2QX4-1')
    // Si cabe más de una lectura gana la de 5 al azar (una sala tiene hasta 30 mesas).
    expect(codigoDeMesa('HZ7K2Q12123')).toBe('HZ7K2Q1212-3')
    expect(codigoDeMesa('HZ7K2123')).toBe('HZ7K2-123')
    expect(codigoDeMesa('HZ5MG')).toBeNull()
    expect(codigoDeMesa('hola mundo')).toBeNull()
  })

  it('acepta el código de mesa con 5 caracteres al azar (M-1c) y sigue aceptando los de antes', () => {
    expect(codigoDeMesa('HZ7K2QX4AB-1')).toBe('HZ7K2QX4AB-1')
    expect(codigoDeMesa('hz7k2qx4ab - 12')).toBe('HZ7K2QX4AB-12')
    expect(codigoDeMesa('hz7k2qx4ab1')).toBe('HZ7K2QX4AB-1')
    expect(codigoDeMesa('HZ7K2QX4AB30')).toBe('HZ7K2QX4AB-30')
    // El azar puede traer números: HZ7K2 + 23456 + mesa 1.
    expect(codigoDeMesa('HZ7K2234561')).toBe('HZ7K223456-1')
    expect(codigoDeMesa('https://horizontes.estratek.com.co/m/HZ7K2QX4AB-7')).toBe('HZ7K2QX4AB-7')
    // Los de 3 al azar y los viejos siguen igual.
    expect(codigoDeMesa('HZ7K2QX412')).toBe('HZ7K2QX4-12')
    expect(codigoDeMesa('HZ7K2-1')).toBe('HZ7K2-1')
    // Más largo que cualquier código real: no.
    expect(codigoDeMesa('HZ7K2QX4ABC-1')).toBeNull()
  })

  it('el código con espacio lleva a la mesa normalizada', async () => {
    const f = vi.fn(async () => json(200, mesa('inscripcion', true)))
    vi.stubGlobal('fetch', f)
    montar()
    escribirCodigo('hz5mg 1')
    expect(await screen.findByText('Mesa destino HZ5MG-1')).toBeTruthy()
  })

  it('en el celular hay un menú con las secciones y el panel (QA-P-18), el mismo menú común de todas las vistas', () => {
    montar()
    const boton = screen.getByRole('button', { name: 'Menú' })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    expect(desplegable()).toBeNull()
    fireEvent.click(boton)
    const menu = desplegable()!
    expect(boton.getAttribute('aria-expanded')).toBe('true')
    expect(boton.getAttribute('aria-controls')).toBe(menu.id)
    expect([...menu.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['#entrar', '#como-funciona', '#que-se-evalua', '#facilitadores', '#privacidad', '/admin'])
    // Las secciones existen una sola vez: al abrir el menú se mudan de la barra al desplegable.
    expect(screen.getAllByRole('navigation', { name: 'Secciones' })).toHaveLength(1)
    // Elegir una sección cierra el menú; Escape también, y el foco vuelve al botón.
    fireEvent.click(within(menu).getByRole('link', { name: 'Tus datos' }))
    expect(desplegable()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(desplegable()).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menú' }))
    // El menú común se pliega por debajo de 1024 px (64 rem) en todas las vistas.
    const css = readFileSync('web/shared/ui/componentes.css', 'utf8')
    expect(css).toMatch(/@media \(min-width: 64rem\) \{\s*\.hz-producto__menu \{ display: flex; \}\s*\.hz-producto__menu-boton, \.hz-producto__desplegable \{ display: none; \}/)
  })

  it('la ilustración no usa verde agua ni azul en los horizontes, junto a R1 y R2 (QA-P-20)', () => {
    const css = readFileSync('web/inicio/inicio.css', 'utf8')
    expect(css).toMatch(/\.in-matriz__h \{[^}]*fill: var\(--hz-borde-control\)/)
    expect(css).toMatch(/\.in-matriz__horizonte \{ stroke: var\(--hz-borde-control\)/)
  })

  it('el enlace a la mesa en mitad de la frase va en minúscula y al inicio en mayúscula (QA-P-22)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, mesa('cerrada', false))))
    montar()
    escribirCodigo('HZ7K2-2')
    expect((await screen.findByRole('alert')).textContent).toContain('Si te inscribiste desde este celular, entra a Mesa 2 para ver el resultado.')
    cleanup()
    vi.stubGlobal('fetch', vi.fn(async () => json(200, mesa('preparada', false))))
    montar()
    escribirCodigo('HZ7K2-2')
    expect((await screen.findByRole('alert')).textContent).toContain('Entra a Mesa 2 y espera ahí')
  })

  it('la acción del héroe y la del formulario se llaman distinto (QA-P-23)', () => {
    montar()
    const heroe = screen.getByRole('link', { name: 'Escribir el código de mi mesa' })
    expect(heroe.getAttribute('href')).toBe('#entrar')
    expect(screen.getAllByRole('button', { name: 'Entrar a mi mesa' })).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'Entrar a mi mesa' })).toBeNull()
  })

  it('enlaces y botones de 48 px (familia Estratek §5) y el correo en línea también', () => {
    const css = readFileSync('web/inicio/inicio.css', 'utf8')
    expect(css).not.toMatch(/44px/)
    expect(css).toMatch(/\.in-enlace \{[^}]*min-height: var\(--hz-tactil\)/)
    montar()
    const privacidad = document.getElementById('privacidad')!
    expect(within(privacidad).getByRole('link', { name: 'info@estratek.com.co' }).className).toBe('in-enlace')
  })

  it('la sesión perdida la devuelve el facilitador, no el correo (D1)', () => {
    const { container } = montar()
    expect(container.textContent).toContain('si la pierdes, el facilitador te da acceso de nuevo')
    expect(container.textContent).not.toMatch(/recuperas con el mismo correo/)
  })
})

describe('ancho de página estándar', () => {
  it('encabezado, héroe, secciones y pie usan el contenedor .hz-pagina', () => {
    const { container } = montar()
    expect(container.querySelector('.hz-producto__fila')!.classList.contains('hz-pagina')).toBe(true)
    expect(container.querySelector('#inicio')!.classList.contains('hz-pagina')).toBe(true)
    for (const id of ['entrar', 'como-funciona', 'que-se-evalua', 'facilitadores', 'privacidad'])
      expect(container.querySelector(`#${id} > .hz-pagina`), id).toBeTruthy()
    expect(container.querySelector('footer > .hz-pagina')).toBeTruthy()
    expect(readFileSync('web/inicio/inicio.css', 'utf8')).not.toMatch(/--in-ancho|--in-margen/)
  })
})

describe('auditoría final de la landing (20-oct)', () => {
  const css = readFileSync('web/inicio/inicio.css', 'utf8')

  it('sin rayas en ningún texto visible ni en los textos de la página', () => {
    const { container } = montar()
    expect(container.textContent).not.toMatch(/[—–]/)
    for (const f of ['web/inicio/PaginaInicio.tsx', 'web/inicio/EntradaMesa.tsx', 'web/inicio/MatrizIlustrada.tsx', 'web/inicio/contenido.ts'])
      expect(readFileSync(f, 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''), f).not.toMatch(/[—–]/)
  })

  it('habla de la app de hoy: acceso de nuevo por el facilitador, modos «Gráfica» y «Detallado» y «Guía de uso»', () => {
    const { container } = montar()
    const texto = container.textContent!
    expect(texto).toContain('desde ahí le das acceso de nuevo')
    expect(texto).toContain('«Gráfica», con la matriz a pantalla completa, y «Detallado»')
    expect(texto).toContain('la «Guía de uso» del panel')
    expect(texto).not.toMatch(/Recorrido|recupera|mismo correo|Guardar calificación|seis hojas para todos|distinto al de los demás/)
  })

  it('el menú del celular se cierra con un toque fuera de él', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    fireEvent.pointerDown(desplegable()!)
    expect(desplegable()).toBeTruthy()
    fireEvent.pointerDown(screen.getByRole('heading', { level: 1 }))
    expect(desplegable()).toBeNull()
  })

  it('el ejemplo del campo es un código de mesa de hoy y la entrada lo acepta tal cual', () => {
    montar()
    const campo = screen.getByLabelText('Código de tu mesa') as HTMLInputElement
    expect(campo.placeholder).toBe('HZ7K2Q4M8P-1')
    expect(codigoDeMesa(campo.placeholder)).toBe('HZ7K2Q4M8P-1')
  })

  it('los datos personales nombran los tres países de las salas y cada enlace de contacto va en su línea', () => {
    montar()
    const privacidad = document.getElementById('privacidad')!
    expect(privacidad.textContent).toContain('en Colombia, la Ley 1581 de 2012; en Perú, la Ley 29733; en Guatemala, la política de Estratek')
    const enlaces = privacidad.querySelector('.in-enlaces')!
    expect([...enlaces.querySelectorAll('a')].map((a) => a.className)).toEqual(['in-enlace', 'in-enlace'])
  })

  it('el título de cada sección de dos columnas lleva su bajada al lado: la columna no queda vacía', () => {
    montar()
    for (const id of ['facilitadores', 'privacidad']) {
      const columna = document.getElementById(id)!.querySelector('.in-dos > .in-texto')!
      expect(columna.querySelector('h2'), id).toBeTruthy()
      expect(columna.querySelector('.in-bajada'), id).toBeTruthy()
    }
    // «Ingresar al panel» de la sección queda junto al título, no al final de cuatro párrafos.
    expect(document.getElementById('facilitadores')!.querySelector('.in-texto')!.querySelector('a[href="/admin"]')).toBeTruthy()
  })

  it('el héroe tiene aire arriba y abajo y pasa a dos columnas desde la tableta', () => {
    expect(css).toMatch(/\.in-hero \{[^}]*padding-block: clamp\(2rem, 5vw, 4rem\)/)
    expect(css).toMatch(/@media \(min-width: 48rem\) \{\s*\.in-hero \{ grid-template-columns/)
  })

  it('la ilustración: ejes del plano, horizontes con borde y R1 del lado contrario a la flecha', () => {
    const { container } = montar()
    expect(container.querySelector('.in-matriz__ejes')).toBeTruthy()
    expect(css).toMatch(/\.in-matriz__ejes \{[^}]*stroke: var\(--hz-borde-control\)/)
    const r1 = [...container.querySelectorAll('.in-matriz__etiqueta')].filter((t) => t.textContent === 'R1')
    expect(r1.map((t) => t.getAttribute('text-anchor'))).toEqual(['start', 'end'])
  })

  it('la landing no fuerza el carbón ni define colores propios', () => {
    expect(readFileSync('web/inicio/PaginaInicio.tsx', 'utf8')).not.toMatch(/useTemaDocumento\('carbon'\)|data-tema="carbon"/)
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })
})

describe('QA por roles de la landing (20-oct)', () => {
  const css = readFileSync('web/inicio/inicio.css', 'utf8')

  it('Horizontes es la herramienta; el taller es donde se usa', () => {
    const { container } = montar()
    expect(container.textContent).toContain('Horizontes es la herramienta de Estratek para priorizar el portafolio por horizontes.')
    expect(container.textContent).toContain('Horizontes, una herramienta de Estratek')
    expect(container.textContent).not.toMatch(/Horizontes es el taller|Un taller de Estratek/)
    expect(document.title).toBe('Horizontes · Priorización de portafolio por horizontes · Estratek')
  })

  it('la ronda 1 se califica por tu cuenta, no «solo»', () => {
    const { container } = montar()
    expect(container.textContent).toContain('Calificas por tu cuenta, con lo que sabes, los dos proyectos en seis criterios.')
    expect(container.textContent).not.toContain('Calificas solo')
  })

  it('la escala, los ejes y los horizontes usan los textos compartidos', () => {
    const { container } = montar()
    const evalua = document.getElementById('que-se-evalua')!
    expect(evalua.textContent).toContain(`En todos los criterios, ${LECTURA_ESCALA}`)
    expect(evalua.querySelector('.in-lectura')!.textContent).toBe(LECTURA_EJES)
    expect(container.querySelector('.in-matriz figcaption')!.textContent).toContain(LECTURA_EJES)
    expect([...container.querySelectorAll('.in-matriz__extremo')].map((t) => t.textContent)).toEqual(['lejos del mercado', 'lejos del core'])
    const bloque = within(evalua).getByRole('heading', { level: 3, name: 'Los tres horizontes' }).parentElement!
    const items = [...bloque.querySelectorAll('.in-horizontes li')].map((li) => li.textContent)
    expect(items).toEqual(HORIZONTES.map((h) => `${h.id}${h.nombre}: ${h.texto}.`))
  })

  it('«Tus datos» dice lo que de verdad se guarda y quién lo ve (aviso hz-1.3)', () => {
    montar()
    const datos = document.getElementById('privacidad')!.textContent!.replace(/\s+/g, ' ')
    expect(datos).toContain('Tu nombre, tu correo y tus calificaciones. Por seguridad, también la IP, el país y el navegador desde donde entras.')
    expect(datos).toContain('identificarte en tu mesa, evitar inscripciones dobles y devolverte el acceso si cambias de celular')
    expect(datos).toContain('En el tablero y en los celulares nadie ve tu nombre: se ven los promedios de tu mesa o de la sala, que se actualizan con cada calificación. El equipo de Estratek que facilita el taller sí ve tus calificaciones con tu nombre, para conducirlo.')
    expect(datos).not.toContain('3 personas')
    expect(datos).toContain('los datos se guardan en servidores fuera del Perú')
    // La promesa vieja era falsa: el facilitador sí ve las respuestas con el nombre.
    expect(datos).not.toMatch(/Resultados anónimos|Solo tu nombre y tu correo/)
  })

  it('cierra con el bloque comercial y el correo de Estratek', () => {
    montar()
    const contacto = document.getElementById('contacto')!
    expect(within(contacto).getByRole('heading', { level: 2 }).textContent).toBe('¿Quieres este taller para tu equipo directivo?')
    expect(contacto.textContent).toContain('Escríbenos a info@estratek.com.co')
    expect(within(contacto).getByRole('link', { name: 'info@estratek.com.co' }).getAttribute('href')).toBe('mailto:info@estratek.com.co')
    expect(contacto.querySelector('.hz-pagina')).toBeTruthy()
    // Es lo último de la página antes del pie.
    expect(document.querySelector('main')!.lastElementChild).toBe(contacto)
  })

  it('«Cómo funciona»: seis pasos con su número en grande y un pictograma propio cada uno', () => {
    const { container } = montar()
    const pasos = [...container.querySelectorAll('#como-funciona .in-paso')]
    expect(pasos).toHaveLength(6)
    expect(pasos.map((p) => p.querySelector('.in-paso__numero')!.textContent)).toEqual(['1', '2', '3', '4', '5', '6'])
    const pict = pasos.map((p) => p.querySelector('svg.in-pict')!)
    expect(new Set(pict.map((s) => s.getAttribute('data-paso'))).size).toBe(6)
    for (const s of pict) {
      expect(s.getAttribute('aria-hidden')).toBe('true')
      expect(s.getAttribute('viewBox')).toBe('0 0 48 48')
      expect(s.querySelectorAll('path, circle, rect').length).toBeGreaterThanOrEqual(3)
    }
    // Las rondas llevan sus formas: R1 hueca en el paso 4, R2 sólida en el 5 y las dos en la matriz.
    expect(pict[3].querySelector('.in-r1-forma')).toBeTruthy()
    expect(pict[4].querySelector('.in-r2-forma')).toBeTruthy()
    expect(pict[5].querySelector('.in-r1-forma') && pict[5].querySelector('.in-r2-forma')).toBeTruthy()
    // Ya no quedan los arcos vacíos de antes.
    expect(container.querySelector('.in-paso__arco, .in-paso__lamina')).toBeNull()
    expect(css).toMatch(/\.in-paso__numero \{[^}]*font-weight: var\(--hz-fw-display\)/)
    expect(css).toMatch(/\.in-pict__trazo \{[^}]*stroke: var\(--hz-tinta\); stroke-width: 3; stroke-linecap: round/)
  })
})
