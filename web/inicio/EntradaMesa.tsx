import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ErrorApi } from '../shared/api/cliente'
import { Boton, Campo } from '../shared/ui'

// Código de mesa = código de la sala (HZ + 3), 3 caracteres al azar desde el 20-oct (S-5) y el número de la mesa,
// como HZ7K2QX4-1; las mesas anteriores no traen los 3 al azar: HZ7K2-1 (server/dominio/util.ts).
const FORMATO = /^[A-Z0-9]{3,10}-\d{1,3}$/

/** Código sin guion antes del número de la mesa: HZ7K2QX41 = HZ7K2QX4 y mesa 1; HZ7K21 = HZ7K2 y mesa 1. */
const SIN_GUION = /^(HZ[A-Z0-9]{3}(?:[A-Z0-9]{3})?)(\d{1,3})$/

/**
 * Acepta el código solo o el enlace completo del QR (…/m/HZ7K2-1), y lo que se teclea en el celular: minúsculas,
 * espacios alrededor del guion, un espacio en lugar del guion o el código sin guion. Devuelve null si no tiene el formato.
 */
export function codigoDeMesa(texto: string): string | null {
  const t = texto.trim()
  const enRuta = /\/m\/([^/?#\s]+)/i.exec(t)
  let codigo = (enRuta ? enRuta[1] : t)
    .toUpperCase()
    // Guiones tipográficos que pone el teclado y espacios alrededor del guion.
    .replace(/\s*[-\u2010-\u2015]\s*/g, '-')
    .replace(/\s+/g, '-')
  const junto = SIN_GUION.exec(codigo)
  if (junto) codigo = `${junto[1]}-${junto[2]}`
  return FORMATO.test(codigo) ? codigo : null
}

/** Formulario «Código de tu mesa»: valida contra GET /api/mesas/:codigo y lleva a /m/:codigo. */
export function EntradaMesa() {
  const navegar = useNavigate()
  const [texto, setTexto] = useState('')
  const [revisando, setRevisando] = useState(false)
  const [problema, setProblema] = useState<ReactNode>(null)
  const formulario = useRef<HTMLFormElement>(null)

  // Un error del código vuelve al campo: el lector de pantalla lee la etiqueta, el error y la ayuda.
  useEffect(() => {
    if (typeof problema === 'string') (formulario.current?.elements.namedItem('codigo') as HTMLInputElement | null)?.focus()
  }, [problema])

  async function entrar(e: FormEvent) {
    e.preventDefault()
    if (revisando) return
    const codigo = codigoDeMesa(texto)
    if (!codigo) {
      setProblema(texto.trim() ? 'Ese código no tiene la forma de un código de mesa. Se ve así: HZ7K2-1, con el número de la mesa al final.' : 'Escribe el código de tu mesa, por ejemplo HZ7K2-1.')
      return
    }
    setRevisando(true)
    try {
      const info = await api.mesa(codigo)
      if (info.inscripcion_abierta) {
        navegar(`/m/${codigo}`)
        return
      }
      // El enlace a la mesa va al inicio de una frase o a mitad de otra: su texto cambia con la mayúscula.
      const irMesa = (texto: string) => <Link to={`/m/${codigo}`}>{texto}</Link>
      setProblema(
        info.sala.estado === 'preparada' ? (
          <>
            La inscripción de {info.mesa.nombre} todavía no abre. El facilitador la abrirá en unos minutos. {irMesa(`Entra a ${info.mesa.nombre}`)} y espera
            ahí: la pantalla se actualiza sola.
          </>
        ) : (
          <>
            {info.sala.nombre} ya terminó y no recibe más inscripciones. Si te inscribiste desde este celular, {irMesa(`entra a ${info.mesa.nombre}`)} para
            ver el resultado.
          </>
        ),
      )
    } catch (err) {
      const status = err instanceof ErrorApi ? err.status : 0
      setProblema(
        status === 404
          ? `No encontramos una mesa con el código ${codigo}. Revisa el QR de tu mesa o pídele el código al facilitador.`
          : status === 0
            ? 'No hay conexión. Revisa tu señal y vuelve a intentarlo.'
            : 'Algo falló de nuestro lado. Vuelve a intentarlo en unos segundos.',
      )
    } finally {
      setRevisando(false)
    }
  }

  return (
    <form ref={formulario} className="in-entrada" onSubmit={entrar} noValidate>
      <Campo
        etiqueta="Código de tu mesa"
        ayuda="Está impreso junto al QR de tu mesa. También puedes pegar el enlace completo."
        name="codigo"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setProblema(null)
        }}
        placeholder="HZ7K2-1"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="go"
        error={typeof problema === 'string' ? problema : null}
      />
      {problema && typeof problema !== 'string' && (
        <p className="in-entrada__aviso" role="alert">
          {problema}
        </p>
      )}
      <Boton type="submit" bloque cargando={revisando} textoCargando="Buscando tu mesa…">
        Entrar a mi mesa
      </Boton>
    </form>
  )
}
