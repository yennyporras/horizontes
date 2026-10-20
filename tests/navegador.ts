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

/**
 * Reintentos de las pruebas en navegador real, y solo de ellas (el resto de la suite no reintenta). En la máquina de
 * desarrollo, con la memoria agotada, Chromium deja la página quieta hasta un minuto: sus hilos de baja prioridad
 * (raster de la página, escrituras de su perfil) se quedan sin turno y el hilo principal los espera, así que no corren
 * ni los temporizadores ni el polling y cualquier espera vence. No es un fallo de la app ni de la prueba (trazas del
 * 20-oct en docs/DECISIONES.md), y la prueba lo dice al fallar (`avisarSiCongelada`). En CI no se reintenta: allí
 * un fallo es un fallo. `HZ_E2E_REINTENTOS=0` los apaga también en local (`--retry=0` no basta: manda el del describe).
 */
export const REINTENTOS_E2E = Number(process.env.HZ_E2E_REINTENTOS ?? (process.env.CI === 'true' ? 0 : 1))
