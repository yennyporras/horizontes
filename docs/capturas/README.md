# Capturas de referencia del tablero

Para la guía del facilitador. Datos: la prueba sintética del golden (20 personas, 2 mesas) en una sala llamada "Taller Foodsume". Se regeneran con:

```bash
HZ_E2E_ESPERA_MS=0 HZ_CAPTURAS_GUIA=docs/capturas npx vitest run web/tablero/e2e -t "capturas de referencia"
```

| Archivo | Qué muestra | Cuándo la ve la sala |
|---|---|---|
| `01-ronda-1.png` | Matriz con la posición de la ronda 1 (tecla 1) | Al cerrar la ronda 1 |
| `02-ronda-2.png` | Matriz con la posición de la ronda 2 (tecla 2) | Durante y al cerrar la ronda 2 |
| `03-comparacion.png` | R1 punteado, R2 sólido y flecha del movimiento (tecla C) | Sola al cerrar la ronda 2, con la animación R1 a R2 |
| `04-preliminar.png` | Ronda 1 abierta con todos ya votados: insignia "Preliminar" y avisos de mesas completas | Antes de que el facilitador cierre la ronda |
| `05-todas-las-mesas.png` | Una matriz por mesa (alcance "Todas las mesas") | Para comparar equipos |
| `06-proyector-pantalla-completa.png` | Pantalla completa (tecla F): sin controles, con el nombre de la vista | En el proyector |
| `07-proyector-1280x720.png` | Proyector de 1280×720: todo cabe sin desplazar | Proyectores de baja resolución |
| `08-mesa-1.png` | Alcance de una sola mesa | Para mostrar a una mesa su resultado |
| `09-celular-360.png` | Celular de 360 px (página completa) | Si alguien abre el tablero en el celular |

Atajos del proyector: F pantalla completa, 1 ronda 1, 2 ronda 2, C comparación.
