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
/** ¿El cliente mandó If-None-Match con esta versión? */
export function yaLaTiene(req: FastifyRequest, version: string | number) {
  const inm = req.headers['if-none-match']
  return Boolean(inm && inm.split(',').map((s) => s.trim().replace(/^W\//, '')).includes(`"${version}"`))
}

export function responderConVersion<T extends { version: string | number }>(req: FastifyRequest, reply: FastifyReply, cuerpo: T) {
  const etag = `"${cuerpo.version}"`
  reply.header('ETag', etag).header('Cache-Control', 'no-cache')
  if (yaLaTiene(req, cuerpo.version)) return reply.code(304).send()
  return reply.send(cuerpo)
}
