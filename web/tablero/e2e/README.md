# Verificación en navegador del tablero (manual)

Scripts Node con `playwright-core` (el que trae `@playwright/cli` global) y el Chromium headless instalado.
No corren en Vitest; se usan para la aceptación en navegador real.

```bash
export PW_BASE="$(npm root -g)/@playwright/cli"
export PW_EXE="$(ls -d ~/AppData/Local/ms-playwright/chromium_headless_shell-*/*/ | head -1)chrome-headless-shell.exe"   # Windows

# 1. API real con BD temporal y Vite apuntando a ella
PORT=8813 DB_PATH=/tmp/hz.sqlite SUPERADMIN_USUARIO=t3prueba SUPERADMIN_CLAVE=clave-prueba-t3-123 npx tsx server/index.ts &
API_URL=http://127.0.0.1:8813 npx vite --port 5184 --strictPort &

# 2. Cargar la prueba sintética del golden (sala de 2 mesas, 20 personas, 80 votos por ronda)
node web/tablero/e2e/golden_api.mjs http://127.0.0.1:8813 t3prueba clave-prueba-t3-123 tests/golden/motor_golden.json r2_cerrada
#    → {"id":"s_xxx","token":"..."}

# 3. Puntos dibujados contra golden en 1920, 1366 y 360 px (lee el SVG y lo convierte con las marcas del eje)
node web/tablero/e2e/verificar_golden.mjs "http://localhost:5184/tablero/s_xxx?t=TOKEN" tests/golden/motor_golden.json /ruta/capturas

# 4. Actualización en vivo (< 5 s): sala con R1 abierta, cierra la ronda por API y mide
node web/tablero/e2e/vivo.mjs http://localhost:5184 http://127.0.0.1:8813 t3prueba clave-prueba-t3-123 s_xxx TOKEN

# Capturas (con mocks) y vista Comparación sin parpadeo
node web/tablero/e2e/capturas.mjs "http://localhost:5183/tablero/s_demo?t=demo" /ruta/capturas
node web/tablero/e2e/comparacion.mjs "http://localhost:5183/tablero/s_demo?t=demo" /ruta/capturas
```

Resultado R1 (16-oct): golden OK en los 3 anchos (error ≤ 0,0001); cierre de ronda reflejado en 2,1 s.
