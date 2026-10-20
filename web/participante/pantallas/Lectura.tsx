import { useEffect, useState } from 'react'
import { Aviso, Hoja, Insignia, Pestanas } from '../../shared/ui'
import type { HojaInfo, Yo } from '../api'
import { Md } from '../Comun'
import { hojasAvisadas, marcarHojasAvisadas } from '../sesion'

// Catálogo de perfiles de data/seed_foodsume.json, por si una hoja llega sin nombre de perfil.
const PERFILES: Record<string, string> = {
  cliente: 'Conocimiento del cliente',
  regulacion: 'Regulación',
  financiero: 'Financiero',
  tecnica_operaciones: 'Técnica y Operaciones',
  estrategica: 'Estratégica',
  produccion: 'Producción',
}
const ORDEN_PERFILES = Object.keys(PERFILES)

export const nombrePerfil = (h: HojaInfo) => h.perfil ?? PERFILES[h.perfil_id] ?? h.perfil_id

/** Hojas visibles de un proyecto: la propia primero y luego los demás perfiles en el orden del deck. */
export function hojasDeProyecto(yo: Yo, proyectoId: string): HojaInfo[] {
  const mio = yo.participante.perfil.id
  const orden = (h: HojaInfo) => (h.perfil_id === mio ? -1 : ORDEN_PERFILES.indexOf(h.perfil_id))
  return yo.contenido.hojas
    .filter((h) => h.proyecto_id === proyectoId && (yo.config.revelar_hojas || h.perfil_id === mio))
    .sort((a, b) => orden(a) - orden(b))
}

/** 8.5 Lectura: pestañas "Caso" y "Tu hoja" (o "Hojas" cuando se revelan las 6). */
export function Lectura({ yo, codigo, pestanaInicial = 'caso' }: { yo: Yo; codigo: string; pestanaInicial?: 'caso' | 'hoja' }) {
  const [activa, setActiva] = useState<string>(pestanaInicial)
  const revelar = yo.config.revelar_hojas
  const [avisoHojas] = useState(() => revelar && !hojasAvisadas(codigo))
  useEffect(() => {
    if (revelar && activa === 'hoja') marcarHojasAvisadas(codigo)
  }, [revelar, activa, codigo])

  return (
    <Pestanas
      etiqueta="Material del taller"
      activa={activa}
      onCambio={setActiva}
      pestanas={[
        { id: 'caso', titulo: 'Caso', contenido: <Caso yo={yo} /> },
        {
          id: 'hoja',
          titulo: revelar ? 'Hojas' : 'Tu hoja',
          contenido: revelar ? <TodasLasHojas yo={yo} aviso={avisoHojas} /> : <TuHoja yo={yo} />,
        },
      ]}
    />
  )
}

function Caso({ yo }: { yo: Yo }) {
  const { caso, portafolio } = yo.contenido
  return (
    <article className="hzp-lectura">
      <h2 className="hz-subtitulo">{caso.titulo}</h2>
      <Md texto={caso.descripcion_md} />
      <h2 className="hz-subtitulo">La situación</h2>
      <Md texto={caso.situacion_md} />
      <h2 className="hz-subtitulo">Los {portafolio.length} proyectos del portafolio</h2>
      <ul className="hzp-proyectos">
        {portafolio.map((p) => (
          <li key={p.id} className={['hzp-proyecto', p.modo === 'vivo' && 'hzp-proyecto--vivo'].filter(Boolean).join(' ')}>
            <p className="hzp-proyecto__nombre">
              <span>{p.nombre}</span>
              {p.modo === 'vivo' && <Insignia>Se califica</Insignia>}
            </p>
            {(p.tipo || p.sector) && <p className="hz-texto-3">{[p.tipo, p.sector].filter(Boolean).join(' · ')}</p>}
            {p.descripcion && <p className="hzp-proyecto__desc">{p.descripcion}</p>}
          </li>
        ))}
      </ul>
    </article>
  )
}

function TuHoja({ yo }: { yo: Yo }) {
  const perfil = yo.participante.perfil
  const propias = yo.contenido.hojas.filter((h) => h.perfil_id === perfil.id)
  return (
    <div className="hzp-lectura">
      <h2 className="hz-subtitulo">Tu hoja como {perfil.nombre}</h2>
      {propias.length === 0 && <Aviso tono="info">Tu hoja aún no está disponible. Pídele al facilitador que revise tu perfil.</Aviso>}
      {/* Todas son del perfil propio: ninguna se destaca sobre la otra. */}
      {propias.map((h) => (
        <Hoja key={h.proyecto_id} titulo={h.proyecto}>
          <Md texto={h.texto} />
        </Hoja>
      ))}
    </div>
  )
}

function TodasLasHojas({ yo, aviso }: { yo: Yo; aviso: boolean }) {
  const mio = yo.participante.perfil.id
  const proyectos = [...new Set(yo.contenido.hojas.map((h) => h.proyecto_id))]
  return (
    <div className="hzp-lectura">
      {aviso && <Aviso tono="info">Ya puedes ver la información de los 6 perfiles.</Aviso>}
      {proyectos.map((pid) => {
        const hojas = hojasDeProyecto(yo, pid)
        return (
          <section key={pid} className="hzp-grupo-hojas" aria-labelledby={`hzp-hojas-${pid}`}>
            <h2 id={`hzp-hojas-${pid}`} className="hz-subtitulo">
              {hojas[0]?.proyecto}
            </h2>
            {hojas.map((h) => (
              <Hoja key={h.perfil_id} titulo={nombrePerfil(h)} activa={h.perfil_id === mio} extra={h.perfil_id === mio ? <Insignia tono="ok">Tu hoja</Insignia> : undefined}>
                <Md texto={h.texto} />
              </Hoja>
            ))}
          </section>
        )
      })}
    </div>
  )
}
