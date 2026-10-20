# Capturas de referencia del tablero

Para la guía del facilitador. Con los cambios del acta del 16-oct: ronda 1 en verde (aro hueco, «R1»), ronda 2 en rojo (burbuja sólida, «R2»), franja de la fase mientras una ronda está abierta y tabla con los 6 criterios y la fila «Total» (eje X + eje Y, del servidor). Datos: la prueba sintética del golden (20 personas, 2 mesas) en una sala llamada "Taller Foodsume". Desde el 19-oct, en el tema carbón de la familia Estratek: firma «Horizontes por Estratek »» y línea del degradado bajo el encabezado, horizontes en superficies carbón escalonadas y fijos en gris azulado. Se regeneran con:

```bash
HZ_E2E_ESPERA_MS=0 HZ_CAPTURAS_GUIA=docs/capturas npx vitest run web/tablero/e2e -t "capturas de referencia"
```

| Archivo | Qué muestra | Cuándo la ve la sala |
|---|---|---|
| `01-ronda-1.png` | Matriz con la posición de la ronda 1 (tecla 1) | Al cerrar la ronda 1 |
| `02-ronda-2.png` | Matriz con la posición de la ronda 2 (tecla 2) | Durante y al cerrar la ronda 2 |
| `03-comparacion.png` | R1 hueco verde, R2 sólido rojo y flecha del movimiento (tecla C) | Sola al cerrar la ronda 2, con la animación R1 a R2 |
| `04-preliminar.png` | Ronda 1 abierta con todos ya votados: franja verde «Ronda 1 · individual y en silencio», insignia "Preliminar" y avisos de mesas completas | Antes de que el facilitador cierre la ronda |
| `05-todas-las-mesas.png` | Una matriz por mesa (alcance "Todas las mesas") | Para comparar equipos |
| `06-proyector-pantalla-completa.png` | Pantalla completa (tecla F): sin controles, con el nombre de la vista | En el proyector |
| `07-proyector-1280x720.png` | Proyector de 1280×720: todo cabe sin desplazar | Proyectores de baja resolución |
| `08-mesa-1.png` | Alcance de una sola mesa | Para mostrar a una mesa su resultado |
| `09-celular-360.png` | Celular de 360 px (página completa) | Si alguien abre el tablero en el celular |
| `10-ronda-2-abierta.png` | Ronda 2 abierta: franja roja «Ronda 2 · discusión en la mesa» y tabla R1/R2 con «Total» | Durante la ronda 2 |
| `11-minimo-de-votos.png` | Mesa con menos de 3 votos: «Hace falta al menos 3 votos para mostrar esta mesa» y «Faltan votos» en la tabla | Al empezar una ronda, mientras la mesa vota |
| `12-celular-360-ronda-2.png` | Celular de 360 px con la ronda 2 abierta (página completa) | Si alguien abre el tablero en el celular |

Atajos del proyector: F pantalla completa, 1 ronda 1, 2 ronda 2, C comparación.
