import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from '../api'
import type { RubricasSala } from '../tipos'

/** Criterio que se abre por defecto: el de los rangos de inversión, el que más puede cambiar. */
const CRITERIO_INICIAL = 'inversion_requerida'
const MAX_TEXTO = 300

type Aviso = { tono: 'exito' | 'error'; texto: string } | null

/**
 * Textos de la rúbrica de cada criterio. Solo se editan mientras la sala no tenga votos (lo decide el servidor);
 * los valores 1, 3, 5, 7 y 9, los pesos y el cálculo no cambian. `version` es la de la sala: si cambia, se relee.
 */
export function Rubricas({ salaId, version }: { salaId: string; version: string }) {
  const [datos, setDatos] = useState<RubricasSala | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [criterioId, setCriterioId] = useState(CRITERIO_INICIAL)
  /** Textos que el admin está editando, por valor. null = sin cambios (se muestran los del servidor). */
  const [borrador, setBorrador] = useState<Record<number, string> | null>(null)
  const [paraNuevas, setParaNuevas] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const cargar = useCallback(async () => {
    try {
      setDatos(await api.get<RubricasSala>(`/api/admin/salas/${salaId}/rubricas`))
      setErrorCarga(null)
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'No se pudieron cargar las rúbricas.')
    }
  }, [salaId])
  useEffect(() => {
    void cargar()
  }, [cargar, version])

  const criterio = datos?.criterios.find((c) => c.id === criterioId) ?? datos?.criterios[0]
  const texto = (valor: number, original: string) => borrador?.[valor] ?? original
  const cambiado = Boolean(borrador && criterio?.rubrica.some((r) => texto(r.valor, r.texto) !== r.texto))
  const editable = Boolean(datos?.editable)

  const descartar = () => {
    setBorrador(null)
    setParaNuevas(false)
    setAviso(null)
  }

  const guardar = async () => {
    if (!criterio) return
    setGuardando(true)
    setAviso(null)
    try {
      const r = await api.put<RubricasSala>(`/api/admin/salas/${salaId}/rubricas/${criterio.id}`, {
        rubrica: criterio.rubrica.map((n) => ({ valor: n.valor, texto: texto(n.valor, n.texto) })),
        usar_en_salas_nuevas: paraNuevas,
      })
      setDatos(r)
      setBorrador(null)
      setParaNuevas(false)
      setAviso({
        tono: 'exito',
        texto: `Guardamos la rúbrica de ${criterio.nombre}. Los celulares la ven en menos de 5 segundos${paraNuevas ? ' y las salas nuevas también la usarán' : ''}.`,
      })
    } catch (e) {
      setAviso({ tono: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar la rúbrica.' })
      // Si la sala recibió votos mientras se editaba, se relee para mostrarla bloqueada con su motivo.
      if (e instanceof ApiError && e.status === 409) void cargar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="t-rubricas" aria-busy={!datos && !errorCarga}>
      <h2 id="t-rubricas">Rúbricas</h2>
      <p className="pista">
        Lo que ve cada participante al calificar. Cambias solo los textos: los valores 1, 3, 5, 7 y 9 y el cálculo quedan igual. Se pueden editar hasta el primer voto.
      </p>
      {!datos ? (
        errorCarga ? (
          <p className="alerta alerta--error" role="alert">
            No pudimos cargar las rúbricas. {errorCarga}{' '}
            <button className="btn btn--chico" type="button" onClick={() => void cargar()}>
              Reintentar
            </button>
          </p>
        ) : (
          <p role="status">Cargando rúbricas…</p>
        )
      ) : (
        criterio && (
          <>
            {!editable && datos.motivo_no_editable && (
              <p className="alerta alerta--aviso" id="rubricas-motivo">
                {datos.motivo_no_editable}
              </p>
            )}
            <label className="campo">
              <span>Criterio</span>
              <select
                value={criterio.id}
                disabled={cambiado}
                aria-describedby={cambiado ? 'rubricas-pendiente' : undefined}
                onChange={(e) => {
                  setCriterioId(e.target.value)
                  descartar()
                }}
              >
                {datos.criterios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            {cambiado && (
              <p id="rubricas-pendiente" className="pista">
                Guarda o descarta los cambios para pasar a otro criterio.
              </p>
            )}
            <p className="rubrica-pregunta">{criterio.pregunta}</p>
            <fieldset className="rubrica-niveles" disabled={!editable || guardando} aria-describedby={editable ? undefined : 'rubricas-motivo'}>
              <legend>Niveles de {criterio.nombre}</legend>
              {criterio.rubrica.map((n) => {
                const id = `rubrica-${criterio.id}-${n.valor}`
                const valor = texto(n.valor, n.texto)
                return (
                  <div className="rubrica-nivel" key={n.valor}>
                    <span className="rubrica-valor" aria-hidden="true">
                      {n.valor}
                    </span>
                    <div className="campo">
                      <label htmlFor={id}>Nivel {n.valor}</label>
                      <textarea
                        id={id}
                        rows={3}
                        maxLength={MAX_TEXTO}
                        value={valor}
                        aria-describedby={`${id}-cuenta`}
                        onChange={(e) => setBorrador({ ...Object.fromEntries(criterio.rubrica.map((r) => [r.valor, texto(r.valor, r.texto)])), [n.valor]: e.target.value })}
                      />
                      <small id={`${id}-cuenta`} className="pista">
                        {valor.length} de {MAX_TEXTO} caracteres
                      </small>
                    </div>
                  </div>
                )
              })}
              <label className="opcion">
                <input type="checkbox" checked={paraNuevas} onChange={(e) => setParaNuevas(e.target.checked)} />
                <span>
                  Usar también en las salas nuevas
                  <small>Las salas que crees después nacen con esta rúbrica. Las que ya existen no cambian.</small>
                </span>
              </label>
            </fieldset>
            {aviso && (
              <p className={`alerta alerta--${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
                {aviso.texto}
              </p>
            )}
            <div className="acciones">
              <button className="btn btn--primario" type="button" disabled={!editable || !cambiado || guardando} onClick={() => void guardar()}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button className="btn" type="button" disabled={!borrador || guardando} onClick={descartar}>
                Descartar cambios
              </button>
            </div>
          </>
        )
      )}
    </section>
  )
}
