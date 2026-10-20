# Familia Estratek · Línea gráfica v1

Fuente única de la identidad visual de las herramientas de Estratek: Horizontes, IRMI, Building y Motor Comercial. Aprobada por Paola el 19-oct-2026. Piloto: Horizontes.

Los colores de marca son **exactos** de estratek.com.co: kit de Elementor 1641, CSS adicional del tema y clase `.fondo-estratek`. No se inventan colores de marca. Los derivados (superficies, estados, azul profundo) existen solo para cumplir contraste AA y se documentan aquí.

## 1. Arquitectura de marca
- **Respaldada (endorsed):** cada herramienta tiene nombre, glifo y acento propios y firma «por Estratek ». Así las herramientas se distinguen entre sí y se reconocen como de la misma empresa.
- **Común a todas:**
  - paleta núcleo;
  - Montserrat;
  - retícula de 8 px;
  - radios;
  - componentes;
  - foco;
  - el azul Estratek como único color de acción.
- **Propio de cada herramienta:** solo el acento. Se usa en el glifo, la línea del encabezado y los gráficos propios. Nunca es color de acción ni de estado.

| Herramienta | Acento | Uso de texto sobre carbón | Uso de texto sobre claro |
|---|---|---|---|
| Horizontes | Verde agua `#00CDA1` | `#00CDA1` (9,0:1) | `#007A60` (5,3:1) |
| IRMI | Azul Estratek `#3487FF` | `#3487FF` (5,3:1) | `#1A66D6` (5,4:1) |
| Building | Violeta `#442AAF`, aclarado a `#8B78F0` | `#8B78F0` (5,3:1) | `#442AAF` (9,6:1) |
| Motor Comercial | Hielo 2 `#BEDAFF` | `#BEDAFF` | `#1A66D6` |

## 2. Paleta núcleo (primitivos)
| Token | Hex | Rol |
|---|---|---|
| `--et-carbon` | `#141414` | Fondo de marca; texto sobre claro |
| `--et-hielo` | `#DCECFF` | Texto sobre carbón; superficies claras |
| `--et-hielo-2` | `#BEDAFF` | Bandas y fondos partidos |
| `--et-azul` | `#3487FF` | Acción, cifras destacadas y enlaces sobre carbón. **Texto encima: carbón** (5,31:1). El blanco no llega a AA (3,47:1). |
| `--et-azul-profundo` | `#1A66D6` | Derivado. Acción y enlaces sobre claro; texto blanco encima (5,36:1). |
| `--et-verde-agua` | `#00CDA1` | Final del degradado, éxito sobre carbón. **Nunca texto sobre blanco** (2,05:1). |
| `--et-violeta` | `#442AAF` | Inicio del degradado. **Nunca texto sobre carbón** (1,93:1). |
| `--et-rojo` | `#BF0029` | Solo errores y acciones destructivas |
| `--et-grad` | `linear-gradient(90deg, #442AAF 0%, #3487FF 30%, #00CDA1 100%)` | Firma de marca |

**Reglas del degradado:** solo en líneas (la «raya» de 3 a 6 px bajo el encabezado), bordes, barras de progreso y elementos gráficos grandes. **Nunca detrás de texto.**

## 3. Temas por contexto
Mismos nombres de tokens; solo cambian los valores.

| Contexto | Tema |
|---|---|
| Landing pública y proyección (tablero) | **Carbón** |
| Celular del participante y panel del facilitador | **Claro**. El panel lleva barra superior carbón con la línea del degradado. |

| Token semántico | Claro | Carbón |
|---|---|---|
| fondo | `#FFFFFF` | `#141414` |
| superficie-1 | `#F3F8FF` | `#1B1D22` |
| superficie-2 | `#E8F1FF` | `#23262D` |
| superficie-3 | `#DCECFF` | `#2C3038` |
| borde | `#C9D9F2` | `#343944` |
| borde de control (≥3:1) | `#5A6680` | `#8A9BB8` |
| tinta | `#141414` | `#DCECFF` |
| tinta-2 | `#44506A` | `#A8B6CF` |
| tinta-3 | `#5A6680` | `#8A9BB8` |
| acción | `#1A66D6` | `#3487FF` |
| sobre acción | `#FFFFFF` | `#141414` |
| foco | `#1A66D6` | `#3487FF` |
| ok / fondo | `#007A60` / `#DDF6EF` | `#00CDA1` / `#10332B` |
| alerta / fondo | `#8A5A00` / `#FFF3D6` | `#FFBB44` / `#2B2418` |
| error / fondo | `#BF0029` / `#FDE7EB` | `#FF6B7F` / `#3A1620` |

Todos los pares tinta/fondo y estado/fondo pasan AA. Contrastes medidos con WCAG 2.2 el 19-oct.

**Texto en color de acción:** solo sobre fondo, superficie-1 o el fondo de información. Sobre superficie-3 en claro (4,47:1) y sobre superficie-2 en carbón (4,37:1) no llega a AA. Sobre un relleno de acción, el texto va en «sobre acción».

**Gráficos junto a R1/R2:** el acento verde agua no se usa en elementos de la matriz de Horizontes (bordes de horizonte, rejilla), porque en proyector se confunde con el verde de R1. Esos elementos van en el borde de control neutro.

## 4. Tipografía
- **Fuente:** Montserrat, autoalojada (sin Google Fonts en producción), con respaldo `"Segoe UI", system-ui, sans-serif`.
- **Pesos:** tipo oración, sin mayúsculas sostenidas. Cuerpo en 400 y 500; etiquetas en 700; títulos en 800; display y cifras en 900, como los titulares del sitio.
- **Escala:** 12 · 14 · 16 · 20 · 24 · 32 · 40 · 56. Para proyección, además, 72 y 96. Cuerpo de 16 px; en paneles densos, 14 px.
- **Cifras:** tabulares (`font-variant-numeric: tabular-nums`) en tablas, KPI y resultados.
- **Firma:** la flecha doble **»** del logo, en azul Estratek, como marca gráfica: al lado de «por Estratek», en enlaces de avance y en encabezados.

## 5. Forma y espacio
- **Retícula:** 8 px con medio paso de 4. Espaciado de 4, 8, 12, 16, 24, 32, 40, 48, 64 y 80.
- **Radios:**
  - botones en píldora (999 px), como el sitio;
  - campos en 12;
  - tarjetas en 16;
  - insignias en píldora.
- **Jerarquía:** por superficie y borde de 1 px. Sombra solo en lo que flota (menú, diálogo, aviso emergente).
- **Áreas táctiles:** 48 px como mínimo.
- **Foco:** contorno de 2 px en el color de foco, separado 2 px, con soporte de `forced-colors`.
- **Movimiento:** 150 ms en interacción y 250 ms en transiciones. Siempre se respeta `prefers-reduced-motion`.

## 6. Componentes comunes
- **Botón:**
  - primario sólido en color de acción (uno por vista);
  - secundario con contorno;
  - destructivo en rojo;
  - deshabilitado plano, nunca por opacidad.
- **Campo:** etiqueta encima (14/700), ayuda debajo y error con ícono y texto.
- **Tarjeta:** superficie-1 con borde.
- **Tabla:** encabezado fijo en superficie-1, cifras a la derecha y tabulares, filas de 40 a 48 px.
- **Insignia de estado:** fondo del estado, texto del estado e ícono o símbolo; nunca solo color.
- **Aviso y estado vacío:** título orientado a la acción, una frase y una acción.
- **Encabezado de producto:** glifo del acento, nombre de la herramienta, «por Estratek » y línea del degradado.
- **Logos oficiales** (PNG del sitio, no hay vector): `web/shared/ui/marca/estratek-logo-blanco.png` y `estratek-logo-hielo.png`. Solo sobre carbón.

## 7. Visualización de datos
- La forma y el texto acompañan siempre al color.
- Paleta categórica en este orden: azul `#3487FF`, verde agua `#00CDA1`, violeta claro `#8B78F0`, hielo 2 `#BEDAFF`, ámbar `#FFBB44`.
- Los colores semánticos (ok, alerta, error) no se usan como categorías.
- Gráficos con 3:1 mínimo contra el fondo.
- **Horizontes, por acta del 16-oct:** R1 verde hueco y R2 rojo sólido, siempre con «R1»/«R2».

  | Ronda | Claro | Carbón |
  |---|---|---|
  | R1 | `#1B7F3A` | `#3FB25A` |
  | R2 | `#C62828`, texto blanco encima | `#F36363`, texto carbón encima |

## 8. No
- Teal `#47EBC2` ni azules propios de cada producto (`#1C4587`, `#004782`, `#1699DB`).
- Texto blanco sobre el azul Estratek.
- Degradado detrás de texto.
- Otra tipografía.
- Sombras fuertes ni brillos.
- Opacidad para deshabilitar.
- Recursos por CDN.
- El color como único portador de significado.
