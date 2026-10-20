# Plan B · Taller sin la app

Si la app no carga para la sala (servidor caído, Wi-Fi del salón sin salida a internet) y no se arregla en 3 minutos, el taller sigue en papel y Excel. Mismo caso, mismas preguntas, mismo cálculo. La gente no nota la diferencia más allá del papel.

## Qué llevar impreso (siempre, aunque todo funcione)
| Qué | Archivo | Cantidad |
|---|---|---|
| Papeleta de calificación (A4, anónima, 2 proyectos × 6 criterios con rúbrica) | `deploy/plan_b/papeleta.html` → imprimir | 2 por persona (una por ronda) + 10 % |
| Caso Foodsume y las 6 hojas de perfil | Exportar desde la semilla o el deck del taller | 1 caso por persona, 1 juego de hojas por mesa |
| Hoja de QR de las mesas | Panel → Mesas y QR → Imprimir | 1 |

En el portátil del facilitador, sin depender de internet: `deploy/plan_b/Plantilla_Horizontes_Shot_Nutresa.xlsx`.

## La plantilla Excel
Se genera desde `data/seed_foodsume.json` con `python deploy/plan_b/generar_plantilla.py` (si cambian pesos, textos o fijos, se vuelve a generar).
- **Votos**: una fila por papeleta y proyecto: mesa, ronda, proyecto y los 6 valores (la celda solo acepta 1, 3, 5, 7 o 9).
- **Resultados**: en `C2` escribe `Sala` o el número de la mesa. Calcula el promedio simple por criterio y aplica el motor con los pesos de la semilla: T2M 30/35/35, eje X 60/40, eje Y 70/30. Los 8 fijos vienen precargados. Si prefieres contar a mano, digita los promedios en las filas "Promedio digitado" y deja vacía la hoja Votos.
- **Total** (acta A4 y P2): última columna de Resultados, eje X + eje Y. La app ya no muestra la fila «Total» (preentrega del 19-oct); en la plantilla queda como referencia. Para conversar con la sala muestra los 6 criterios; T2M, Eje X y Eje Y solo ubican la burbuja.
- **Matriz**: gráfico de burbujas con los 8 fijos en gris y los 2 vivos en **R1 verde y hueco** y **R2 rojo y sólido** (acta P3), ejes de 0 a 9,5. Proyéctalo.
- Verificado (16-oct): con votos de prueba, la plantilla da los mismos T2M, eje X y eje Y que el motor de la app. Total es la suma de esas dos celdas.

**Si editaste las rúbricas en el panel:** la papeleta y la plantilla son estáticas y salen de la semilla, así que no se enteran. Antes de imprimir, regenéralas con las rúbricas de la sala:
1. Con la sesión de admin abierta, abre en el navegador `/api/admin/salas/{id de la sala}/rubricas` y guarda la respuesta como `rubricas.json`.
2. Corre `python deploy/plan_b/generar_plantilla.py --rubricas rubricas.json`. Reemplaza `papeleta.html` (los textos de cada nivel) y la plantilla Excel (que no lleva textos de rúbrica, pero queda del mismo día).
3. Imprime la papeleta nueva. Sin `--rubricas` vuelven los textos de la semilla.

**Confirmado el 19-oct:** la papeleta y la plantilla siguen con los 6 criterios de la semilla y solo aceptan 1, 3, 5, 7 o 9 (la celda de la hoja Votos rechaza otros valores). La papeleta no lleva fila «Total»: el participante no calcula, solo califica; el Total sale en la plantilla.

## Cómo se corre el taller en plan B
1. Reparte caso, hoja por perfil (cada persona recibe uno; la mesa reparte los 6) y una papeleta.
2. **Ronda 1, individual y en silencio**: cada persona califica los 2 proyectos solo con su hoja y entrega la papeleta. Un apoyo digita (≈ 20 s por papeleta).
3. Proyecta la Matriz y Resultados con `C2 = Sala` y luego por mesa.
4. **Ronda 2, con discusión**: la mesa intercambia todas las hojas, conversa y llena una papeleta nueva. Se digita con `Ronda = 2`.
5. La Matriz muestra R1 y R2 de cada vivo. Esa es la conversación.

## Formulario de respaldo
Si hay internet pero la app está caída, la alternativa a digitar es un formulario en línea con las mismas 8 preguntas de la papeleta (mesa, ronda y los 6 criterios por proyecto, opciones 1, 3, 5, 7 y 9, sin nombre ni correo). Sus respuestas se exportan a hoja de cálculo y se pegan en la hoja **Votos** en el mismo orden de columnas. Pendiente de Paola: crearlo en la cuenta de Estratek (no se crea desde aquí para no publicar nada sin su visto bueno) y pegar el enlace en esta sección.

## Qué se pierde frente a la app
- Sin inscripción digital: no hay nombre, correo ni consentimiento. Si se necesita la lista de asistentes, que sea la planilla de asistencia del evento, con su propia autorización.
- Sin precierre automático ni tiempo real: el facilitador decide cuándo cerrar cada ronda.
- La dispersión por criterio se ve con un filtro en la hoja Votos, no en mini barras.

## Volver a la app
Si la app vuelve durante el taller, termina la ronda en curso en papel y abre la siguiente en la app. No mezcles las dos fuentes en la misma ronda.
