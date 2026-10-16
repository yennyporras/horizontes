# R0 · T3 Tablero · ~1 h · rama `t3-tablero`

1. Lee `CLAUDE.md`, los docs, `mocks/GET_api_tablero.json` y la diapositiva de priorización (descrita en `docs/SPEC.md` §8). Lee la skill `frontend-design`.
2. Prototipa la matriz de burbujas como componente independiente del framework (SVG puro, sin librerías pesadas): ejes 0-9,5, títulos y subtítulos de la semilla, cuartos de círculo H1/H2, etiquetas H1/H2/H3, 8 fijos, 2 vivos con R1 suave, R2 sólido y flecha, radio por TAM según `grafico.tam_a_radio`. Debe verse nítido en 1920 px y legible en 360 px.
3. Cuando `git log main --oneline | grep 'ESQUELETO LISTO'` devuelva algo (revísalo cada 10 min): `git rebase main` y mueve el componente a `web/tablero/`, conectado al mock en `/tablero/:sala`.

Aceptación: `/tablero/s_demo` dibuja el mock completo sin solapar etiquetas de los vivos.
Si a los 45 min de ronda el esqueleto no ha llegado, deja la parte de código lista como módulo independiente y anótalo en tu bitácora: la R1 arranca con el esqueleto integrado.
