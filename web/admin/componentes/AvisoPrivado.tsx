/** Secciones con datos personales (nombre, correo, respuestas): solo para administradores, nunca en el proyector. */
export function AvisoPrivado({ children }: { children: string }) {
  return (
    <p className="alerta alerta--aviso" role="note">
      <strong>Solo administradores. No se proyecta.</strong>
      {children}
    </p>
  )
}
