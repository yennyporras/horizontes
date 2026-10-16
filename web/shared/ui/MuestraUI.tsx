import { useState } from 'react'
import yo from '../../../mocks/GET_api_yo.json'
import { Aviso } from './Aviso'
import { BarraAccion } from './BarraAccion'
import { BarraProgreso } from './BarraProgreso'
import { Boton } from './Boton'
import { Campo } from './Campo'
import { Casilla } from './Casilla'
import { EncabezadoHorizonte } from './EncabezadoHorizonte'
import { Hoja } from './Hoja'
import { Insignia } from './Insignia'
import { Pestanas } from './Pestanas'
import { Rubrica } from './Rubrica'

const criterios = yo.criterios

/** Página /m/_ui: todos los componentes base con contenido real del caso, en 360 px. */
export function MuestraUI() {
  const [correo, setCorreo] = useState('ana@')
  const [acepta, setAcepta] = useState(false)
  const [pestana, setPestana] = useState('caso')
  const [respuestas, setRespuestas] = useState<Record<string, number | null>>({ [criterios[0].id]: 5, [criterios[1].id]: null })
  const [guardando, setGuardando] = useState(false)
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
  const hojas = yo.contenido.hojas

  return (
    <div className="hz hz-pagina" lang="es-CO">
      <EncabezadoHorizonte sala={yo.sala.nombre} meta={`${yo.participante.mesa.nombre} · Perfil ${yo.participante.perfil.nombre}`} />
      <main className="hz-contenido">
        <h1 className="hz-titulo">Componentes base</h1>
        <p className="hz-texto-2">Muestra del sistema de diseño de Horizontes. Todo lo que ves aquí lo usan las pantallas del participante.</p>

        <section className="hz-contenido" aria-labelledby="s-botones">
          <h2 id="s-botones" className="hz-subtitulo">Botones</h2>
          <Boton bloque>Calificar proyectos</Boton>
          <Boton variante="secundario" bloque>
            Editar mis calificaciones
          </Boton>
          <Boton variante="fantasma">Volver al caso</Boton>
          <Boton bloque deshabilitado>
            Inscribirme
          </Boton>
          <Boton
            bloque
            cargando={guardando}
            textoCargando="Guardando…"
            onClick={() => {
              setGuardando(true)
              setTimeout(() => setGuardando(false), 1500)
            }}
          >
            Guardar calificación
          </Boton>
        </section>

        <section className="hz-contenido" aria-labelledby="s-campos">
          <h2 id="s-campos" className="hz-subtitulo">Campos y autorización</h2>
          <Campo etiqueta="Tu nombre" ayuda="Así te verá el facilitador en la lista de tu mesa." autoComplete="name" defaultValue="Ana Pérez" />
          <Campo
            etiqueta="Tu correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            ayuda="Solo lo usamos con fines informativos."
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            error={correoValido ? null : 'Escribe un correo válido, por ejemplo ana@empresa.com.'}
          />
          <Casilla marcada={acepta} onCambio={setAcepta}>
            Autorizo a Estratek a tratar mis datos personales para fines informativos del taller.{' '}
            <a href="https://estratek.com.co" target="_blank" rel="noreferrer">
              Lee la Política de Tratamiento de Datos Personales de Estratek
            </a>
          </Casilla>
        </section>

        <section className="hz-contenido" aria-labelledby="s-rubrica">
          <h2 id="s-rubrica" className="hz-subtitulo">Rúbrica</h2>
          {criterios.slice(0, 2).map((c, i) => (
            <Rubrica
              key={c.id}
              criterioId={c.id}
              nombre={c.nombre}
              pregunta={c.pregunta}
              opciones={c.rubrica}
              valor={respuestas[c.id] ?? null}
              onCambio={(v) => setRespuestas((r) => ({ ...r, [c.id]: v }))}
              posicion={{ actual: i + 1, total: criterios.length }}
              error={respuestas[c.id] == null ? 'Elige una opción para este criterio.' : null}
            />
          ))}
        </section>

        <section className="hz-contenido" aria-labelledby="s-pestanas">
          <h2 id="s-pestanas" className="hz-subtitulo">Pestañas y hojas</h2>
          <Pestanas
            etiqueta="Lectura"
            activa={pestana}
            onCambio={setPestana}
            pestanas={[
              { id: 'caso', titulo: 'Caso', contenido: <p className="hz-texto-2">{yo.contenido.caso.situacion_md.split('\n')[0]}</p> },
              {
                id: 'hoja',
                titulo: 'Tu hoja',
                contenido: (
                  <div className="hz-contenido">
                    {hojas.map((h, i) => (
                      <Hoja key={h.proyecto_id} titulo={h.proyecto} activa={i === 0} extra={<Insignia>Tu hoja</Insignia>}>
                        {h.texto}
                      </Hoja>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </section>

        <section className="hz-contenido" aria-labelledby="s-progreso">
          <h2 id="s-progreso" className="hz-subtitulo">Progreso e insignias</h2>
          <BarraProgreso
            etiqueta={yo.participante.mesa.nombre}
            actual={yo.progreso_mesa.completos}
            total={yo.progreso_mesa.inscritos}
            texto={`${yo.progreso_mesa.completos} de ${yo.progreso_mesa.inscritos} completaron`}
          />
          <p style={{ display: 'flex', gap: 'var(--hz-sp-2)', flexWrap: 'wrap' }}>
            <Insignia tono="ok">Guardado</Insignia>
            <Insignia>Pendiente</Insignia>
            <Insignia tono="alerta">Preliminar</Insignia>
            <Insignia>Ronda 2</Insignia>
          </p>
        </section>

        <section className="hz-contenido" aria-labelledby="s-avisos">
          <h2 id="s-avisos" className="hz-subtitulo">Avisos</h2>
          <Aviso tono="info">Ya puedes ver la información de los 6 perfiles.</Aviso>
          <Aviso tono="ok">Calificación de INSUMEX guardada.</Aviso>
          <Aviso tono="alerta" titulo="Todos votaron en Mesa 1">
            Este es un resultado preliminar. Puedes editar tus calificaciones hasta que el facilitador cierre la ronda.
          </Aviso>
          <Aviso tono="alerta" titulo="Sin conexión">
            Seguimos intentando. Lo que marcaste está guardado en este celular.
          </Aviso>
          <Aviso tono="error" titulo="Algo falló de nuestro lado" accion={{ texto: 'Reintentar', onClick: () => undefined }}>
            Vuelve a intentarlo en unos segundos.
          </Aviso>
        </section>
      </main>
      <BarraAccion nota="Llevas 1 de 2 proyectos">
        <Boton bloque>Calificar proyectos</Boton>
      </BarraAccion>
    </div>
  )
}
