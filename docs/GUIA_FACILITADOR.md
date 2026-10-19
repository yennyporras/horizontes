# Guía del facilitador · Taller Horizontes

Una página. Lo que tienes que hacer, en orden, para que el taller corra sin sustos. Si algo se cae, ve directo a `docs/PLAN_B.md`.

## El día antes
1. Entra a `/admin` del dominio del taller (hoy `https://horizontes.estratek.com.co/admin`; cuando Paola active `horizontes.com.co`, ese) con tu usuario. Crea la sala con la plantilla Foodsume y el número de mesas (una mesa = una empresa, 5 a 8 personas).
2. En **Configuración** elige el **país** de la sala (Colombia, Perú o Guatemala). Define la ley que cita el aviso de datos y la hora de los cierres programados.
3. Revisa la visibilidad. Por defecto **toda la sala ve el resultado consolidado apenas vota** (tablero en vivo con alcance de sala). Si quieres que cada mesa discuta solo su matriz, cambia a "Cada mesa ve su resultado". Lo puedes cambiar en vivo.
4. En **Mesas y QR** imprime la hoja A4 (cuatro mesas por hoja, con código y enlace). Deja cada QR en el centro de su mesa.
5. Ensayo de 5 minutos: en **Salas** usa *Duplicar para ensayo*, escanea un QR de la copia, inscríbete, vota y mira el tablero. La sala real queda limpia.

## En el salón
- Proyector: abre el tablero desde **Sala en vivo** (*Abrir tablero de la sala*, ya trae su token). Tecla **F** para pantalla completa; **1**, **2** y **C** cambian entre ronda 1, ronda 2 y comparación.
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

**Cómo leer los resultados.** La tabla trae los 6 criterios y una fila **Total** (eje X + eje Y). La matriz sigue ubicando cada proyecto con sus dos ejes. Con **menos de 3 votos** en una mesa o ronda no se muestran promedios ("Hace falta al menos 3 votos..."): así nadie deduce el voto de otro.

La conversación buena está en la dispersión: si una mesa tiene votos en 1 y en 9 para el mismo criterio, ahí hay carnita. Pregunta qué sabía cada perfil que los demás no, y qué cambió entre el verde y el rojo.

## Si algo pasa
- **Alguien cambió de celular o borró la sesión:** que vuelva a escanear el QR y use *Ya me inscribí: recuperar mi sesión* con el mismo correo. Conserva su mesa, perfil y votos.
- **Se quedó sin señal al votar:** el voto queda guardado en el celular y se envía solo cuando vuelve la señal.
- **Persona en la mesa equivocada o perfil repetido:** **Participantes** → cambia mesa o perfil.
- **Alguien se fue:** **Participantes** → desactivar. Sus votos dejan de contar y la mesa puede llegar al precierre.
- **Cerraste una ronda antes de tiempo:** *Reabrir ronda*. Los votos siguen ahí.
- **El tablero no se mueve:** recarga la página. Se actualiza cada 2,5 s.
- **La app no carga para nadie:** plan B (`docs/PLAN_B.md`). No pierdas más de 3 minutos intentando.

## Después
- **Exportar**: `inscritos.csv` y `votos.csv`. Son el registro interno: quién se inscribió y cuándo, mesa, perfil, consentimiento, país e IP. Ábrelos en Excel y guárdalos solo donde lo permita la política de datos de Estratek.
- El tablero, los celulares y el proyector nunca muestran nombres ni votos individuales.
- La sala guarda un respaldo automático de la base al abrirla, antes de cada reinicio y al cerrarla.
