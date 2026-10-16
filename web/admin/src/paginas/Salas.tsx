import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { SalaResumen } from '../tipos'
import { ESTADOS, fechaHora } from '../textos'

export function Salas() {
  const [salas, setSalas] = useState<SalaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [mesas, setMesas] = useState(4)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)

  const cargar = () =>
    api
      .get<SalaResumen[]>('/api/admin/salas')
      .then((s) => {
        setSalas(s)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))

  useEffect(() => {
    cargar()
  }, [])

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    setErrorCrear(null)
    try {
      await api.post('/api/admin/salas', { nombre: nombre.trim(), plantilla: 'foodsume_2026', mesas })
      setNombre('')
      await cargar()
    } catch (err) {
      setErrorCrear(err instanceof Error ? err.message : 'No se pudo crear la sala.')
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
          <label className="campo campo--corto">
            <span>Mesas</span>
            <input type="number" min={1} max={20} required value={mesas} onChange={(e) => setMesas(Number(e.target.value))} />
          </label>
          <button className="btn btn--primario" type="submit">
            Crear con plantilla Foodsume
          </button>
        </form>
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
      {salas && salas.length > 0 && (
        <ul className="lista-salas">
          {salas.map((s) => (
            <li key={s.id} className="panel tarjeta-sala">
              <div>
                <h2>{s.nombre}</h2>
                <p className="pista">
                  Código {s.codigo} · creada {fechaHora(s.creada_at)}
                </p>
              </div>
              <span className={`estado estado--${s.estado}`}>{ESTADOS[s.estado]}</span>
              <Link className="btn btn--primario" to={`/salas/${s.id}/vivo`}>
                Abrir
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
