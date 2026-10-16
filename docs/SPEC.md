# SPEC v1 · Taller Horizontes

Estado: cerrado para construir (decisiones de Paola del 16-oct-2026 + supuestos aceptados).

## 1. Conceptos
- **Sala**: un taller en vivo (evento). Tiene mesas, rondas, configuración y un código corto (ej. `HZ7K2`).
- **Mesa**: subgrupo de la sala que funciona como "una empresa". Cada mesa tiene su QR/código (`HZ7K2-1`).
- **Participante**: persona inscrita en una mesa con nombre, correo y consentimiento. Recibe un **perfil** (hoja de información).
- **Perfil**: uno de 6: Conocimiento del cliente, Regulación, Financiero, Técnica y Operaciones, Estratégica, Producción.
- **Proyecto**: 10 por sala. 8 **fijos** (calificación precargada, no se votan) y 2 **vivos** (INSUMEX, NUTRIWHAT).
- **Ronda**: 1 o 2. Cada participante vota los 2 vivos en cada ronda.

## 2. Flujo del participante (todo en la app, celular)
1. Escanea el QR de su mesa → `/m/{codigoMesa}`.
2. **Inscripción**: nombre, correo y autorización de tratamiento de datos (componente de consentimiento del IRMI, con la Política de Tratamiento de Datos Personales de Estratek (enlace en `POLITICA_PRIVACIDAD_URL`)). Sin aceptación no avanza. Finalidad: fines informativos.
3. El sistema le **asigna perfil** automáticamente, balanceado dentro de la mesa (el perfil con menos personas; empate → orden del catálogo). El admin puede reasignar.
4. **Lectura**: pestaña "Caso" (descripción, situación, tabla de 10 proyectos) y pestaña "Tu hoja" (información de su perfil para INSUMEX y NUTRIWHAT). En la ronda 2 ve las 6 hojas (al abrir la ronda 2, `revelar_hojas` pasa a true automáticamente; el admin puede apagarlo o encenderlo en cualquier momento).
5. **Votación** (solo con ronda abierta): elige proyecto, responde las 6 preguntas con la rúbrica visible (1-3-5-7-9, las 6 obligatorias), guarda. Repite con el otro proyecto. Puede editar mientras la ronda siga abierta.
6. **Después de votar** los 2 proyectos, según `vista_participante`:
   - `registrado`: pantalla "Voto registrado" + progreso de su mesa (X de Y completaron) hasta que el admin cierre la ronda.
   - `en_vivo`: ve el tablero en vivo según `alcance_resultados`.
7. **Ronda cerrada**: ve el resultado según `alcance_resultados` (su mesa o toda la sala), incluida la comparación R1→R2 cuando aplica.
8. Persistencia: token en el dispositivo. Si recarga o pierde señal, vuelve a donde iba.

## 3. Máquina de estados de la sala
`preparada → inscripcion → r1_abierta → r1_cerrada → r2_abierta → r2_cerrada → cerrada`
- Solo el admin abre y cierra rondas. Abrir R2 exige R1 cerrada.
- Inscripción permitida en `inscripcion`, `r1_abierta`, `r1_cerrada`, `r2_abierta`. No en `cerrada`.
- Votos solo en `r1_abierta` (ronda 1) y `r2_abierta` (ronda 2).
- El admin puede reabrir la ronda actual y reiniciar votos de una ronda (para ensayos). Todo queda en `eventos`.

## 4. Precierre automático
- Participante **completo** en la ronda = tiene voto guardado para los 2 vivos en esa ronda.
- **Precierre de mesa**: `inscritos_activos > 0` y `completos == inscritos_activos`.
- **Precierre de sala**: todas las mesas con inscritos están en precierre.
- Es un estado derivado: **solo avisa y muestra el resultado, nunca cierra la ronda**. Los votos se pueden editar hasta que el admin cierre.
- Al entrar en precierre, el resultado de esa ronda se hace visible automáticamente (en su alcance: la mesa en precierre ve su resultado; con `alcance_resultados = sala`, se ve cuando la sala completa está en precierre), aunque `vista_participante` sea `registrado`. Se marca como "Resultado preliminar" hasta el cierre.
- Aviso al admin ("Todos votaron en Mesa 2. Puedes cerrar la ronda"), en el tablero y en la pantalla del participante.
- Si alguien se inscribe o edita después, el precierre se recalcula (puede desaparecer).

## 5. Cierres programados
- `cierre_programado_ronda_at`: cierra la ronda abierta a esa hora.
- `cierre_programado_sala_at`: pasa la sala a `cerrada` a esa hora.
- El servidor los aplica al recibir cualquier petición (chequeo perezoso) y con un intervalo de 15 s si el stack lo permite. Ambos quedan en `eventos` con `por: "programado"`.

## 6. Visibilidad (la decide el admin, por sala, cambiable en vivo)
- `alcance_resultados`: `mesa` (cada mesa ve solo lo suyo) | `sala` (todos ven el agregado de la sala). El admin y el tablero pueden ver cualquier alcance.
- `vista_participante`: `registrado` | `en_vivo`.
- `revelar_hojas`: false en la ronda 1; se enciende solo al abrir la ronda 2; editable por el admin.

## 7. Cálculo
- Por alcance (mesa o sala) y ronda: promedio simple de cada criterio sobre los votos de participantes activos del alcance; luego el motor (ver `CLAUDE.md`).
- Además se entrega por criterio la **distribución** (conteo de 1, 3, 5, 7, 9) y `n_votos`, para la discusión. Nunca respuestas individuales ni nombres.
- Si un alcance no tiene votos en una ronda, el punto no se dibuja (`null`).
- Fijos: se calculan una vez desde `inputs` de la semilla. TAM: fijos según semilla; vivos 5 y 6.

## 8. Tablero (proyector y vista en vivo)
- Matriz 0 a 9,5 en ambos ejes, títulos de ejes de la semilla, curvas H1/H2 de fondo (cuartos de círculo radio 4,5 y 9), etiquetas H1, H2, H3.
- 8 fijos en gris azulado con nombre. 2 vivos con color propio: R1 en tono suave, R2 sólido, flecha R1→R2.
- Panel lateral: por criterio, promedio R1, R2 y distribución (mini barras 1-3-5-7-9).
- Progreso: inscritos, completos, precierre por mesa.
- Selector de alcance (sala o mesa X) visible solo en modo proyector/admin.
- Polling 2,5 s. Debe leerse a 6 metros: tipografía grande en proyector.

## 9. Panel admin
- Login con contraseña con hash. Dos roles: **superadmin** (Paola, creada desde `.env` al desplegar) y **admin**.
- **Gestión de administradores** (solo superadmin): crear admin (usuario, nombre, correo, clave temporal), desactivar, restablecer clave. Un admin no puede crear ni editar admins. Los participantes nunca son admins: son tablas y sesiones separadas, sin ruta para promoverlos.
- Crear sala desde plantilla Foodsume (carga proyectos, criterios, caso y hojas de `data/seed_foodsume.json`).
- Crear N mesas → códigos, URLs y QR imprimibles/proyectables.
- Controles: abrir inscripción, abrir/cerrar R1 y R2, reabrir, reiniciar ronda, cerrar sala.
- Configuración: alcance, vista participante, revelar hojas, cierres programados.
- Participantes: lista por mesa con perfil (editable: reasignar perfil o mesa), estado de la ronda (completo o no, nunca sus respuestas), reasignar perfil/mesa, desactivar.
- Export CSV: inscritos (nombre, correo, mesa, perfil, consentimiento) y votos anonimizados (id hash, mesa, perfil, ronda, proyecto, 6 valores).
- Enlace al tablero de la sala y de cada mesa.

## 10. Fuera de alcance v1
Modo cliente multiempresa, carga de portafolios propios, fórmula TAM normalizada, análisis por perfil en pantalla, PDF, white-label, envío de correos.

## 11. Criterios de aceptación del taller
1. 40 celulares inscritos en 4 mesas, votando 2 rondas, con polling activo, sin errores y con respuesta < 500 ms p95.
2. Los puntos de la sala coinciden con el cálculo independiente del simulador (golden).
3. Precierre aparece solo cuando todos los inscritos activos completan, muestra el resultado preliminar y no cierra la ronda.
4. Un cierre programado cierra la ronda a la hora exacta (± 15 s).
5. Cambiar `alcance_resultados` o `vista_participante` se refleja en los celulares en < 5 s.
6. Sin consentimiento no hay inscripción; el consentimiento queda guardado con versión y enlace de la política de Estratek.
7. Un admin normal no puede ver ni usar la gestión de administradores (403); solo el superadmin.
