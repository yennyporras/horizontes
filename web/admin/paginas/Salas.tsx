import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, lista } from '../api'
import type { Metricas, SalaResumen, Sector, TipoSala } from '../tipos'
import { ESTADOS, LARGO_MAXIMO_EMPRESA, SECTORES, TIPOS_SALA, enumerar, fechaHora, nombreEnsayo, nombrePais } from '../textos'
import { useTituloPagina } from './EncabezadoSala'
import { useSesion } from '../sesion'

const personas = (n: number) => (n === 1 ? '1 persona' : `${n} personas`)

export function Salas() {
  const [salas, setSalas] = useState<SalaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [mesas, setMesas] = useState(4)
  const [tipo, setTipo] = useState<TipoSala>('taller')
  const [empresa, setEmpresa] = useState('')
  const [sector, setSector] = useState<Sector | ''>('')
  const [errorCrear, setErrorCrear] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [duplicando, setDuplicando] = useState<string | null>(null)
  const [errorDuplicar, setErrorDuplicar] = useState<string | null>(null)
  const navegar = useNavigate()
  const { admin } = useSesion()
  useTituloPagina('Salas')
  const claveCambiada = Boolean((useLocation().state as { claveCambiada?: boolean } | null)?.claveCambiada)

  const cargar = () =>
    api
      .get<unknown>('/api/admin/salas')
      .then((r) => {
        setSalas(lista<SalaResumen>(r, 'salas'))
        setError(null)
      })
      .catch((e: Error) => setError(e.message))

  useEffect(() => {
    cargar()
  }, [])

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    setErrorCrear(null)
    setCreando(true)
    try {
      const r = await api.post<{ id?: string; sala?: { id: string } }>('/api/admin/salas', {
        nombre: nombre.trim(),
        plantilla: 'foodsume_2026',
        mesas,
        tipo,
        empresa: empresa.trim() || null,
        sector: sector || null,
      })
      setNombre('')
      setEmpresa('')
      setSector('')
      const id = r?.id ?? r?.sala?.id
      if (id) navegar(`/admin/salas/${id}/vivo`)
      else await cargar()
    } catch (err) {
      setErrorCrear(err instanceof Error ? err.message : 'No se pudo crear la sala.')
    } finally {
      setCreando(false)
    }
  }

  // Copia vacía (mismas mesas y visibilidad, sin inscritos ni votos) para ensayar sin tocar la sala real.
  const duplicar = async (s: SalaResumen) => {
    setErrorDuplicar(null)
    setDuplicando(s.id)
    try {
      const r = await api.post<{ id?: string; sala?: { id: string } }>(`/api/admin/salas/${s.id}/duplicar`, { nombre: nombreEnsayo(s.nombre) })
      const id = r?.id ?? r?.sala?.id
      if (id) navegar(`/admin/salas/${id}/vivo`)
      else await cargar()
    } catch (err) {
      setErrorDuplicar(err instanceof Error ? `No pudimos duplicar «${s.nombre}». ${err.message}` : 'No pudimos duplicar la sala.')
    } finally {
      setDuplicando(null)
    }
  }

  return (
    <>
      <h1 tabIndex={-1}>Salas</h1>
      {claveCambiada && (
        <p className="alerta alerta--exito" role="status">
          Tu clave quedó cambiada.
        </p>
      )}
      <CifrasTalleres />
      <section className="panel" aria-labelledby="t-nueva">
        <h2 id="t-nueva">Nueva sala</h2>
        <form onSubmit={crear}>
          <div className="fila-form">
            <label className="campo">
              <span>Nombre del taller</span>
              <input required maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Taller Horizontes, Empresa ABC" />
            </label>
            <label className="campo">
              <span>Plantilla</span>
              <select name="plantilla" defaultValue="foodsume_2026">
                <option value="foodsume_2026">Caso Foodsume 2026</option>
              </select>
            </label>
            <label className="campo campo--corto">
              <span>Mesas</span>
              <input type="number" min={1} max={20} required value={mesas} aria-describedby="ayuda-mesas" onChange={(e) => setMesas(Number(e.target.value))} />
            </label>
          </div>
          <div className="fila-form">
            <label className="campo">
              <span>Tipo</span>
              <select value={tipo} aria-describedby="ayuda-tipo" onChange={(e) => setTipo(e.target.value as TipoSala)}>
                {(Object.keys(TIPOS_SALA) as TipoSala[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_SALA[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Empresa cliente (opcional)</span>
              <input maxLength={LARGO_MAXIMO_EMPRESA} value={empresa} onChange={(e) => setEmpresa(e.target.value)} autoComplete="organization" />
            </label>
            <label className="campo">
              <span>Sector (opcional)</span>
              <select value={sector} onChange={(e) => setSector(e.target.value as Sector | '')}>
                <option value="">Sin definir</option>
                {(Object.keys(SECTORES) as Sector[]).map((s) => (
                  <option key={s} value={s}>
                    {SECTORES[s]}
                  </option>
                ))}
              </select>
            </label>
            <button className="hz-boton hz-boton--primario" type="submit" disabled={creando} aria-busy={creando}>
              {creando ? 'Creando…' : 'Crear sala'}
            </button>
          </div>
        </form>
        <p id="ayuda-mesas" className="pista">
          Recomendado: una mesa por cada 6 personas (hay 6 perfiles por mesa).
        </p>
        <p id="ayuda-tipo" className="pista">
          Elige «Ensayo» para probar o practicar: los ensayos no cuentan en las cifras de arriba. Tipo, empresa y sector se cambian después en Configuración.
        </p>
        {errorCrear && (
          <p className="alerta alerta--error" role="alert">
            {errorCrear}
          </p>
        )}
      </section>
      {admin?.rol === 'superadmin' && <Demostracion />}

      {error && (
        <p className="alerta alerta--error" role="alert">
          No pudimos cargar las salas. {error}
        </p>
      )}
      {!salas && !error && <p role="status">Cargando salas…</p>}
      {salas?.length === 0 && <p className="vacio">Aún no hay salas. Crea la primera con el formulario de arriba.</p>}
      {errorDuplicar && (
        <p className="alerta alerta--error" role="alert">
          {errorDuplicar}
        </p>
      )}
      {salas && salas.length > 0 && (
        <ul className="lista-salas">
          {salas.map((s) => (
            <li key={s.id} className="panel tarjeta-sala">
              <div>
                <h2>
                  {s.nombre}
                  {s.tipo === 'ensayo' && <span className="etiqueta etiqueta--ensayo">Ensayo</span>}
                </h2>
                <p className="pista">
                  Código {s.codigo}
                  {s.mesas !== undefined && ` · ${s.mesas} ${s.mesas === 1 ? 'mesa' : 'mesas'}`}
                  {s.inscritos !== undefined && ` · ${personas(s.inscritos)}`} · creada {fechaHora(s.creada_at)}
                </p>
                {(s.empresa || s.sector) && <p className="pista">{[s.empresa, s.sector && SECTORES[s.sector]].filter(Boolean).join(' · ')}</p>}
              </div>
              <span className={`estado estado--${s.estado}`}>{ESTADOS[s.estado]}</span>
              <span className="acciones-sala">
                <Link className="hz-boton hz-boton--secundario" to={`/admin/salas/${s.id}/vivo`}>
                  Abrir
                </Link>
                <button
                  className="hz-boton hz-boton--secundario"
                  type="button"
                  onClick={() => void duplicar(s)}
                  disabled={duplicando !== null}
                  aria-busy={duplicando === s.id}
                  aria-label={`Duplicar ${s.nombre} para ensayo`}
                >
                  {duplicando === s.id ? 'Duplicando…' : 'Duplicar para ensayo'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * Modo demo (QA por roles del 20-oct, jurado): solo el superadmin. El servidor crea la sala «Demostración» (un ensayo,
 * con 4 mesas) e inscribe 24 personas simuladas que votan las dos rondas en un minuto; el panel abre Sala en vivo.
 */
function Demostracion() {
  const navegar = useNavigate()
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const crear = async () => {
    setError(null)
    setCreando(true)
    try {
      const r = await api.post<{ sala?: { id: string }; id?: string }>('/api/admin/demo')
      const id = r?.sala?.id ?? r?.id
      if (id) navegar(`/admin/salas/${id}/vivo`)
    } catch (e) {
      setError(e instanceof Error ? `No pudimos crear la demostración. ${e.message}` : 'No pudimos crear la demostración.')
    } finally {
      setCreando(false)
    }
  }
  return (
    <section className="panel demo" aria-labelledby="t-demo">
      <h2 id="t-demo">Demostración</h2>
      <p id="ayuda-demo" className="pista">
        Crea la sala «Demostración» con 24 personas simuladas y corre las dos rondas en un minuto. Es un ensayo: no cuenta en las cifras.
      </p>
      <button type="button" className="hz-boton hz-boton--secundario" disabled={creando} aria-busy={creando} aria-describedby="ayuda-demo" onClick={() => void crear()}>
        {creando ? 'Creando…' : 'Crear demostración'}
      </button>
      {error && (
        <p className="alerta alerta--error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

/**
 * QA por roles del 20-oct (inversionista): las cifras del negocio, solo de los talleres con cliente (los ensayos y las
 * demostraciones no cuentan). Las calcula el servidor (`GET /api/admin/metricas`).
 */
function CifrasTalleres() {
  const [m, setM] = useState<Metricas | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let vigente = true
    api
      .get<Metricas>('/api/admin/metricas')
      .then((r) => vigente && setM(r))
      .catch((e: Error) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [])

  if (error)
    return (
      <p className="alerta alerta--aviso" role="status">
        No pudimos cargar las cifras de los talleres. {error}
      </p>
    )
  if (!m) return null
  const paises = m.paises.map(nombrePais)
  const cifras = [
    { rotulo: 'Talleres', valor: m.talleres },
    { rotulo: 'Personas', valor: m.personas },
    { rotulo: 'Completaron la ronda 2', valor: m.completaron_r2 },
    { rotulo: 'Países', valor: paises.length, detalle: paises.length ? enumerar(paises) : undefined },
  ]
  return (
    <section className="cifras-talleres" aria-label="Cifras de los talleres">
      <ul className="kpis" aria-describedby="nota-cifras">
        {cifras.map((c) => (
          <li key={c.rotulo} className="kpi">
            <span className="kpi__rotulo">{c.rotulo}</span>
            <span className="cifra">{c.valor}</span>
            {c.detalle && <span className="kpi__detalle">{c.detalle}</span>}
          </li>
        ))}
      </ul>
      <p id="nota-cifras" className="pista">
        Solo talleres con cliente: los ensayos y las demostraciones no cuentan.
      </p>
    </section>
  )
}
