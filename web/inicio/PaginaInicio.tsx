// Landing pública de la raíz `/`. Qué es Horizontes, cómo se entra a una mesa, cómo funciona y dónde está el panel.
// Tema claro con la barra superior carbón, como el celular, el tablero y el panel (decisión de Paola del 20-oct).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EncabezadoProducto, LogoEstratek, Rubrica, useTemaDocumento } from '../shared/ui'
import { CORREO_ESTRATEK, EJES, RUBRICA_EJEMPLO, URL_POLITICA } from './contenido'
import { EntradaMesa } from './EntradaMesa'
import { MatrizIlustrada } from './MatrizIlustrada'
import './inicio.css'

const TITULO = 'Horizontes · Taller de priorización de portafolio · Estratek'

const PASOS: { titulo: string; texto: string; ronda?: 'r1' | 'r2' | 'r1r2' }[] = [
  { titulo: 'Escanea el QR o escribe el código', texto: 'Cada mesa tiene su QR. Lo escaneas con la cámara del celular o escribes el código en esta página.' },
  { titulo: 'Inscríbete', texto: 'Tu nombre, tu correo y tu autorización de datos. La app te asigna uno de los seis perfiles y los reparte para que en la mesa haya miradas distintas.' },
  { titulo: 'Lee el caso y tu hoja', texto: 'El caso Foodsume es igual para todos. Tu hoja trae lo que solo sabe tu perfil sobre INSUMEX y NUTRIWHAT.' },
  { titulo: 'Ronda 1, en silencio', texto: 'Calificas solo, con lo que sabes, los dos proyectos en seis criterios. Sin hablar con la mesa.', ronda: 'r1' },
  { titulo: 'Ronda 2, con la mesa', texto: 'Ahora sí: la mesa comparte lo que dice cada hoja, discute los dos proyectos y cada quien vuelve a calificar.', ronda: 'r2' },
  {
    titulo: 'La matriz muestra el movimiento',
    texto: 'El tablero ubica los dos proyectos entre ocho fijos, muestra cuánto se movieron de una ronda a otra y el consolidado de la sala.',
    ronda: 'r1r2',
  },
]

/** Secciones de la landing: el menú de escritorio y el del celular son la misma lista. */
const SECCIONES = [
  { href: '#entrar', texto: 'Entrar a tu mesa' },
  { href: '#como-funciona', texto: 'Cómo funciona' },
  { href: '#que-se-evalua', texto: 'Qué se evalúa' },
  { href: '#facilitadores', texto: 'Facilitadores' },
  { href: '#privacidad', texto: 'Tus datos' },
]

/** Título de la raíz mientras la página está montada. La description y Open Graph van en web/index.html. */
function useTitulo() {
  useEffect(() => {
    const anterior = document.title
    document.title = TITULO
    return () => {
      document.title = anterior
    }
  }, [])
}

/** La flecha doble del logo de Estratek, en azul: firma de los enlaces de avance. Decorativa. */
function Firma() {
  return (
    <span className="in-firma" aria-hidden="true">
      »
    </span>
  )
}

/**
 * Menú del celular: por debajo de 64 rem las secciones y «Ingresar al panel» no caben en el encabezado.
 * Botón de 48 px que abre la lista debajo del encabezado; se cierra al elegir, con Escape o con el mismo botón.
 */
function MenuMovil() {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      boton.current?.focus()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto])
  const cerrar = () => setAbierto(false)
  return (
    <>
      <button
        ref={boton}
        type="button"
        className="hz-boton hz-boton--secundario in-menu__boton"
        aria-expanded={abierto}
        aria-controls="in-menu"
        onClick={() => setAbierto((a) => !a)}
      >
        {abierto ? 'Cerrar menú' : 'Menú'}
      </button>
      <nav id="in-menu" className="in-menu" aria-label="Menú" hidden={!abierto}>
        <ul>
          {SECCIONES.map((s) => (
            <li key={s.href}>
              <a href={s.href} onClick={cerrar}>
                {s.texto}
              </a>
            </li>
          ))}
          <li>
            <Link to="/admin" onClick={cerrar}>
              Ingresar al panel
            </Link>
          </li>
        </ul>
      </nav>
    </>
  )
}

function LaminaPaso({ indice, ronda }: { indice: number; ronda?: 'r1' | 'r2' | 'r1r2' }) {
  const r = 34 + indice * 12
  const punto = r * Math.SQRT1_2
  return (
    <svg className="in-paso__lamina" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path className="in-paso__arco" d={`M0 100 L0 ${100 - r} A${r} ${r} 0 0 1 ${r} 100 Z`} />
      <path className="in-paso__horizonte" d={`M0 ${100 - r} A${r} ${r} 0 0 1 ${r} 100`} />
      {ronda === 'r1' && <circle className="in-r1-forma" cx={punto} cy={100 - punto} r="7" />}
      {ronda === 'r2' && <circle className="in-r2-forma" cx={punto} cy={100 - punto} r="7" />}
      {ronda === 'r1r2' && (
        <>
          <circle className="in-r1-forma" cx="72" cy="24" r="7" />
          <path className="in-paso__flecha" d="M66 31 L48 50" />
          <circle className="in-r2-forma" cx="40" cy="58" r="7" />
        </>
      )}
    </svg>
  )
}

function PruebaEscala() {
  const [valor, setValor] = useState<number | null>(null)
  return (
    <div className="in-prueba" data-ui>
      <Rubrica
        criterioId={`ejemplo-${RUBRICA_EJEMPLO.id}`}
        nombre={`Ejemplo: ${RUBRICA_EJEMPLO.nombre}`}
        pregunta={RUBRICA_EJEMPLO.pregunta}
        opciones={RUBRICA_EJEMPLO.opciones}
        valor={valor}
        onCambio={setValor}
      />
      <p className="in-prueba__nota" role="status">
        {valor === null
          ? 'Toca una opción para ver cómo se marca en el celular. Aquí no se guarda nada.'
          : `Marcaste ${valor}. En el taller, tu calificación de cada proyecto se envía cuando respondes los seis criterios.`}
      </p>
    </div>
  )
}

export default function PaginaInicio() {
  useTitulo()
  useTemaDocumento('claro')
  return (
    <div className="hz hz-inicio" data-tema="claro" lang="es-CO">
      <a className="in-saltar" href="#contenido">
        Saltar al contenido
      </a>
      <EncabezadoProducto href="#inicio" className="in-nav">
        <nav className="in-nav__secciones" aria-label="Secciones">
          <ul>
            {SECCIONES.map((s) => (
              <li key={s.href}>
                <a href={s.href}>{s.texto}</a>
              </li>
            ))}
          </ul>
        </nav>
        <Link className="hz-boton hz-boton--secundario in-nav__panel" to="/admin">
          Ingresar al panel
        </Link>
        <MenuMovil />
      </EncabezadoProducto>

      <main id="contenido">
        <section id="inicio" className="in-hero hz-pagina" aria-labelledby="in-titulo">
          <div className="in-hero__texto">
            <h1 id="in-titulo" className="in-display">
              La mesa mueve el <span className="in-clave">portafolio</span>
            </h1>
            <p className="in-lead">
              Horizontes es el taller de priorización de portafolio por horizontes de Estratek. Cada mesa califica dos proyectos con la
              información repartida entre sus perfiles, los discute y ve en la matriz cuánto se movieron de una ronda a otra.
            </p>
            <div className="in-acciones">
              <a className="hz-boton hz-boton--primario" href="#entrar">
                Escribir el código de mi mesa
              </a>
              <a className="in-avance" href="#como-funciona">
                Ver cómo funciona
                <Firma />
              </a>
            </div>
            <p className="in-hero__dato">Desde el celular, sin crear cuenta ni instalar nada.</p>
          </div>
          <MatrizIlustrada />
        </section>

        <section id="entrar" className="in-sec in-sec--entrar" aria-labelledby="in-entrar-titulo">
          <div className="hz-pagina in-dos">
            <div className="in-texto">
              <h2 id="in-entrar-titulo" className="in-h2">
                Entra a tu <span className="in-clave">mesa</span>
              </h2>
              <p>Lo más rápido es escanear el QR de tu mesa con la cámara del celular. Si no puedes, escribe aquí el código.</p>
              <p>
                Te inscribes con tu nombre y tu correo, y das tu autorización de tratamiento de datos. No creas cuenta ni contraseña: el
                celular recuerda tu sesión y, si la pierdes, el facilitador te da acceso de nuevo.
              </p>
            </div>
            <EntradaMesa />
          </div>
        </section>

        <section id="como-funciona" className="in-sec" aria-labelledby="in-como-titulo">
          <div className="hz-pagina">
            <h2 id="in-como-titulo" className="in-h2">
              Cómo <span className="in-clave">funciona</span>
            </h2>
            <p className="in-bajada">Dos rondas y la misma matriz. Lo que cambia entre una y otra es la conversación de la mesa.</p>
            <ol className="in-pasos">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="in-paso">
                  <LaminaPaso indice={i} ronda={p.ronda} />
                  <h3 className="in-h3">
                    {p.titulo}
                    {p.ronda === 'r1' && <span className="in-r1"> R1</span>}
                    {p.ronda === 'r2' && <span className="in-r2"> R2</span>}
                  </h3>
                  <p>{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="que-se-evalua" className="in-sec in-sec--suave" aria-labelledby="in-evalua-titulo">
          <div className="hz-pagina in-dos in-dos--evalua">
            <div className="in-texto">
              <h2 id="in-evalua-titulo" className="in-h2">
                Qué se <span className="in-clave">evalúa</span>
              </h2>
              <p>
                Cada persona califica INSUMEX y NUTRIWHAT, los dos proyectos vivos del caso Foodsume, en seis criterios. Los promedios ubican
                cada proyecto en dos ejes.
              </p>
              {EJES.map((eje) => (
                <div key={eje.id} className="in-eje">
                  <h3 className="in-h3">{eje.nombre}</h3>
                  <p>{eje.lectura}</p>
                  <ul className="in-lista">
                    {eje.criterios.map((c) => (
                      <li key={c.id}>
                        <strong>{c.nombre}.</strong> {c.pregunta}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="in-texto">
              <h3 className="in-h3">La escala: 1, 3, 5, 7 y 9</h3>
              <p>Cada número tiene su descripción en la rúbrica. En todos los criterios, 1 es lo más cercano y listo; 9, lo más lejano e incierto.</p>
              <p>
                Solo hay números impares: no existe un 4 o un 6 para quedarse a medias. Cada salto es una descripción distinta y hay que elegir
                la que más se parece al proyecto.
              </p>
              <PruebaEscala />
            </div>
          </div>
        </section>

        <section id="facilitadores" className="in-sec" aria-labelledby="in-facilitadores-titulo">
          <div className="hz-pagina in-dos">
            <div className="in-texto">
              <h2 id="in-facilitadores-titulo" className="in-h2">
                Para <span className="in-clave">facilitadores</span>
              </h2>
              <p className="in-bajada">El panel es para quien dirige el taller. Las cuentas las crea Estratek: no hay registro abierto.</p>
              <Link className="hz-boton hz-boton--secundario in-boton-claro" to="/admin">
                Ingresar al panel
              </Link>
            </div>
            <div className="in-texto">
              <p>
                Desde el panel creas la sala con el caso Foodsume, imprimes los QR de las mesas, abres y cierras las rondas y exportas los
                resultados. Si alguien cambia de celular o pierde su sesión, desde ahí le das acceso de nuevo.
              </p>
              <p>
                El tablero se proyecta desde el panel en dos modos: «Gráfica», con la matriz a pantalla completa, y «Detallado», con la matriz
                y los promedios por criterio. Tiene su propio enlace; no se busca desde esta página.
              </p>
              <p>Si es tu primera vez, la «Guía de uso» del panel te muestra cada paso.</p>
              <p>Si vas a facilitar y no tienes usuario, pídeselo a quien coordina el taller en Estratek.</p>
            </div>
          </div>
        </section>

        <section id="privacidad" className="in-sec in-sec--suave" aria-labelledby="in-privacidad-titulo">
          <div className="hz-pagina in-dos">
            <div className="in-texto">
              <h2 id="in-privacidad-titulo" className="in-h2">
                Tus <span className="in-clave">datos</span>
              </h2>
              <p className="in-bajada">Qué guardamos de ti, quién lo ve y cómo pedir que lo cambiemos o lo borremos.</p>
            </div>
            <div className="in-texto">
              <ul className="in-lista in-lista--datos">
                <li>
                  <strong>Resultados anónimos.</strong> La matriz y las tablas muestran promedios de la mesa o de la sala. Nadie ve tu nombre ni
                  tus calificaciones.
                </li>
                <li>
                  <strong>Mínimo de 3 votos.</strong> Si una mesa o la sala tiene menos de 3 votos, su resultado no se muestra.
                </li>
                <li>
                  <strong>Solo tu nombre y tu correo,</strong> con fines informativos del taller y con tu autorización. Los tratamos según la
                  ley del país donde se hace el taller: en Colombia, la Ley 1581 de 2012; en Perú, la Ley 29733; en Guatemala, la política de
                  Estratek.
                </li>
              </ul>
              <p>Para conocer, actualizar o suprimir tus datos, escribe a Estratek:</p>
              <ul className="in-enlaces">
                <li>
                  <a className="in-enlace" href={`mailto:${CORREO_ESTRATEK}`}>
                    {CORREO_ESTRATEK}
                  </a>
                </li>
                <li>
                  <a className="in-enlace" href={URL_POLITICA} target="_blank" rel="noreferrer">
                    Política de Tratamiento de Datos Personales de Estratek<span className="hz-visual-oculto"> (se abre en otra pestaña)</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="in-pie">
        <div className="hz-pagina in-pie__interior">
          <p className="in-pie__nombre">
            Horizontes
            <span className="in-firma" aria-hidden="true">
              »
            </span>
          </p>
          <div className="in-pie__datos">
            <LogoEstratek className="in-pie__logo" />
            <p>Un taller de Estratek S.A.S., Medellín, Colombia.</p>
            <p>
              <a href={`mailto:${CORREO_ESTRATEK}`}>{CORREO_ESTRATEK}</a>
            </p>
            <nav aria-label="Pie de página">
              <ul>
                <li><a href="#inicio">Inicio</a></li>
                <li><Link to="/admin">Ingresar al panel</Link></li>
                <li>
                  <a href={URL_POLITICA} target="_blank" rel="noreferrer">
                    Política de datos<span className="hz-visual-oculto"> (se abre en otra pestaña)</span>
                  </a>
                </li>
                <li>
                  <a href="https://estratek.com.co" target="_blank" rel="noreferrer">
                    estratek.com.co
                    <Firma />
                    <span className="hz-visual-oculto"> (se abre en otra pestaña)</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
