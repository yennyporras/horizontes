# web/shared/ui

Sistema de diseño compartido. Lo consumen la landing, el celular, el tablero y el panel.

Línea gráfica: `docs/marca/FAMILIA_ESTRATEK.md` (ley) y `docs/DISENO.md` (tokens, contrastes y componentes).
- `tokens.css`: primitivos `--et-*` y semánticos `--hz-*`. Una sola apariencia desde el 20-oct: tema claro en todas las vistas (`:root`). El tema carbón (`data-tema="carbon"`) es solo para la barra superior.
- `EncabezadoProducto`: la barra superior carbón (glifo, nombre, «por Estratek »» y línea del degradado). Lleva `data-tema="carbon"` en su `<header>`: no hace falta envolverlo. Lo que se pasa como hijo (navegación, botones, menú) se ve en carbón.
- `LogoEstratek`: logo oficial de Estratek pintado con la tinta del tema (carbón sobre claro, hielo en la barra).
- `useTemaDocumento('claro')`: pone el tema en `<html>` mientras la vista está montada.
- `marca/`: glifo de Horizontes y `estratek-logo.png`, el logo oficial de Estratek recortado al borde del dibujo (un solo color; es la máscara de `LogoEstratek`).
- Muestra viva en desarrollo: `/m/_ui`.
