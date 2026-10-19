import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import { Rubricas } from './Rubricas'
import type { ConfigSala, Pais, SalaDetalle, ZonaHoraria } from '../tipos'
import { PAISES, ZONAS, fechaHora, horaLocalAIso, isoAHoraLocal, zonaSala } from '../textos'

type Aviso = { tono: 'exito' | 'error'; texto: string } | null

export function Configuracion() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  const [aviso, setAviso] = useState<Aviso>(null)

  const guardar = async (cambio: Partial<ConfigSala>, texto: string) => {
    setAviso(null)
    try {
      await api.patch(`/api/admin/salas/${salaId}/config`, cambio)
      await refrescar()
      setAviso({ tono: 'exito', texto })
    } catch (e) {
      setAviso({ tono: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar el cambio.' })
    }
  }

  return (
    <ConSala titulo="Configuración" datos={datos} error={error}>
      {(d) => (
        <>
          <p className="pista">Los cambios se aplican de inmediato y los celulares los ven en menos de 5 segundos.</p>
          {aviso && (
            <p className={`alerta alerta--${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
              {aviso.texto}
            </p>
          )}
          <div className="rejilla">
            <Visibilidad d={d} guardar={guardar} />
            <div>
              <PaisSala d={d} guardar={guardar} />
              <Cierres d={d} guardar={guardar} />
            </div>
          </div>
          <Rubricas salaId={d.sala.id} version={d.version} />
        </>
      )}
    </ConSala>
  )
}

interface PropsSeccion {
  d: SalaDetalle
  guardar: (cambio: Partial<ConfigSala>, texto: string) => Promise<void>
}

function Visibilidad({ d, guardar }: PropsSeccion) {
  const c = d.sala.config
  return (
    <section className="panel" aria-labelledby="t-visibilidad">
      <h2 id="t-visibilidad">Qué ven los participantes</h2>
      <fieldset>
        <legend>Alcance de los resultados</legend>
        <label className="opcion">
          <input
            type="radio"
            name="alcance"
            checked={c.alcance_resultados === 'sala'}
            onChange={() => guardar({ alcance_resultados: 'sala' }, 'Ahora todos ven el resultado de toda la sala.')}
          />
          <span>
            Todos ven la sala completa <span className="etiqueta">Por defecto</span>
            <small>Promedio de todas las mesas en una sola matriz.</small>
          </span>
        </label>
        <label className="opcion">
          <input
            type="radio"
            name="alcance"
            checked={c.alcance_resultados === 'mesa'}
            onChange={() => guardar({ alcance_resultados: 'mesa' }, 'Ahora cada mesa ve solo su resultado.')}
          />
          <span>
            Cada mesa ve su resultado
            <small>Cada mesa funciona como una empresa y discute su propia matriz.</small>
          </span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Después de votar</legend>
        <label className="opcion">
          <input
            type="radio"
            name="vista"
            checked={c.vista_participante === 'en_vivo'}
            onChange={() => guardar({ vista_participante: 'en_vivo' }, 'Tras votar, el participante ve el tablero en vivo.')}
          />
          <span>
            Tablero en vivo <span className="etiqueta">Por defecto</span>
            <small>Apenas vota, cada persona ve el resultado consolidado moverse mientras los demás votan.</small>
          </span>
        </label>
        <label className="opcion">
          <input
            type="radio"
            name="vista"
            checked={c.vista_participante === 'registrado'}
            onChange={() => guardar({ vista_participante: 'registrado' }, 'Tras votar, el participante ve "Voto registrado".')}
          />
          <span>
            Voto registrado
            <small>Ven el progreso de su mesa hasta que cierres la ronda o llegue el precierre.</small>
          </span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Hojas de información</legend>
        <label className="opcion">
          <input
            type="checkbox"
            checked={c.revelar_hojas}
            onChange={(e) =>
              guardar(
                { revelar_hojas: e.target.checked },
                e.target.checked ? 'Todos ven ahora las 6 hojas.' : 'Cada participante ve ahora solo la hoja de su perfil.',
              )
            }
          />
          <span>
            Mostrar las 6 hojas a todos
            <small>Se enciende sola al abrir la ronda 2. Puedes apagarla o encenderla cuando quieras.</small>
          </span>
        </label>
      </fieldset>
    </section>
  )
}

/** País de la sala: define la ley que cita el aviso de datos y la hora de los cierres (R4_CONTRATO C4 y C6). */
function PaisSala({ d, guardar }: PropsSeccion) {
  const c = d.sala.config
  const pais = c.pais ?? 'CO'
  const zona = zonaSala(c)
  return (
    <section className="panel" aria-labelledby="t-pais">
      <h2 id="t-pais">País y hora</h2>
      <div className="fila-form">
        <label className="campo">
          <span>País de la sala</span>
          <select
            value={pais}
            onChange={(e) => {
              const p = e.target.value as Pais
              void guardar({ pais: p, zona_horaria: PAISES[p].zona }, `La sala quedó en ${PAISES[p].nombre}, con hora de ${ZONAS[PAISES[p].zona].nombre}.`)
            }}
          >
            {(Object.keys(PAISES) as Pais[]).map((p) => (
              <option key={p} value={p}>
                {PAISES[p].nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Zona horaria</span>
          <select
            value={zona}
            onChange={(e) => {
              const z = e.target.value as ZonaHoraria
              void guardar({ zona_horaria: z }, `Los cierres programados quedan en hora de ${ZONAS[z].nombre}.`)
            }}
          >
            {(Object.keys(ZONAS) as ZonaHoraria[]).map((z) => (
              <option key={z} value={z}>
                {ZONAS[z].nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="pista">El aviso de datos que firma cada participante cita la ley del país de la sala. La zona horaria se ajusta sola al cambiar el país.</p>
    </section>
  )
}

function Cierres({ d, guardar }: PropsSeccion) {
  const c = d.sala.config
  const zona = zonaSala(c)
  return (
    <section className="panel" aria-labelledby="t-cierres">
      <h2 id="t-cierres">Cierres programados</h2>
      <p className="pista">Hora de {ZONAS[zona].nombre}. El servidor cierra a esa hora aunque nadie tenga el panel abierto.</p>
      <CampoCierre
        id="cierre-ronda"
        zona={zona}
        etiqueta="Cerrar la ronda abierta el"
        valor={c.cierre_programado_ronda_at}
        inactivo={
          d.sala.estado === 'r2_cerrada' || d.sala.estado === 'cerrada'
            ? 'Ya no quedan rondas por cerrar.'
            : 'Cierra la ronda que esté abierta a esa hora. Si a esa hora no hay ronda abierta, se descarta.'
        }
        bloquear={d.sala.estado === 'r2_cerrada' || d.sala.estado === 'cerrada'}
        alGuardar={(iso) =>
          guardar({ cierre_programado_ronda_at: iso }, iso ? `La ronda se cerrará el ${fechaHora(iso, zona)}.` : 'Quitamos el cierre programado de la ronda.')
        }
      />
      <CampoCierre
        id="cierre-sala"
        zona={zona}
        etiqueta="Cerrar la sala el"
        valor={c.cierre_programado_sala_at}
        bloquear={d.sala.estado === 'cerrada'}
        inactivo={d.sala.estado === 'cerrada' ? 'La sala ya está cerrada.' : undefined}
        alGuardar={(iso) =>
          guardar({ cierre_programado_sala_at: iso }, iso ? `La sala se cerrará el ${fechaHora(iso, zona)}.` : 'Quitamos el cierre programado de la sala.')
        }
      />
    </section>
  )
}

function CampoCierre({
  id,
  zona,
  etiqueta,
  valor,
  alGuardar,
  inactivo,
  bloquear = false,
}: {
  id: string
  zona: ZonaHoraria
  etiqueta: string
  valor: string | null
  /** Pista bajo el campo (por qué está bloqueado o cómo se aplica). */
  inactivo?: string
  bloquear?: boolean
  alGuardar: (iso: string | null) => Promise<void>
}) {
  const [local, setLocal] = useState(isoAHoraLocal(valor, zona))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setLocal(isoAHoraLocal(valor, zona)), [valor, zona])

  const programar = () => {
    const iso = horaLocalAIso(local, zona)
    if (!iso) return setError('Elige fecha y hora completas.')
    if (new Date(iso).getTime() <= Date.now()) return setError('Elige una hora que aún no haya pasado.')
    setError(null)
    void alGuardar(iso)
  }

  return (
    <div className="fila-form">
      <label className="campo" htmlFor={id}>
        <span>{etiqueta}</span>
        <input
          id={id}
          type="datetime-local"
          value={local}
          disabled={bloquear}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : inactivo ? `${id}-pista` : undefined}
          onChange={(e) => setLocal(e.target.value)}
        />
      </label>
      <button className="btn btn--primario" type="button" onClick={programar} disabled={bloquear}>
        Programar
      </button>
      <button className="btn" type="button" disabled={!valor} onClick={() => void alGuardar(null)}>
        Quitar
      </button>
      {inactivo && (
        <p id={`${id}-pista`} className="pista" style={{ flexBasis: '100%', margin: 0 }}>
          {inactivo}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="alerta alerta--error" role="alert" style={{ flexBasis: '100%' }}>
          {error}
        </p>
      )}
    </div>
  )
}
