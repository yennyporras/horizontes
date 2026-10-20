# web/shared/ui

Sistema de diseño compartido. Responsable: equipo del celular. El tablero y el panel lo consumen en solo lectura.

Línea gráfica: `docs/marca/FAMILIA_ESTRATEK.md` (ley) y `docs/DISENO.md` (tokens, contrastes y componentes).
- `tokens.css`: primitivos `--et-*` y semánticos `--hz-*`. Tema claro por defecto; tema carbón con `data-tema="carbon"` en el elemento raíz de la vista (y `useTemaDocumento('carbon')`).
- `EncabezadoProducto`: glifo, nombre, «por Estratek »» y línea del degradado. Para el celular, el panel y la landing.
- `marca/`: logos oficiales de Estratek (PNG, solo sobre carbón).
