// Pruebas en navegador real (tablero y celular): qué hacer cuando no hay navegador de Playwright.
// En local se omiten con aviso. En CI (CI=true) eso escondería una compuerta, así que el archivo falla.
// HZ_E2E=0 las apaga a propósito en cualquier lado.

/** `prefijo`: quién avisa, como «[tablero e2e]». `falta`: qué navegador no está. */
export function sinNavegador(prefijo: string, falta: string): void {
  if (process.env.HZ_E2E === '0') {
    console.warn(`${prefijo} HZ_E2E=0: se omite la prueba en navegador.`)
    return
  }
  if (process.env.CI === 'true') {
    throw new Error(
      `${prefijo} ${falta} En CI las pruebas en navegador son obligatorias: instala Chromium con ` +
        '`npx playwright-core install --with-deps chromium-headless-shell` o define PW_EXE. Para apagarlas a propósito: HZ_E2E=0.',
    )
  }
  console.warn(`${prefijo} ${falta} Se omite la prueba en navegador.`)
}
