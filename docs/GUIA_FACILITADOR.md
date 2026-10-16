# Guía del facilitador · Taller Horizontes

Una página. Lo que tienes que hacer, en orden, para que el taller corra sin sustos. Si algo se cae, ve directo a `docs/PLAN_B.md`.

## El día antes
1. Entra a `https://horizontes.estratek.com.co/admin` con tu usuario. Crea la sala con la plantilla Foodsume y el número de mesas (una mesa = una empresa, 5 a 8 personas).
2. En **Mesas y QR** imprime la hoja A4 (cuatro mesas por hoja, con código y enlace). Recorta y deja cada QR en el centro de su mesa.
3. En **Configuración** decide dos cosas: ¿cada mesa ve su resultado o el de toda la sala? (`alcance`) y ¿la gente ve el tablero en vivo apenas vota o solo "Voto registrado"? (`vista`). Lo puedes cambiar en vivo.
4. Ensayo de 5 minutos: con tu celular escanea un QR, inscríbete, vota, mira el tablero. Luego en **Sala en vivo** usa *Reiniciar votos de la ronda* y desactiva tu participante.

## En el salón
- Proyector: abre el enlace del tablero desde **Sala en vivo** (trae su token). Tecla **F** para pantalla completa, **1**, **2** y **C** cambian entre ronda 1, ronda 2 y comparación.
- Wi-Fi: confirma que el celular de alguien de la sala abre el QR antes de empezar.

## Durante el taller
| Momento | Qué haces en el panel | Qué ve la gente |
|---|---|---|
| Llegada | *Abrir inscripción* | Nombre, correo y autorización de datos. Cada quien recibe su perfil |
| Lectura | Nada. Dales 10 a 15 min | Caso Foodsume y su hoja de perfil |
| Ronda 1 | *Abrir ronda 1* | Califican INSUMEX y NUTRIWHAT en 6 criterios (1, 3, 5, 7, 9) |
| Todos votaron | Te sale "Todos votaron en Mesa X". Nada se cierra solo | Resultado preliminar de su mesa |
| Cierre R1 | *Cerrar ronda 1* y discute la matriz y la dispersión por criterio | Resultado de la ronda 1 |
| Ronda 2 | *Abrir ronda 2*: se abren las 6 hojas para todos | Leen las hojas de los demás perfiles y vuelven a calificar |
| Cierre R2 | *Cerrar ronda 2* y pon el tablero en **Comparación** | El movimiento de R1 a R2 |
| Final | *Cerrar sala* | "El taller terminó" |

La conversación buena está en la dispersión: si una mesa tiene votos en 1 y en 9 para el mismo criterio, ahí hay carnita. Pregunta qué sabía cada perfil que los demás no.

## Si algo pasa
- **Alguien cambió de celular o borró la sesión:** que vuelva a escanear el QR y use *Ya me inscribí: recuperar mi sesión* con el mismo correo. Conserva su mesa, perfil y votos.
- **Se quedó sin señal al votar:** el voto queda guardado en el celular y se envía solo cuando vuelve la señal.
- **Persona en la mesa equivocada o perfil repetido:** **Participantes** → cambia mesa o perfil.
- **Alguien se fue:** **Participantes** → desactivar. Sus votos dejan de contar y la mesa puede llegar al precierre.
- **Cerraste una ronda antes de tiempo:** *Reabrir ronda*. Los votos siguen ahí.
- **El tablero no se mueve:** recarga la página. Se actualiza cada 2,5 s.
- **La app no carga para nadie:** plan B (`docs/PLAN_B.md`). No pierdas más de 3 minutos intentando.

## Después
- **Exportar**: inscritos (nombre, correo, mesa, perfil, consentimiento) y votos anonimizados, en CSV que abre bien en Excel.
- La sala cerrada guarda un respaldo automático de la base de datos.
- Los resultados nunca muestran nombres ni votos individuales. Los datos personales solo salen en el export del admin: trátalos según la Política de Tratamiento de Datos de Estratek.
