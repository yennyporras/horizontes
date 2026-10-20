# Propuesta de cambios a la semilla del caso Foodsume (para Sebastián)

**Estado:** propuesta, sin aplicar. La semilla (`data/seed_foodsume.json`) tiene los textos, pesos y calificaciones que aprobó Sebastián y la app no la cambia sin él. Esta lista sale del QA por roles del 20-oct-2026 (CEO, facilitador, comunicaciones, CTO, empresa cliente, participante, jurado de hackatón e inversionista). Cada punto dice qué hay hoy, qué se propone y por qué. Sebastián marca **Sí**, **No** o **Cambiar a…** en cada uno; con eso se aplica en una rama, se recalcula el golden del motor (`tests/golden/motor_golden.json`) y se versiona como «método Foodsume 2026.2».

**Regla de lectura de todo el método (no cambia):** en los 6 criterios, 1 es lo más cercano o listo y 9 lo más lejano o incierto. Con esa regla se revisan los puntos 1 y 2.

## 1. Proyectos de referencia con calificaciones que contradicen el caso (prioridad alta)
Los 8 fijos son la referencia de toda la conversación. Tres quedan en un lugar que un directivo cuestiona en el primer minuto.

| Proyecto | Hoy (alistamiento, cliente, regulación, capacidades, core, inversión) | Dónde queda | Qué no cuadra con el caso | Propuesta (a decidir) |
|---|---|---|---|---|
| CRYPTO TRADE (fintech, B2B) | 1, 3, 1, 1, 1, 1 | Eje X 1,42 · Eje Y 1,0: en H1, como si fuera el core | Una fintech de criptomonedas no es el core de una empresa de alimentos; el caso no dice que tenga producto listo, capacidades ni mercado sin regular | Recalificar con la regla 1 cerca, 9 lejos. Por ejemplo: alistamiento 5, cliente 7, regulación 9, capacidades 9, core 9, inversión 7 |
| YUMMI (conservas de frutas) | 7, 7, 9, 9, 7, 5 | Eje X 8,22: el más lejos del mercado | El caso dice que Foodsume procesa frutas y tiene 11 laboratorios: capacidades 9 («no tenemos ningún recurso») no cuadra | Capacidades 2 o 3; revisar regulación 9 (conservas de alimentos) |
| NUTREPET (nutrición animal, B2C) | 3, 1, 7, 5, 1, 7 | Eje Y 2,8: muy cerca del core | El caso dice que Foodsume no tiene ningún negocio B2C: alineación 1 («totalmente alineado») no cuadra | Core 6 o 7; cliente 1 («validado») también parece alto para un B2C nuevo |
| BIOSKIN (cosmética, B2C) | 7, 7, 2, 3, 8, 1 | | Regulación 2 para cosmética es baja (registro sanitario) | Regulación 5 o 6 |
| DEHIDRA (deshidratados) | 7, 1, 1, 9, 3, 7 | | Capacidades 9 para una empresa de alimentos procesados | Capacidades 3 a 5 |

## 2. Rúbrica «Inversión requerida para probar» con rangos que se solapan (prioridad alta)
Hoy:
- 1: Inversión baja, operable con presupuesto de caja (0 a 12 meses) (USD 10k - 50k)
- 3: Inversión media-baja, corto plazo (0,5 a 1,5 años) (USD 50k - 300k)
- 5: Inversión moderada, mediano plazo (1 a 3 años) (USD 100k - 300k)
- 7: Inversión alta, mediano/largo plazo (1 a 3 años), puede requerir apalancamiento externo o presupuestos compartidos (USD 300k - 1MM)
- 9: Inversión muy alta, largo plazo (+3 años), requiere apalancamiento externo (> USD 1MM)

Problema: una prueba de USD 200k cabe en 3 y en 5; los niveles 5 y 7 tienen el mismo plazo; 1 y 3 se cruzan en el plazo. La escala deja de distinguir justo en el criterio que es la trampa de INSUMEX (USD 3M el proyecto completo frente a 60 millones de pesos la prueba).

Propuesta:
- 1: Inversión baja, con presupuesto de caja, hasta 6 meses (USD 10k a 50k)
- 3: Inversión media-baja, de 6 a 12 meses (USD 50k a 100k)
- 5: Inversión moderada, de 1 a 2 años (USD 100k a 300k)
- 7: Inversión alta, de 2 a 3 años, puede requerir apalancamiento externo o presupuestos compartidos (USD 300k a 1 millón)
- 9: Inversión muy alta, más de 3 años, requiere apalancamiento externo (más de USD 1 millón)

## 3. Nombres de los ejes (prioridad alta)
Hoy: X «TIME 2 MARKET (Capacidades + Recursos + Barreras de Entrada)» y Y «VALUE GENERATION CAPACITY (Core business alignment)».

Problemas: el eje Y se lee como «más arriba, más valor y más alineado», y mide lo contrario (más arriba es más lejos del core y más inversión). Se mezclan inglés y español, el subtítulo de X no nombra alistamiento técnico ni conocimiento del cliente, y van en mayúsculas sostenidas (la app ya las pinta en tipo oración).

Propuestas (elegir una):
- **A, español primero:** X «Tiempo al mercado» (subtítulo «Técnica, cliente, regulación y capacidades»); Y «Distancia del core» (subtítulo «Alineación e inversión para probar»).
- **B, conservar el inglés del método con subtítulo en español:** X «Time to Market» (subtítulo «Qué tan lejos está del mercado»); Y «Value Generation Capacity» (subtítulo «Qué tan lejos está del core»).

Mientras tanto la app ya muestra siempre la lectura «Eje X: qué tan lejos está del mercado. Eje Y: qué tan lejos está del core. 1 es cerca; 9, lejos.» y marca «cerca» y «lejos» en los extremos.

## 4. Los tres horizontes (prioridad media)
La app no clasifica proyectos por horizonte; solo los nombra. Para la leyenda del tablero y la landing se usa hoy, pendiente de su visto bueno: «H1 Core: mejorar el negocio de hoy · H2 Adyacente: extender el negocio · H3 Transformación: crear un negocio nuevo». ¿Es la formulación del método de Estratek?

## 5. Caso y textos (prioridad media)
- **Caso ficticio:** el caso nombra a Grupo Nutresa y Nestlé como dueños y a clientes reales (McDonald's, Alpina, Colombina, Grupo Éxito). La app ya muestra arriba del caso «Caso ficticio con fines académicos. Las empresas reales que se mencionan son contexto y no participan en él.». Pregunta: ¿se deja así o se cambian los nombres por ficticios? Si el cliente del taller es una de esas empresas, conviene una variante.
- **Mayúsculas de título a la inglesa** en nombres de criterio («Nivel de Alistamiento Técnico», «Alineación y Cercanía Estratégica con el Core»): propuesta en tipo oración («Nivel de alistamiento técnico»…). La app ya usa nombres cortos en las tablas.
- **Signo de interrogación:** «¿Desde el punto de vista técnico, qué tan lista…?» debe ser «Desde el punto de vista técnico, ¿qué tan lista…?».
- **Anglicismos** en rúbricas y hojas: early adopter (la pregunta ya dice «adoptantes tempranos»), stakeholders, gains/pains/jobs, data, testeo, NDA, cloud, «y/o». Propuesta: español en todo, con el término en inglés entre paréntesis solo la primera vez si es de la metodología.
- **Códigos «(Lejos/Cerca)»** en la rúbrica de alineación: no se entienden para el participante; propuesta: quitarlos del texto visible.
- **Nombres de perfiles** con géneros mezclados (Conocimiento del cliente, Regulación, Financiero, Técnica y Operaciones, Estratégica, Producción): la app ya los usa como «perfil {nombre}» para que concuerden. Opcional: sustantivos parejos (Cliente, Regulación, Finanzas, Técnica y operaciones, Estrategia, Producción).

## 6. Hojas en la ronda 2 (prioridad baja)
Hoy las 6 hojas se abren solas al empezar la ronda 2, lo que invita a leer en el celular en vez de conversar. Propuesta: que la guía del facilitador sugiera abrirlas después de la primera vuelta de conversación, o cambiar el valor por defecto de `revelar_hojas`.
