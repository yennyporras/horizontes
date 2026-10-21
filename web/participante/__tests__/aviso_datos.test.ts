// El aviso corto del celular (hz-1.3) y la tabla §5.2 de docs/CONSENTIMIENTO.md dicen lo mismo, palabra por palabra.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AVISO_DATOS, LEY_DATOS, VERSION_AVISO_DATOS } from '../pantallas/Inscripcion'
import { VERSION_CONSENTIMIENTO } from '../../../server/dominio/consentimiento'

const doc = readFileSync('docs/CONSENTIMIENTO.md', 'utf8')
const tabla = doc.slice(doc.indexOf('### 5.2'), doc.indexOf('### 5.3'))

describe('aviso de datos del celular y docs/CONSENTIMIENTO.md §5.2', () => {
  it('misma versión que el servidor', () => {
    expect(VERSION_AVISO_DATOS).toBe(VERSION_CONSENTIMIENTO)
  })
  it('cada texto del celular está en la tabla del documento', () => {
    for (const t of Object.values(AVISO_DATOS)) expect(tabla).toContain(t)
    for (const l of Object.values(LEY_DATOS)) {
      expect(tabla).toContain(l.norma)
      expect(tabla).toContain(l.derechos)
      if (l.autoridad) expect(tabla).toContain(l.autoridad.replace(/^la /, ''))
      if (l.ubicacion) expect(tabla).toContain(l.ubicacion)
    }
    expect(tabla).toContain('respondemos en un plazo máximo de 10 días hábiles')
  })
})
