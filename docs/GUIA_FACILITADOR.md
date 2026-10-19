# Guía del facilitador · Taller Horizontes

Una página. Lo que tienes que hacer, en orden, para que el taller corra sin sustos. Si algo se cae, ve directo a `docs/PLAN_B.md`.

## El día antes
1. Entra a `/admin` del dominio del taller (hoy `https://horizontes.estratek.com.co/admin`; cuando Paola active `horizontes.com.co`, ese) con tu usuario. Crea la sala con la plantilla Foodsume y el número de mesas: una mesa por cada 6 personas, porque hay 6 perfiles por mesa (una mesa = una empresa). Si arriba del panel sale un aviso rojo «Los QR apuntan a…», para ahí: los QR llevarían a otro ambiente. Pide a Paola corregir `BASE_URL` (`docs/DESPLIEGUE.md` §5).
2. En **Configuración** elige el **país** de la sala (Colombia, Perú o Guatemala). Define la ley que cita el aviso de datos y la hora de los cierres programados.
3. Revisa la visibilidad. Por defecto **toda la sala ve el resultado consolidado apenas vota** (tablero en vivo con alcance de sala). Si quieres que cada mesa discuta solo su matriz, cambia a "Cada mesa ve su resultado". Lo puedes cambiar en vivo.
4. En **Mesas y QR** imprime la hoja A4 (cuatro mesas por hoja, con código y enlace). Deja cada QR en el centro de su mesa. No lo proyectes: así cada persona entra a su mesa.
5. Si quieres que la sala abra o cierre sola, en **Configuración → Apertura y cierre programados** pon la hora de cada etapa: **Sala** (abrir inscripción, cerrar la sala), **Ronda 1** y **Ronda 2** (abrir, cerrar). Va en la hora del país de la sala y ves la hora del servidor al lado. Cada hora debe quedar después de la anterior; si no, el panel te dice cuál choca. Los botones de **Sala en vivo** siguen funcionando: si abres o cierras a mano, lo programado para ese paso se descarta.
6. Elige cómo pasan las preguntas en el celular (**Configuración → Preguntas en el celular**): **Automático** (cada quien avanza solo, una pregunta por pantalla) o **Guiado** (todos ven la misma pregunta y tú la cambias desde **Sala en vivo**).
7. Si los rangos de alguna rúbrica cambiaron (por ejemplo, los montos de inversión), ajústalos en **Configuración → Rúbricas** antes de que alguien vote: después del primer voto quedan bloqueadas. La casilla *Usar también en las salas nuevas* los deja para las próximas salas. Si usas plan B, regenera la papeleta (`docs/PLAN_B.md`).
8. Ensayo de 5 minutos: en **Salas** usa *Duplicar para ensayo*, escanea un QR de la copia, inscríbete, vota y mira el tablero. La sala real queda limpia.

## En el salón
- Proyector: abre el tablero desde **Sala en vivo** (*Abrir tablero de la sala*, ya trae su token). El público ve solo la matriz. Tecla **F** para pantalla completa; **1**, **2** y **C** cambian entre ronda 1, ronda 2 y comparación.
- Datos: un clic en la matriz, el botón *Ver datos* o la tecla **M** muestran el panel con el progreso y los promedios; otro clic o **M** vuelven a la matriz sola, y **Esc** vuelve a los datos. **D** abre *Cómo votó* (dispersión) y alterna con *Promedios*.
- Zoom: **+** y **−** acercan y alejan, **0** vuelve a ver toda la matriz y las flechas la mueven. También con los botones bajo la matriz, la rueda del mouse, el pellizco o arrastrando.
- Modo guiado: mientras la ronda está abierta, el tablero muestra en grande la pregunta que elijas en **Sala en vivo** en lugar de la matriz. Quita la pregunta o cierra la ronda para volver a la matriz.
- Wi-Fi: confirma que el celular de alguien de la sala abre el QR antes de empezar.

## Durante el taller
| Momento | Qué haces en el panel | Qué pasa en la sala |
|---|---|---|
| Llegada | *Abrir inscripción* | Nombre, correo y autorización de datos. Cada quien recibe su perfil |
| Lectura | Nada. Dales 10 a 15 min | Caso Foodsume y su hoja de perfil |
| Ronda 1 | *Abrir ronda 1* | **Individual y en silencio.** Cada quien califica INSUMEX y NUTRIWHAT en 6 criterios (1, 3, 5, 7, 9) solo con la información de su perfil. Nadie comenta todavía |
| Todos votaron | Te sale "Todos votaron en Mesa X". Nada se cierra solo | Resultado preliminar |
| Cierre R1 | *Cerrar ronda 1* | Matriz y tabla de la ronda 1 en **verde (R1)** |
| Ronda 2 | *Abrir ronda 2*: se abren las 6 hojas para todos | **Con discusión en la mesa.** Leen las hojas de los otros perfiles, conversan y vuelven a calificar |
| Cierre R2 | *Cerrar ronda 2* y pon el tablero en **Comparación** | El movimiento de **R1 (verde, hueco)** a **R2 (rojo, sólido)** |
| Final | *Cerrar sala* | "El taller terminó" |

**Modo guiado.** Con una ronda abierta, **Sala en vivo** muestra **Pregunta en pantalla**: *Siguiente* y *Anterior* recorren INSUMEX y luego NUTRIWHAT, criterio por criterio (12 preguntas). Con la lista de proyecto y pregunta saltas a cualquiera y la muestras con *Mostrar esta pregunta*. Al cerrar la ronda o cambiar de modo, la pregunta se borra y la ronda siguiente empieza de cero. El panel no sabe cuántos respondieron cada pregunta: el voto llega completo al terminar el proyecto.

**Respuestas por persona.** La sección **Respuestas** muestra qué calificó cada persona en cada ronda y proyecto, con filtros por mesa y ronda. Igual que **Participantes**, es solo para administradores: **no la proyectes**. Los tableros y los celulares solo muestran promedios anónimos.

**Cómo leer los resultados.** La tabla trae el promedio de los 6 criterios (sin fila Total desde la preentrega del 19-oct). La matriz sigue ubicando cada proyecto con sus dos ejes. Con **menos de 3 votos** en una mesa o ronda no se muestran promedios ("Hace falta al menos 3 votos..."): así nadie deduce el voto de otro.

La conversación buena está en la dispersión, y para eso está **Cómo votó la sala** (tecla **D** en el tablero, solo para ti, o el bloque del mismo nombre en **Sala en vivo**): cuántos votos tuvo cada valor 1, 3, 5, 7 y 9 en cada criterio, R1 en verde hueco y R2 en rojo sólido. La matriz sigue a la vista.

Cuándo usarlo en la plenaria:
- **Al cerrar la ronda 1**, después de mirar la matriz: busca el criterio con votos en los dos extremos (1 y 9) y pregunta qué sabía cada perfil que los demás no. Si quieres ver la información de un perfil, ábrela en **Hojas** del panel (las 6 hojas de cada proyecto, aunque los celulares todavía no las muestren).
- **Al cerrar la ronda 2**, en Comparación: muestra si la mesa se juntó (los votos se agrupan en uno o dos valores) o si sigue partida, y qué cambió entre el verde y el rojo.
- Con alcance de una mesa, cada empresa ve su propia dispersión. Con menos de 3 votos no aparece ("Hace falta al menos 3 votos..."): nadie deduce el voto de otro.

## Si algo pasa
- **Alguien cambió de celular o borró la sesión:** que vuelva a escanear el QR y use *Ya me inscribí: recuperar mi sesión* con el mismo correo. Conserva su mesa, perfil y votos.
- **Se quedó sin señal al votar:** el voto queda guardado en el celular y se envía solo cuando vuelve la señal.
- **Persona en la mesa equivocada o perfil repetido:** **Participantes** → cambia mesa o perfil.
- **Alguien se fue:** **Participantes** → desactivar. Sus votos dejan de contar y la mesa puede llegar al precierre.
- **Cerraste una ronda antes de tiempo:** *Reabrir ronda*. Los votos siguen ahí.
- **El tablero no se mueve:** recarga la página. Se actualiza cada 2,5 s.
- **Otro admin entra y el menú lo lleva a «Elige una sala»:** es la primera vez que abre una sala en ese navegador. Que elija la sala en esa misma pantalla; el panel la recuerda. Un admin ve todo lo de la sala igual que Paola, salvo **Administradores**.
- **La app no carga para nadie:** plan B (`docs/PLAN_B.md`). No pierdas más de 3 minutos intentando.

## Después
- **Exportar**: `inscritos.csv` y `votos.csv`. Son el registro interno: quién se inscribió y cuándo, mesa, perfil, consentimiento, país e IP. Ábrelos en Excel y guárdalos solo donde lo permita la política de datos de Estratek.
- El tablero, los celulares y el proyector nunca muestran nombres ni votos individuales.
- La sala guarda un respaldo automático de la base al abrirla, antes de cada reinicio y al cerrarla.
