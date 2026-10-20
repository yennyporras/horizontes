# Capturas de referencia del tablero

Para la guía del facilitador. Con los cambios del acta del 16-oct: ronda 1 en verde (aro hueco, «R1»), ronda 2 en rojo (burbuja sólida, «R2»), franja de la fase mientras una ronda está abierta y tabla con los 6 criterios (sin fila «Total» desde el 19-oct). Datos: la prueba sintética del golden (20 personas, 2 mesas) en una sala llamada "Taller Foodsume". Desde el 20-oct, en el tema claro de la familia Estratek: barra carbón con el logo de Horizontes, la firma «Horizontes por Estratek »» y la línea del degradado debajo; la matriz sobre fondo claro. Se regeneran con:

```bash
HZ_E2E_ESPERA_MS=0 HZ_CAPTURAS_GUIA=docs/capturas npx vitest run web/tablero/e2e -t "capturas de referencia"
```

| Archivo | Qué muestra | Cuándo la ve la sala |
|---|---|---|
| `01-ronda-1.png` | Matriz con la posición de la ronda 1 (tecla 1) | Al cerrar la ronda 1 |
| `02-ronda-2.png` | Matriz con la posición de la ronda 2 (tecla 2) | Durante y al cerrar la ronda 2 |
| `03-comparacion.png` | R1 hueco verde, R2 sólido rojo y flecha del movimiento (tecla C) | Sola al cerrar la ronda 2, con la animación R1 a R2 |
| `04-preliminar.png` | Ronda 1 abierta con todos ya votados: franja con aro verde «Ronda 1 · individual y en silencio» e insignia "Preliminar" | Antes de que el facilitador cierre la ronda |
| `05-todas-las-mesas.png` | Una matriz por mesa (alcance "Todas las mesas") | Para comparar equipos |
| `06-proyector-pantalla-completa.png` | Pantalla completa (tecla F): sin controles; quedan la firma, la sala, la ronda, la vista y los votos recibidos | En el proyector |
| `07-proyector-1280x720.png` | Proyector de 1280×720: todo cabe sin desplazar | Proyectores de baja resolución |
| `08-mesa-1.png` | Alcance de una sola mesa | Para mostrar a una mesa su resultado |
| `09-celular-360.png` | Celular de 360 px (página completa) | Si alguien abre el tablero en el celular |
| `10-ronda-2-abierta.png` | Ronda 2 abierta: franja roja «Ronda 2 · discusión en la mesa» e insignia «En vivo, cada 3 votos» | Durante la ronda 2 |
| `11-minimo-de-votos.png` | Mesa con menos de 3 votos: «Hacen falta al menos 3 votos para mostrar esta mesa» | Al empezar una ronda, mientras la mesa vota |
| `12-celular-360-ronda-2.png` | Celular de 360 px con la ronda 2 abierta (página completa) | Si alguien abre el tablero en el celular |
| `13-detallado.png` | Modo Detallado (`modo=detallado`): matriz, progreso y promedios por criterio con su descripción corta | Para discutir los criterios |
| `14-detallado-1280x720.png` | Modo Detallado en un proyector de 1280×720: todo cabe sin desplazar | Proyectores de baja resolución |
| `15-como-voto.png` | «Cómo votó la sala» (tecla V): conteos 1-3-5-7-9 en una sola escala para R1 y R2 | Para la plenaria |
| `16-proyector-1280x720-pantalla-completa.png` | Modo Gráfica en pantalla completa a 1280×720 | Proyectores de baja resolución |

Las capturas 01 a 12 van en el modo Gráfica (`modo=grafica`, el de defecto): solo la matriz, a todo el ancho, con la letra de proyector (20 px como mínimo en 1280×720 y 24 px en 1920×1080).

Atajos del proyector: F pantalla completa, G Gráfica, D Detallado, M alterna los modos, V «Cómo votó», 1 ronda 1, 2 ronda 2, C comparación.
