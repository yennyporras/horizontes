// Regla única del usuario de un administrador (QA por roles, 20-oct): la valida el servidor al crear un admin y la usa el
// panel en el formulario, para que los dos digan lo mismo. Sin dependencias: el panel la importa tal cual.

export const LARGO_MINIMO_USUARIO = 3
export const LARGO_MAXIMO_USUARIO = 30

/** De 3 a 30 caracteres: letras minúsculas sin tilde, números, punto, guion o guion bajo. */
export const RE_USUARIO_ADMIN = /^[a-z0-9._-]{3,30}$/

export const MENSAJE_USUARIO_ADMIN = `El usuario debe tener entre ${LARGO_MINIMO_USUARIO} y ${LARGO_MAXIMO_USUARIO} caracteres: letras minúsculas, números, punto, guion o guion bajo.`

/** ¿Es un usuario válido tal como llega? El servidor lo recorta y lo pasa a minúsculas antes de validarlo. */
export const usuarioAdminValido = (usuario: string): boolean => RE_USUARIO_ADMIN.test(usuario)
