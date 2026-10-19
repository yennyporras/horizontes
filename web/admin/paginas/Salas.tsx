import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, lista } from '../api'
import type { SalaResumen } from '../tipos'
import { ESTADOS, fechaHora } from '../textos'

export function Salas() {
  const [salas, setSalas] = useState<SalaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [mesas, setMesas] = useState(4)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [duplicando, setDuplicando] = useState<string | null>(null)
  const [errorDuplicar, setErrorDuplicar] = useState<string | null>(null)
  const navegar = useNavigate()

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
      const r = await api.post<{ id?: string; sala?: { id: string } }>('/api/admin/salas', { nombre: nombre.trim(), plantilla: 'foodsume_2026', mesas })
      setNombre('')
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
      const r = await api.post<{ id?: string; sala?: { id: string } }>(`/api/admin/salas/${s.id}/duplicar`, { nombre: `${s.nombre} (ensayo)` })
      const id = r?.id ?? r?.sala?.id
      if (id) navegar(`/admin/salas/${id}/vivo`)
      else await cargar()
    } catch (err) {
      setErrorDuplicar(err instanceof Error ? `No pudimos duplicar "${s.nombre}". ${err.message}` : 'No pudimos duplicar la sala.')
    } finally {
      setDuplicando(null)
    }
  }

  return (
    <>
      <h1>Salas</h1>
      <section className="panel" aria-labelledby="t-nueva">
        <h2 id="t-nueva">Nueva sala</h2>
        <form className="fila-form" onSubmit={crear}>
          <label className="campo">
            <span>Nombre del taller</span>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Taller Horizontes Nutresa" />
          </label>
          <label className="campo">
            <span>Plantilla</span>
            <select name="plantilla" defaultValue="foodsume_2026">
              <option value="foodsume_2026">Caso Foodsume 2026</option>
            </select>
          </label>
          <label className="campo campo--corto">
            <span>Mesas</span>
            <input
              type="number"
              min={1}
              max={20}
              required
              value={mesas}
              aria-describedby="ayuda-mesas"
              onChange={(e) => setMesas(Number(e.target.value))}
            />
          </label>
          <button className="hz-boton hz-boton--primario" type="submit" disabled={creando} aria-busy={creando}>
            {creando ? 'Creando…' : 'Crear sala'}
          </button>
        </form>
        <p id="ayuda-mesas" className="pista">
          Recomendado: una mesa por cada 6 personas (hay 6 perfiles por mesa).
        </p>
        {errorCrear && (
          <p className="alerta alerta--error" role="alert">
            {errorCrear}
          </p>
        )}
      </section>

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
                <h2>{s.nombre}</h2>
                <p className="pista">
                  Código {s.codigo}
                  {s.mesas !== undefined && ` · ${s.mesas} ${s.mesas === 1 ? 'mesa' : 'mesas'}`} · creada {fechaHora(s.creada_at)}
                </p>
              </div>
              <span className={`estado estado--${s.estado}`}>{ESTADOS[s.estado]}</span>
              <span className="acciones-sala">
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
                <Link className="hz-boton hz-boton--secundario" to={`/admin/salas/${s.id}/vivo`}>
                  Abrir
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
