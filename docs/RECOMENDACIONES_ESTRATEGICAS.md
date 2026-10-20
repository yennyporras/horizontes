# Recomendaciones estratégicas del QA por roles (20-oct-2026)

Lo que no es código de esta versión y decide Estratek (Paola y Sebastián). Sale del QA de ocho roles: Sebastián (CEO), Nicolai (facilitador), Paula (comunicaciones), Paola (CTO), una empresa cliente, un participante, un jurado de hackatón internacional y un inversionista de etapa temprana. Lo que sí era de producto se corrigió en la versión que acompaña este documento (ver `CHANGELOG.md`).

## Notas de los roles antes de las correcciones
| Rol | Nota | En una frase |
|---|---|---|
| Sebastián, CEO | 7 | Fiel al método; me apenarían los fijos mal calificados y un eje que se lee al revés |
| Nicolai, facilitador | 6,5 | La gráfica luce; la revelación R1→R2 tiene que dispararla yo |
| Paula, comunicaciones | 7 | Buena voz y marca; falta unificar nombres y quitar jerga del proyector |
| Paola, CTO | 6,5 | Servidor sólido; el aviso de datos y el runbook no decían la verdad |
| Empresa cliente | 6,5 | Seria en la sala; faltan un entregable para la junta y un aviso de datos completo |
| Participante | 6 | Robusto; sin la explicación de la escala votaría al revés |
| Jurado de hackatón | 7,1 | Ejecución de finalista; la demo necesita un número y no depender de celulares |
| Inversionista | 5 | Equipo que ejecuta; herramienta de un taller, sin métricas ni costura de plataforma |

## Prioridad 1: antes del próximo taller con cliente
1. **Sesión de una hora con Sebastián** sobre `docs/PROPUESTA_SEMILLA.md`: proyectos de referencia, rúbrica de inversión, nombres de los ejes, horizontes y caso ficticio. Después, congelar «método Foodsume 2026.2» con fecha.
2. **Supresión de datos y vencimiento de respaldos (B-5 del backlog).** El aviso promete suprimir en 10 días hábiles y hoy exige SQL a mano. Hace falta una ruta de admin para suprimir a una persona, que los respaldos de una sala cerrada venzan a los N días y una copia de respaldo fuera del VPS. Con eso el aviso puede decir cuánto tiempo se guardan los datos.
3. **Ficha de datos de una página para compras y jurídica del cliente:** qué datos, para qué, dónde se alojan (Hostinger, país), cuánto tiempo, quién los ve, cómo se borran y el contrato de encargado. Y una política escrita: el cliente recibe solo agregados (`resultados.csv`, la matriz), nunca inscritos ni votos individuales.
4. **Prueba con 3 directivos reales**, 10 minutos y sin explicarles nada, para confirmar que leen bien la escala (1 cerca, 9 lejos). Es el mayor riesgo para la calidad del dato.
5. **Ensayo en un proyector real de 1280×720 a 6 metros**, con la hoja de teclas impresa para el atril, y prueba de la red del cliente 48 horas antes (wifi corporativo y firewall).

## Prioridad 2: producto (v2)
1. **El portafolio propio del cliente.** Coinciden el CEO, la empresa, el jurado y el inversionista: Foodsume es la demo; lo que se vende es «el comité prioriza su propio portafolio». Requiere pasar los criterios a datos (hoy son columnas fijas en `votos`) y plantillas distintas de `foodsume_2026`.
2. **El índice de convergencia como métrica estrella.** Ya se calcula («la discusión redujo la dispersión un N %»). Acumularlo por taller da el argumento comercial y el contenido para columnas y LinkedIn.
3. **Control remoto del proyector desde el panel** (el facilitador elige la vista en su laptop y el tablero obedece) y guion de escenas para el control de presentaciones.
4. **Inglés y portugués** con el mismo motor, para España, Brasil y salas internacionales. Antes, decidir el marco legal: hoy solo hay avisos para Colombia, Perú y Guatemala (una sala en España necesitaría RGPD).
5. **Modo conferencia** para más de 100 personas sin mesas fijas, con la misma regla de anonimato: es la vitrina comercial de Estratek.
6. **Informe ejecutivo para el patrocinador** (como servicio primero, en 48 horas desde `resultados.csv`; en la app después).
7. **Pulso de satisfacción (NPS)** anónimo al cerrar la ronda 2, para medir.

## Prioridad 3: plataforma y negocio
1. **Instrumentar y mostrar tres meses de datos** antes de una ronda: talleres al mes (sin ensayos), personas por taller, completitud de la ronda 2, minutos a resultado, reducción media de la dispersión, NPS, clientes que repiten y margen por taller. La versión actual ya separa talleres de ensayos y mide los cuatro primeros.
2. **Posicionamiento:** «la capa de alineación del comité de innovación». Mentimeter y Slido votan pero no tienen motor ni información repartida por perfil; Miro y Mural tienen la plantilla pero no calculan ni garantizan anonimato; ITONICS, Planview y HYPE gestionan el pipeline continuo, son caros y no resuelven la alineación del comité. Horizontes exporta hacia ellos en lugar de competir.
3. **Romper la dependencia del facilitador presencial:** kit para facilitadores certificados (aliados, cámaras de comercio) con licencia por taller, y medir qué porcentaje se hace sin personal de Estratek.
4. **Base común de plataforma antes de la segunda herramienta:** organización y multiempresa, identidad y roles por herramienta y por sala (hoy todo admin ve todas las salas), tokens de diseño, cliente HTTP y polling compartidos, módulo de consentimiento por país, contrato tipado con OpenAPI. Decidir Postgres frente a SQLite junto con IRMI (A12).
5. **Consentimiento para datos agregados:** el aviso actual autoriza «fines informativos de este taller». Para benchmarks entre talleres o por industria hace falta una cláusula de uso anónimo y agregado, con asesoría legal.
6. **Disciplina de operación:** SLO del día de taller (p95 menor a 500 ms con 100 celulares en el VPS, RTO de 3 minutos ligado al plan B), alerta de salud al celular de Paola los días de taller, Dependabot y una segunda persona que revise los PR a `main`.

## Comunicación y marca
1. **Glosario único de producto** para todas las herramientas (sala, mesa, hoja de perfil, calificación, ronda 1 o R1, Gráfica, Detallado, Sala en vivo, «Dar acceso de nuevo»), con una prueba que busque términos prohibidos.
2. **Decidir la arquitectura de nombre:** Horizontes es la herramienta y «Portafolio por Horizontes» el taller. La app ya lo escribe así.
3. **Kit para redes del taller:** imagen para compartir (ya está), un modo foto del tablero con el nombre del cliente y un clip de 10 segundos del movimiento R1→R2.
4. **Revisión editorial de la semilla** con comunicaciones después de la sesión con Sebastián (punto 5 de la propuesta).
