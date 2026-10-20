# Guía del facilitador · Taller Horizontes

Una página. Lo que tienes que hacer, en orden, para que el taller corra sin sustos. Si algo se cae, ve directo a `docs/PLAN_B.md`.

## El día antes
1. Entra a `/admin` del dominio del taller (hoy `https://horizontes.estratek.com.co/admin`; cuando Paola active `horizontes.com.co`, ese) con tu usuario. Crea la sala con la plantilla Foodsume y el número de mesas: una mesa por cada 6 personas, porque hay 6 perfiles por mesa (una mesa = una empresa). Si arriba del panel sale un aviso rojo «Los QR apuntan a…», para ahí: los QR llevarían a otro ambiente. Pide a Paola corregir `BASE_URL` (`docs/DESPLIEGUE.md` §5). Tu clave la cambias cuando quieras en *Cambiar mi clave*, arriba a la derecha.
2. En **Configuración** elige primero el **país** de la sala (Colombia, Perú o Guatemala). Define la ley que cita el aviso de datos y la hora de los cierres programados. Si cambias el país después de programar horas, las horas siguen en el mismo reloj en la zona nueva (23:39 sigue siendo 23:39, ahora de Guatemala) y el panel te lo dice junto al país. Si la zona horaria no es la del país, el panel lo advierte.
3. Revisa la visibilidad. Por defecto **toda la sala ve el resultado consolidado apenas vota** (*Resultado en vivo*, con alcance de sala). Ese resultado se renueva cada 3 votos nuevos, así nadie deduce el voto de otro; al cerrar la ronda queda el exacto. Si quieres que cada mesa discuta solo su matriz, cambia a *Cada mesa ve su resultado*. Lo puedes cambiar en vivo. El aviso de cada cambio sale junto a la opción que tocaste.
4. En **Mesas y QR** pulsa *Imprimir hoja de QR* (cuatro mesas por hoja A4, cada una con «Escanea para entrar», su código y su enlace). Deja cada QR en el centro de su mesa. No lo proyectes: así cada persona entra a su mesa. *Agregar mesas* está al final, solo para cuando llega más gente de la esperada.
5. Si quieres que la sala abra o cierre sola, en **Configuración → Apertura y cierre programados** pon la hora de cada etapa: **Sala** (abrir inscripción, cerrar la sala), **Ronda 1** y **Ronda 2** (abrir, cerrar). Va en la hora del país de la sala y ves la hora del servidor al lado. Cada hora debe quedar después de la anterior; si no, el panel te dice cuál choca. Los botones de **Sala en vivo** siguen funcionando: si abres o cierras a mano, lo programado para ese paso se descarta.
6. Elige cómo pasan las preguntas en el celular (**Configuración → Preguntas en el celular**): **Automático** (cada quien avanza solo, una pregunta por pantalla) o **Guiado** (todos ven la misma pregunta y tú la cambias desde **Sala en vivo**).
7. Si los rangos de alguna rúbrica cambiaron (por ejemplo, los montos de inversión), ajústalos en **Configuración → Rúbricas** antes de que alguien vote: después del primer voto quedan bloqueadas. La casilla *Usar también en las salas nuevas* los deja para las próximas salas; *Quitar de las salas nuevas* devuelve la rúbrica original a las próximas salas sin tocar las que ya existen. Si sales de la sección o cambias de criterio sin guardar, el panel te pregunta antes de perder los cambios. Si usas plan B, regenera la papeleta (`docs/PLAN_B.md`).
8. Ensayo de 5 minutos: en **Salas** usa *Duplicar para ensayo*, escanea un QR de la copia, inscríbete, vota y mira el tablero. La sala real queda limpia. La copia se llama como la original con «(ensayo)» al final, una sola vez.

## En el salón
Todo lo que se ve en vivo está en un solo lugar: **Sala en vivo → Ver en vivo**. Cada enlace se abre en otra pestaña y se actualiza solo.
- **Proyector:** *Tablero de la sala*, en uno de sus dos modos según el evento (ya trae su clave; no compartas el enlace). *En vivo, solo la gráfica* muestra la matriz moviéndose; *Con tabla* suma el progreso y los promedios. Tecla **F** para pantalla completa; **V** y **T** cambian de modo; **1**, **2** y **C** cambian entre ronda 1, ronda 2 y comparación.
- **Una mesa:** elige la mesa y abre *Tablero de Mesa N*, para seguir su avance o proyectarla sola.
- **Lo que ve un celular:** elige la mesa y abre *Vista previa del celular*. Es solo para mirar: muestra la entrada a la mesa tal como la ve un participante, pero no inscribe a nadie ni cuenta en el avance.
- Modos del tablero (selector del encabezado; queda en el enlace como `modo=vivo` o `modo=tabla`):
  - **En vivo** (tecla **V**): solo la matriz, a todo el ancho. Las burbujas se deslizan cada vez que llega una actualización; con la ronda abierta el resultado se renueva cada 3 votos nuevos y al cerrarla queda exacto. Arriba, la sala, la ronda y cuántos ya votaron.
  - **Con tabla** (tecla **T**): la matriz y, al lado, el progreso y los promedios por criterio con una descripción corta de cada uno. **D** cambia los promedios por *Cómo votó* (dispersión) y vuelve.
  - **M** o un clic en la matriz alternan los dos modos; **Esc** pasa a *Con tabla*.
- **Pantalla completa** (botón o tecla **F**): el modo elegido llena la pantalla, sin los controles. **F**, **Esc** o el mismo botón salen. **1**, **2** y **C** cambian entre ronda 1, ronda 2 y comparación también ahí.
- Ya no hay zoom por porcentaje: para ver la matriz más grande, usa la pantalla completa.
- Modo guiado: mientras la ronda está abierta, el tablero muestra en grande la pregunta que elijas en **Sala en vivo** en lugar de la matriz. *Quitar la pregunta* o cerrar la ronda vuelven a la matriz.
- Wi-Fi: confirma que el celular de alguien de la sala abre el QR antes de empezar.

## Durante el taller
En **Sala en vivo → Control de la sala** hay un solo botón principal: el **paso que sigue**, con una línea de qué pasa al pulsarlo. Debajo, aparte, **Corregir** reúne solo lo que se puede deshacer en ese momento (*Reabrir ronda*, *Reiniciar votos de la ronda*, *Cerrar sala* antes de tiempo, *Reabrir sala*); lo que borra o cierra va en rojo y pide confirmación, con el foco en *Cancelar*.

| Momento | Paso que sigue en el panel | Qué pasa en la sala |
|---|---|---|
| Llegada | *Abrir inscripción* | Nombre, correo y autorización de datos. Cada quien recibe su perfil |
| Lectura | Nada. Dales 10 a 15 min | Caso Foodsume y su hoja de perfil |
| Ronda 1 | *Abrir ronda 1* | **Individual y en silencio.** Cada quien califica INSUMEX y NUTRIWHAT en 6 criterios (1, 3, 5, 7, 9) solo con la información de su perfil. Nadie comenta todavía |
| Todos votaron | Te sale «Todos votaron en Mesa X». Nada se cierra solo | Resultado preliminar, que se renueva cada 3 votos nuevos |
| Cierre R1 | *Cerrar ronda 1*. Si alguien no ha terminado, el panel te dice cuántas personas faltan y te pide confirmar | Matriz y tabla de la ronda 1 en **verde (R1)** |
| Ronda 2 | *Abrir ronda 2*: se abren las 6 hojas para todos | **Con discusión en la mesa.** Leen las hojas de los otros perfiles, conversan y vuelven a calificar |
| Cierre R2 | *Cerrar ronda 2* (igual: avisa si falta gente) y pon el tablero en **Comparación** (tecla **C**) | El movimiento de **R1 (verde, hueco)** a **R2 (rojo, sólido)** |
| Final | *Cerrar sala* y después *Descargar los datos* | «El taller terminó» |

**Modo guiado.** Con una ronda abierta, **Sala en vivo** muestra **Pregunta en pantalla** con el mismo número que el tablero: «Pregunta 3 de 6 · INSUMEX». *Siguiente* y *Anterior* recorren INSUMEX y luego NUTRIWHAT, criterio por criterio. Con la lista de proyecto y pregunta saltas a cualquiera y la muestras con *Mostrar esta pregunta*. *Quitar la pregunta* vuelve a mostrar la matriz en el tablero; los votos no cambian. Al cerrar la ronda o cambiar de modo, la pregunta se borra y la ronda siguiente empieza de cero. El panel no sabe cuántos respondieron cada pregunta: el voto llega completo al terminar el proyecto.

**Respuestas por persona.** La sección **Respuestas** muestra qué calificó cada persona en cada ronda y proyecto, con filtros por mesa, ronda y proyecto. Igual que **Participantes** y **Exportar**, es solo para administradores: **no la proyectes**. Los tableros y los celulares solo muestran promedios anónimos.

**Cómo leer los resultados.** La tabla trae el promedio de los 6 criterios (sin fila Total desde la preentrega del 19-oct). La matriz sigue ubicando cada proyecto con sus dos ejes. Con **menos de 3 votos** en una mesa o ronda no se muestran promedios («Hacen falta al menos 3 votos...»): así nadie deduce el voto de otro. Con la ronda abierta, el resultado es una foto que se renueva cada 3 votos nuevos; al cerrar la ronda queda el exacto.

La conversación buena está en la dispersión, y para eso está **Cómo votó la sala** (tecla **D** en el tablero, solo para ti, o el bloque del mismo nombre en **Sala en vivo**): cuántos votos tuvo cada valor 1, 3, 5, 7 y 9 en cada criterio, R1 en verde hueco y R2 en rojo sólido. La matriz sigue a la vista.

Cuándo usarlo en la plenaria:
- **Al cerrar la ronda 1**, después de mirar la matriz: busca el criterio con votos en los dos extremos (1 y 9) y pregunta qué sabía cada perfil que los demás no. Si quieres ver la información de un perfil, ábrela en **Hojas** del panel (las 6 hojas de cada proyecto, aunque los celulares todavía no las muestren).
- **Al cerrar la ronda 2**, en Comparación: muestra si la mesa se juntó (los votos se agrupan en uno o dos valores) o si sigue partida, y qué cambió entre el verde y el rojo.
- Con alcance de una mesa, cada empresa ve su propia dispersión. Con menos de 3 votos no aparece («Hacen falta al menos 3 votos...»): nadie deduce el voto de otro.

**Bitácora.** Al final de **Sala en vivo** está lo que pasó en la sala, lo más reciente arriba: quién se inscribió y en qué mesa, qué configuración cambió, qué se abrió o cerró (y si fue a la hora programada). Lo repetido va en una sola línea («12 veces»). *Ver los N eventos* muestra el resto.

## Si algo pasa
- **Alguien cambió de celular o borró la sesión:** en **Participantes**, *Dar acceso de nuevo* en su fila. Sale un QR grande y el enlace para copiar: que lo escanee con su celular. Entra a su mesa con su perfil y sus votos. El enlace sirve una sola vez y vence en 15 minutos (el panel dice a qué hora); si vence, *Generar otro enlace*. Al usarlo se cierra la sesión que tuviera en otro celular. Con el mismo correo ya no se recupera (protege a quien ya está inscrito). Con la sala cerrada ya no se puede.
- **Se quedó sin señal al votar:** el voto queda guardado en el celular y se envía solo cuando vuelve la señal.
- **Persona en la mesa equivocada o perfil repetido:** **Participantes** → cambia mesa o perfil. Si esa persona ya votó, el panel te pide confirmar: sus votos se mueven con ella y el avance de las dos mesas se recalcula.
- **Alguien se fue:** **Participantes** → *Desactivar*. Sus votos dejan de contar y la mesa puede llegar al precierre. Si ya votó, el panel te pide confirmar. Se deshace con *Activar*.
- **Cerraste una ronda antes de tiempo:** en **Corregir**, *Reabrir ronda*. Los votos siguen ahí.
- **El tablero no se mueve:** recarga la página. Se actualiza cada 2,5 s.
- **El panel te pide entrar de nuevo:** tu sesión terminó. Entra y sigues donde ibas. Si dice que se perdió la conexión, el panel reintenta solo cada 2,5 s.
- **Otro admin entra y el menú lo lleva a «Elige una sala»:** es la primera vez que abre una sala en ese navegador. Que elija la sala en esa misma pantalla; el panel la recuerda. Un admin ve todo lo de la sala igual que Paola, salvo **Administradores**. En el celular, el menú se abre con el botón *Menú*.
- **La app no carga para nadie:** plan B (`docs/PLAN_B.md`). No pierdas más de 3 minutos intentando. **Salud** te dice en palabras simples si el servidor responde («Todo bien», «Lento» o «No responde»).

## Después
- *Descargar los datos* lleva a **Exportar**: `inscritos.csv` y `votos.csv`. Son el registro interno: quién se inscribió y cuándo, mesa, perfil, consentimiento, país e IP. Ábrelos en Excel y guárdalos solo donde lo permita la política de datos de Estratek.
- El tablero, los celulares y el proyector nunca muestran nombres ni votos individuales.
- La sala guarda un respaldo automático de la base al abrirla, antes de cada reinicio y al cerrarla.
