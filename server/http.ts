import type { FastifyReply, FastifyRequest } from 'fastify'

/** Error con forma de contrato: {"error":{"codigo","mensaje"}}. */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

export function cuerpoError(codigo: string, mensaje: string) {
  return { error: { codigo, mensaje } }
}

/**
 * Responde un GET de estado con ETag a partir de `version`.
 * Si el cliente manda If-None-Match con la misma versión, responde 304 sin cuerpo.
 */
export function responderConVersion(req: FastifyRequest, reply: FastifyReply, cuerpo: { version: string | number }) {
  const etag = `"${cuerpo.version}"`
  reply.header('ETag', etag).header('Cache-Control', 'no-cache')
  const inm = req.headers['if-none-match']
  if (inm && inm.split(',').map((s) => s.trim().replace(/^W\//, '')).includes(etag)) {
    return reply.code(304).send()
  }
  return reply.send(cuerpo)
}
