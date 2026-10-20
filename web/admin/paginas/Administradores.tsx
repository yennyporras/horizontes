import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, lista } from '../api'
import { useConfirmar } from '../componentes/Confirmar'
import type { AdminFila } from '../tipos'
import { useTituloPagina } from './EncabezadoSala'
import { LARGO_MINIMO_CLAVE } from '../textos'

/**
 * QA-A-21: la regla del usuario, visible y en español (antes vivía en un `title` que no se ve en el celular). Paula (QA
 * por roles): una sola regla en panel y servidor, 3 a 30 caracteres con minúsculas, números, punto, guion o guion bajo.
 * El servidor la publica en `shared/reglas/usuario.ts` (`RE_USUARIO_ADMIN`); mientras esta rama no la tenga, va aquí y
 * una prueba la compara con la del servidor.
 */
export const RE_USUARIO_ADMIN = /^[a-z0-9._-]{3,30}$/
export const REGLA_USUARIO = 'Entre 3 y 30 caracteres: minúsculas, números, punto, guion o guion bajo. Sin espacios ni tildes.'
export const usuarioValido = (u: string) => RE_USUARIO_ADMIN.test(u)

/** Clave temporal legible: 12 caracteres sin letras que se confunden (0/O, 1/l/I). */
export function claveTemporal(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const n = new Uint32Array(12)
  crypto.getRandomValues(n)
  return Array.from(n, (x) => abc[x % abc.length]).join('')
}

type Aviso = { tono: 'exito' | 'error' | 'info'; texto: string; clave?: string } | null

/** Solo superadmin. El servidor responde 403 SOLO_SUPERADMIN al resto; aquí además la ruta y el menú se ocultan. */
export function Administradores() {
  const [admins, setAdmins] = useState<AdminFila[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState(claveTemporal)
  const [dialogo, confirmar] = useConfirmar()
  const [errorUsuario, setErrorUsuario] = useState<string | null>(null)
  useTituloPagina('Administradores')

  const cargar = useCallback(
    () =>
      api
        .get<unknown>('/api/admin/admins')
        .then((r) => {
          setAdmins(lista<AdminFila>(r, 'admins'))
          setError(null)
        })
        .catch((e: Error) => setError(e.message)),
    [],
  )

  useEffect(() => {
    cargar()
  }, [cargar])

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    setAviso(null)
    if (!usuarioValido(usuario.trim())) {
      setErrorUsuario(`Ese usuario no sirve. ${REGLA_USUARIO}`)
      document.getElementById('nuevo-usuario')?.focus()
      return
    }
    setErrorUsuario(null)
    try {
      await api.post('/api/admin/admins', { usuario: usuario.trim(), nombre: nombre.trim(), correo: correo.trim() || null, clave_temporal: clave })
      setAviso({ tono: 'exito', texto: `Creamos la cuenta de ${nombre.trim()} (usuario ${usuario.trim()}). Entrégale esta clave temporal; la cambiará en su primer ingreso:`, clave })
      setUsuario('')
      setNombre('')
      setCorreo('')
      setClave(claveTemporal())
      await cargar()
    } catch (err) {
      setAviso({ tono: 'error', texto: err instanceof Error ? err.message : 'No se pudo crear la cuenta.' })
    }
  }

  const cambiarActivo = async (a: AdminFila) => {
    if (a.activo && !(await confirmar(`¿Desactivar a ${a.nombre}?`, 'No podrá entrar al panel hasta que lo actives de nuevo.', 'Sí, desactivar'))) return
    setAviso(null)
    try {
      await api.patch(`/api/admin/admins/${a.id}`, { activo: !a.activo })
      setAviso({ tono: 'exito', texto: a.activo ? `${a.nombre} ya no puede entrar al panel.` : `${a.nombre} puede entrar de nuevo.` })
      await cargar()
    } catch (err) {
      setAviso({ tono: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar el cambio.' })
    }
  }

  const restablecer = async (a: AdminFila) => {
    if (!(await confirmar(`¿Restablecer la clave de ${a.nombre}?`, 'Su clave actual deja de servir. Le darás una clave temporal y la cambiará al entrar.', 'Sí, restablecer'))) return
    const nueva = claveTemporal()
    setAviso(null)
    try {
      const r = await api.patch<{ clave_temporal?: string }>(`/api/admin/admins/${a.id}`, { restablecer_clave: nueva })
      setAviso({ tono: 'exito', texto: `Nueva clave temporal de ${a.nombre}. Entrégasela; la cambiará en su próximo ingreso:`, clave: r?.clave_temporal ?? nueva })
      await cargar()
    } catch (err) {
      setAviso({ tono: 'error', texto: err instanceof Error ? err.message : 'No se pudo restablecer la clave.' })
    }
  }

  return (
    <>
      {dialogo}
      <h1 tabIndex={-1}>Administradores</h1>
      <p className="pista">Solo tú, como superadmin, ves esta sección. Las cuentas nuevas son de rol admin: manejan salas pero no crean otros administradores.</p>
      {aviso && (
        <div className={`alerta alerta--${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
          {aviso.texto}
          {aviso.clave && (
            <p>
              <span className="clave-temporal">{aviso.clave}</span>
            </p>
          )}
        </div>
      )}

      <section className="panel" aria-labelledby="t-nuevo">
        <h2 id="t-nuevo">Nuevo administrador</h2>
        <form className="fila-form" onSubmit={crear}>
          <div className="campo">
            <label htmlFor="nuevo-usuario">Usuario</label>
            <input
              id="nuevo-usuario"
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={usuario}
              aria-invalid={errorUsuario ? true : undefined}
              aria-describedby={errorUsuario ? 'regla-usuario error-usuario' : 'regla-usuario'}
              onChange={(e) => setUsuario(e.target.value.toLowerCase())}
            />
            <small id="regla-usuario" className="pista">
              {REGLA_USUARIO}
            </small>
            {errorUsuario && (
              <small id="error-usuario" className="error-campo" role="alert">
                {errorUsuario}
              </small>
            )}
          </div>
          <label className="campo">
            <span>Nombre</span>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="campo">
            <span>Correo (opcional)</span>
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </label>
          <label className="campo">
            <span>Clave temporal</span>
            <input required minLength={LARGO_MINIMO_CLAVE} value={clave} onChange={(e) => setClave(e.target.value)} />
          </label>
          <button className="hz-boton hz-boton--primario" type="submit">
            Crear administrador
          </button>
        </form>
      </section>

      <section className="panel" aria-labelledby="t-cuentas">
        <h2 id="t-cuentas">Cuentas</h2>
        {error && (
          <p className="alerta alerta--error" role="alert">
            No pudimos cargar las cuentas. {error}
          </p>
        )}
        {!admins && !error && <p role="status">Cargando cuentas…</p>}
        {admins?.length === 0 && <p className="vacio">No hay cuentas para mostrar.</p>}
        {admins && admins.length > 0 && (
          <div className="tabla-envoltura">
            <table className="tabla-tarjetas">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className={a.activo ? undefined : 'inactivo'}>
                    <th scope="row">{a.nombre}</th>
                    <td data-label="Usuario">{a.usuario}</td>
                    <td data-label="Correo" className="td-largo">{a.correo ?? 'Sin correo'}</td>
                    <td data-label="Rol">{a.rol === 'superadmin' ? 'Superadmin' : 'Admin'}</td>
                    <td data-label="Estado">
                      {!a.activo ? (
                        <span className="etiqueta etiqueta--apagado">Inactivo</span>
                      ) : a.debe_cambiar_clave ? (
                        <span className="etiqueta etiqueta--aviso">Clave temporal</span>
                      ) : (
                        <span className="etiqueta etiqueta--exito">Activo</span>
                      )}
                    </td>
                    <td data-label="Acciones">
                      {a.rol === 'superadmin' ? (
                        <span className="pista">Se administra desde el servidor</span>
                      ) : (
                        <span className="acciones acciones--fila">
                          <button
                            type="button"
                            className="hz-boton hz-boton--secundario hz-boton--chico"
                            aria-label={`Restablecer la clave de ${a.nombre}`}
                            onClick={() => restablecer(a)}
                            disabled={!a.activo}
                          >
                            Restablecer clave
                          </button>
                          <button
                            type="button"
                            className="hz-boton hz-boton--secundario hz-boton--chico"
                            aria-label={`${a.activo ? 'Desactivar' : 'Activar'} a ${a.nombre}`}
                            onClick={() => cambiarActivo(a)}
                          >
                            {a.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
