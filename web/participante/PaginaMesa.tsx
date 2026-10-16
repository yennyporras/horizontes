import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Aviso, BarraProgreso, Boton } from '../shared/ui'
import { ErrorApi, obtenerMesa, type Mesa, type RespuestaVoto, type Yo } from './api'
import { Cargando, Marco, Mensaje, type MarcoBase } from './Comun'
import { Inscripcion } from './pantallas/Inscripcion'
import { Lectura } from './pantallas/Lectura'
import { ResultadoAlcance, textoAlcance } from './pantallas/Resultado'
import { Calificar, ElegirProyecto, proyectosVivos, votoDe } from './pantallas/Votacion'
import { bienvenidaPendiente, guardarToken, guardarVista, leerToken, leerVista, marcarBienvenida, olvidarSesion } from './sesion'
import { usarYo } from './usarYo'

// La muestra del sistema de diseño trae el mock de /api/yo: se carga aparte para no inflar el bundle.
const MuestraUI = lazy(() => import('../shared/ui/MuestraUI').then((m) => ({ default: m.MuestraUI })))

// T2: flujo del participante (DISENO §8). Ruta /m/:codigo; /m/_ui es la muestra del sistema de diseño.
export default function PaginaMesa() {
  const { codigo = '' } = useParams()
  if (codigo === '_ui')
    return (
      <Suspense fallback={<Cargando />}>
        <MuestraUI />
      </Suspense>
    )
  return <FlujoMesa key={codigo} codigo={codigo} />
}

function FlujoMesa({ codigo }: { codigo: string }) {
  const [token, setToken] = useState<string | null>(() => leerToken(codigo))
  const [yaInscrito, setYaInscrito] = useState(false)

  if (!token) {
    return (
      <AntesDeInscribirse
        codigo={codigo}
        onInscrito={(t, ya) => {
          guardarToken(codigo, t)
          marcarBienvenida(codigo, !ya)
          setYaInscrito(ya)
          setToken(t)
        }}
      />
    )
  }
  return (
    <Participante
      codigo={codigo}
      token={token}
      yaInscrito={yaInscrito}
      onSalir={() => {
        olvidarSesion(codigo)
        setYaInscrito(false)
        setToken(null)
      }}
    />
  )
}

// ── Antes de inscribirse: 8.0 a 8.3 ─────────────────────────────────────────

function AntesDeInscribirse({ codigo, onInscrito }: { codigo: string; onInscrito: (token: string, yaInscrito: boolean) => void }) {
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [error, setError] = useState<ErrorApi | null>(null)
  const [intento, setIntento] = useState(0)
  const [recuperar, setRecuperar] = useState(false)

  useEffect(() => {
    let vivo = true
    let t: ReturnType<typeof setTimeout> | undefined
    obtenerMesa(codigo)
      .then((m) => {
        if (!vivo) return
        setMesa(m)
        setError(null)
        // Inscripción aún cerrada: la pantalla se actualiza sola.
        if (!m.inscripcion_abierta && m.sala.estado === 'preparada') t = setTimeout(() => setIntento((i) => i + 1), 5000)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        const ea = e instanceof ErrorApi ? e : new ErrorApi(0, 'SIN_RED', 'Sin conexión')
        setError(ea)
        if (ea.esRed || ea.status >= 500) t = setTimeout(() => setIntento((i) => i + 1), 5000)
      })
    return () => {
      vivo = false
      if (t) clearTimeout(t)
    }
  }, [codigo, intento])

  if (error && !mesa) {
    if (error.status === 404 || error.codigo === 'MESA_NO_EXISTE') {
      return (
        <Mensaje titulo="No encontramos esta mesa">
          El código {codigo} no corresponde a ninguna mesa activa. Revisa el QR de tu mesa o pídele el enlace al facilitador.
        </Mensaje>
      )
    }
    if (error.esRed) {
      return (
        <Mensaje titulo="Sin conexión" accion={{ texto: 'Reintentar', onClick: () => setIntento((i) => i + 1) }}>
          No pudimos cargar tu mesa. Revisa la señal; seguimos intentando.
        </Mensaje>
      )
    }
    return (
      <Mensaje titulo="Algo falló de nuestro lado" tono="error" accion={{ texto: 'Reintentar', onClick: () => setIntento((i) => i + 1) }}>
        Vuelve a intentarlo en unos segundos.
      </Mensaje>
    )
  }
  if (!mesa) return <Cargando />

  if (!mesa.inscripcion_abierta) {
    if (recuperar) return <Inscripcion codigo={codigo} mesa={mesa} onInscrito={onInscrito} recuperar />
    const termino = mesa.sala.estado === 'cerrada' || mesa.sala.estado === 'r2_cerrada'
    if (mesa.sala.estado !== 'preparada') {
      // Quien ya se inscribió (otro celular, borró datos) puede volver con su correo.
      return (
        <Marco
          sala={mesa.sala.nombre}
          meta={mesa.mesa.nombre}
          claveFoco="inscripcion-cerrada"
          barra={
            <Boton bloque variante="secundario" onClick={() => setRecuperar(true)}>
              Ya me inscribí: recuperar mi sesión
            </Boton>
          }
        >
          <h1 className="hz-titulo">{termino ? 'El taller ya terminó' : 'La inscripción está cerrada'}</h1>
          <p className="hz-texto-2">
            {termino
              ? 'Esta sala cerró y no recibe más inscripciones. Gracias por participar.'
              : 'Esta sala ya no recibe inscripciones nuevas. Si llegaste tarde, pídele ayuda al facilitador.'}
          </p>
        </Marco>
      )
    }
    return (
      <Mensaje sala={mesa.sala.nombre} meta={mesa.mesa.nombre} titulo="Aún no abrimos la inscripción">
        El facilitador la abrirá en unos minutos. Deja esta pantalla abierta: se actualiza sola.
      </Mensaje>
    )
  }
  return <Inscripcion codigo={codigo} mesa={mesa} onInscrito={onInscrito} />
}

// ── Inscrito: 8.4 a 8.17 ────────────────────────────────────────────────────

type Vista = 'inicio' | 'lectura' | 'elegir' | `calificar:${string}`

function Participante({ codigo, token, yaInscrito, onSalir }: { codigo: string; token: string; yaInscrito: boolean; onSalir: () => void }) {
  const { yo, fatal, errorCarga, sinConexion, recuperada, refrescar, aplicar } = usarYo(token)
  const [vista, setVistaEstado] = useState<Vista>(() => (leerVista(codigo) as Vista | null) ?? 'inicio')
  const [bienvenida, setBienvenida] = useState(() => bienvenidaPendiente(codigo))
  const [avisoOk, setAvisoOk] = useState<string | null>(null)
  const [avisoInscrito, setAvisoInscrito] = useState(yaInscrito)

  const ir = useCallback(
    (v: Vista) => {
      setVistaEstado(v)
      guardarVista(codigo, v)
      setAvisoInscrito(false)
    },
    [codigo],
  )

  useEffect(() => {
    if (!avisoOk) return
    const t = setTimeout(() => setAvisoOk(null), 4000)
    return () => clearTimeout(t)
  }, [avisoOk])

  if (fatal) {
    if (fatal.codigo === 'PARTICIPANTE_INACTIVO' || fatal.codigo === 'PARTICIPANTE_DESACTIVADO') return <Desactivado />
    return (
      <Mensaje titulo="Tu sesión ya no está activa" accion={{ texto: 'Volver a inscribirme', onClick: onSalir }}>
        Inscríbete otra vez con el mismo correo y retomas donde ibas.
      </Mensaje>
    )
  }
  if (!yo) {
    if (errorCarga) {
      return (
        <Mensaje titulo="Algo falló de nuestro lado" tono="error" accion={{ texto: 'Reintentar', onClick: () => void refrescar() }}>
          {errorCarga.esRed ? 'Sin conexión. Seguimos intentando.' : 'Vuelve a intentarlo en unos segundos.'}
        </Mensaje>
      )
    }
    return <Cargando />
  }
  if (yo.participante.activo === false) return <Desactivado sala={yo.sala.nombre} />

  const ronda = yo.sala.ronda_actual
  const estado = yo.sala.estado
  const abierta = estado === 'r1_abierta' || estado === 'r2_abierta'
  const alcance = yo.config.alcance_resultados
  const vivos = proyectosVivos(yo)
  const completo = yo.completo_ronda || (vivos.length > 0 && vivos.every((p) => votoDe(yo, p.id)))
  const precierreSala = alcance === 'sala' && Boolean(yo.resultados?.progreso?.precierre)
  const precierre = abierta && (yo.progreso_mesa.precierre || precierreSala)
  const donde = textoAlcance(yo.resultados, alcance)

  const arriba: ReactNode[] = []
  if (sinConexion)
    arriba.push(
      <Aviso key="red" tono="alerta" titulo="Sin conexión">
        Seguimos intentando. Lo que marcaste está guardado en este celular.
      </Aviso>,
    )
  else if (recuperada) arriba.push(<Aviso key="ok-red" tono="ok">Conexión recuperada.</Aviso>)
  if (avisoInscrito) arriba.push(<Aviso key="ya" tono="info">Ya estabas inscrito con este correo. Retomas donde ibas.</Aviso>)
  if (avisoOk) arriba.push(<Aviso key="ok" tono="ok">{avisoOk}</Aviso>)
  if (precierre)
    arriba.push(
      <Aviso key="pre" tono="alerta" titulo={`Todos votaron en ${precierreSala && !yo.progreso_mesa.precierre ? 'la sala' : yo.participante.mesa.nombre}`}>
        Este es un resultado preliminar. El facilitador cerrará la ronda; hasta entonces puedes editar tus calificaciones.
      </Aviso>,
    )

  const marco: MarcoBase = {
    sala: yo.sala.nombre,
    meta: `${yo.participante.mesa.nombre} · ${yo.participante.perfil.nombre}`,
    arriba: arriba.length ? <div className="hzp-avisos">{arriba}</div> : undefined,
  }

  // 8.4 Perfil asignado (primera vez)
  if (bienvenida) {
    const nombres = vivos.map((p) => p.nombre).join(' y ') || 'los proyectos'
    return (
      <Marco
        {...marco}
        claveFoco="bienvenida"
        barra={
          <Boton
            bloque
            onClick={() => {
              marcarBienvenida(codigo, false)
              setBienvenida(false)
              ir('lectura')
            }}
          >
            Leer el caso
          </Boton>
        }
      >
        <p className="hz-texto-3">Hola, {yo.participante.nombre.split(' ')[0]}</p>
        <h1 className="hz-titulo">Tu perfil es {yo.participante.perfil.nombre}</h1>
        <p className="hz-texto-2">
          En tu mesa cada persona tiene información distinta sobre {nombres}. Tú aportas la mirada de {yo.participante.perfil.nombre}. Lee el caso, lee tu
          hoja y compártela con tu mesa.
        </p>
      </Marco>
    )
  }

  // 8.8 Calificar
  if (vista.startsWith('calificar:') && abierta) {
    const pid = vista.slice('calificar:'.length)
    return (
      <Calificar
        key={`${pid}-${ronda}`}
        yo={yo}
        codigo={codigo}
        token={token}
        proyectoId={pid}
        marco={marco}
        onVolver={() => ir('elegir')}
        onGuardado={(r: RespuestaVoto, nombre) => {
          aplicar((y) => conVoto(y, r))
          setAvisoOk(`Calificación de ${nombre} guardada.`)
          ir('inicio')
          void refrescar()
        }}
      />
    )
  }

  const botonLeer = (
    <Boton variante="fantasma" onClick={() => ir('lectura')}>
      Leer el caso y {yo.config.revelar_hojas ? 'las hojas' : 'tu hoja'}
    </Boton>
  )

  // 8.5 Lectura (también es la pantalla de espera 8.6 antes de la ronda 1)
  const esperaRonda1 = estado === 'preparada' || estado === 'inscripcion'
  const sinResultadoCerrada = (estado === 'r1_cerrada' || estado === 'r2_cerrada') && !yo.resultados
  if (vista === 'lectura' || esperaRonda1 || sinResultadoCerrada) {
    const siguiente = estado === 'r1_cerrada' ? 2 : 1
    const esperando = esperaRonda1 || estado === 'r1_cerrada'
    const enLectura = vista === 'lectura' && !esperaRonda1 && !sinResultadoCerrada
    let barra: ReactNode = undefined
    let nota: ReactNode = undefined
    if (abierta) {
      barra = (
        <Boton bloque onClick={() => ir(completo ? 'inicio' : 'elegir')}>
          {completo ? 'Ver mi votación' : 'Calificar proyectos'}
        </Boton>
      )
    } else if (enLectura) {
      barra = (
        <Boton bloque variante="secundario" onClick={() => ir('inicio')}>
          {estado === 'cerrada' || yo.resultados ? 'Ver el resultado' : 'Volver'}
        </Boton>
      )
    } else {
      nota = 'La votación se abre cuando el facilitador lo indique.'
      barra = <span className="hz-visual-oculto">Esperando la ronda</span>
    }
    return (
      <Marco {...marco} claveFoco={`lectura-${estado}`} barra={barra} notaBarra={nota}>
        <h1 className="hz-titulo">El caso y {yo.config.revelar_hojas ? 'las hojas' : 'tu hoja'}</h1>
        {esperando && (
          <Aviso tono="info">
            {sinResultadoCerrada && estado === 'r1_cerrada'
              ? 'La ronda 1 se cerró. '
              : ''}
            La ronda {siguiente} aún no está abierta. Mientras tanto, lee el caso y tu hoja.
          </Aviso>
        )}
        {sinResultadoCerrada && estado === 'r2_cerrada' && <Aviso tono="info">La ronda 2 se cerró. El resultado aparece aquí en unos segundos.</Aviso>}
        <Lectura yo={yo} codigo={codigo} />
      </Marco>
    )
  }

  // 8.13 Sala cerrada
  if (estado === 'cerrada') {
    return (
      <Marco {...marco} claveFoco="cerrada">
        <h1 className="hz-titulo">El taller terminó</h1>
        <p className="hz-texto-2">Gracias por participar. Este es el resultado final de {donde}.</p>
        {yo.resultados ? <ResultadoAlcance resultados={yo.resultados} criterios={yo.criterios} alcance={alcance} preliminar={false} /> : null}
        {botonLeer}
      </Marco>
    )
  }

  // 8.12 Ronda cerrada
  if (estado === 'r1_cerrada' || estado === 'r2_cerrada') {
    return (
      <Marco {...marco} claveFoco={`cerrada-${ronda}`}>
        <h1 className="hz-titulo">Ronda {ronda} cerrada</h1>
        <p className="hz-texto-2">
          {ronda === 1
            ? `Este es el resultado de ${donde}. Discútanlo en la mesa antes de la ronda 2.`
            : `Así se movieron ${vivos.map((p) => p.nombre).join(' y ')} de la ronda 1 a la ronda 2 en ${donde}.`}
        </p>
        {ronda === 1 && <Aviso tono="info">La ronda 2 aún no está abierta. Mientras tanto, lee el caso y tu hoja.</Aviso>}
        {yo.resultados && <ResultadoAlcance resultados={yo.resultados} criterios={yo.criterios} alcance={alcance} preliminar={false} />}
        {botonLeer}
      </Marco>
    )
  }

  // Ronda abierta. 8.7 Elegir proyecto (pendiente o editando)
  const resultadoPreliminar = yo.resultados ? (
    <ResultadoAlcance resultados={yo.resultados} criterios={yo.criterios} alcance={alcance} preliminar />
  ) : null

  if (!completo || vista === 'elegir') {
    return (
      <Marco {...marco} claveFoco={`elegir-${ronda}`}>
        <ElegirProyecto yo={yo} onCalificar={(pid) => ir(`calificar:${pid}`)} />
        {completo && (
          <Boton variante="secundario" onClick={() => ir('inicio')}>
            Listo, ya no voy a editar
          </Boton>
        )}
        {botonLeer}
        {precierre && resultadoPreliminar && (
          <section className="hzp-seccion" aria-labelledby="hzp-pre">
            <h2 id="hzp-pre" className="hz-subtitulo">
              Resultado preliminar de {donde}
            </h2>
            {resultadoPreliminar}
          </section>
        )}
      </Marco>
    )
  }

  // 8.10 En vivo
  if (yo.config.vista_participante === 'en_vivo' && yo.resultados && !precierre) {
    return (
      <Marco {...marco} claveFoco={`envivo-${ronda}`}>
        <h1 className="hz-titulo">Resultados en vivo de {donde}</h1>
        <p className="hz-texto-2">Calificaste los {vivos.length} proyectos en la ronda {ronda}. Puedes editar mientras la ronda siga abierta.</p>
        {resultadoPreliminar}
        <Boton variante="secundario" onClick={() => ir('elegir')}>
          Editar mis calificaciones
        </Boton>
        {botonLeer}
      </Marco>
    )
  }

  // 8.9 Voto registrado (y 8.11 precierre encima)
  const { inscritos, completos } = yo.progreso_mesa
  return (
    <Marco {...marco} claveFoco={`registrado-${ronda}`}>
      <h1 className="hz-titulo">Voto registrado</h1>
      <p className="hz-texto-2">
        Calificaste {vivos.map((p) => p.nombre).join(' y ')} en la ronda {ronda}. Puedes editar mientras la ronda siga abierta.
      </p>
      <BarraProgreso
        actual={completos}
        total={inscritos}
        texto={`${completos} de ${inscritos} completaron en ${yo.participante.mesa.nombre}`}
      />
      <div className="hzp-acciones">
        <Boton variante="secundario" bloque onClick={() => ir('elegir')}>
          Editar mis calificaciones
        </Boton>
        <Boton variante="fantasma" onClick={() => ir('lectura')}>
          Volver al caso
        </Boton>
      </div>
      {precierre && resultadoPreliminar && (
        <section className="hzp-seccion" aria-labelledby="hzp-pre">
          <h2 id="hzp-pre" className="hz-subtitulo">
            Resultado preliminar de {donde}
          </h2>
          {resultadoPreliminar}
        </section>
      )}
    </Marco>
  )
}

function Desactivado({ sala }: { sala?: string }) {
  return (
    <Mensaje sala={sala} titulo="El facilitador te retiró de esta mesa">
      Si es un error, avísale en el salón.
    </Mensaje>
  )
}

/** Refleja en local el voto recién guardado (la siguiente versión del servidor lo confirma). */
function conVoto(yo: Yo, r: RespuestaVoto): Yo {
  const otros = yo.mis_votos.filter((v) => !(v.proyecto_id === r.voto.proyecto_id && v.ronda === r.voto.ronda))
  return {
    ...yo,
    mis_votos: [...otros, r.voto],
    pendientes: yo.pendientes.filter((p) => p !== r.voto.proyecto_id),
    completo_ronda: r.completo_ronda,
    progreso_mesa: r.progreso_mesa ?? yo.progreso_mesa,
  }
}
