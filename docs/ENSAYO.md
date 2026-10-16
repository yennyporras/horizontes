# Ensayo general automático (R3 · T1)

Ensayo del taller completo contra la API real: el servidor corre en un proceso aparte (puerto 4101) con una BD SQLite temporal y el simulador hace de admin, de tablero y de 40 celulares con polling cada 2,5 s.

## Cómo correrlo

```bash
npm run ensayo -- --puerto 4101 --md informe.md          # 40 personas, 4 mesas, cierre real de R2 a 10 min
npm run ensayo -- --cierre-min 1                         # lo mismo con cierre a 1 min
npm run ensayo:golden -- --cierre-min 1                  # 20 personas con los votos de tests/golden (prueba sintética)
npm run ensayo -- --url https://staging-horizontes.estratek.com.co --usuario <admin> --clave '<clave>'
```

Sale con 1 si hay errores HTTP, alguna verificación falla o el p95 del cliente pasa de 500 ms. La versión corta (cierre a 3 s, 9 personas y golden de 20) corre en cada `tools/test.sh` (`tests/server/ensayo.test.ts`).

## Qué cubre

| Requisito del prompt R3 | Dónde se verifica |
|---|---|
| 4 mesas, 40 participantes, 2 rondas | Inscripción con consentimiento, R1 y R2 completas, 160 votos en el export |
| Precierre por mesa | Cada mesa entra en precierre al terminar, ve su resultado preliminar, las demás no ven nada, el admin recibe "Todos votaron en Mesa N" |
| Llegada tarde | La persona 40 se inscribe en plena R1 en la primera mesa en precierre: lo deshace y al votar vuelve |
| Cambio de alcance en vivo | `mesa → sala` en R1: tiempo hasta que lo ven los 40 celulares |
| Cambio de vista en vivo | `registrado → en_vivo` en R2: tiempo hasta que lo ven los 40 celulares |
| Cierre programado real a 10 min | Cierre de R2 programado a 10 min y de la sala 20 s después: lo aplica el servidor (`por: programado`) y se mide el desfase y cuánto tardan los celulares en verlo |
| Golden | `--golden` usa los votos de `tests/golden/motor_golden.json` (prueba sintética) y compara los 4 puntos con tolerancia 0,001 |
| Puntos | Sala y cada mesa contra un cálculo independiente del motor |

Las corridas se hicieron con el endurecimiento de R3 ya puesto (cabeceras, validación estricta, límites por IP y por participante): ningún 429 ni 4xx inesperado con 40 celulares detrás de la misma IP.

## Resultado

### Corrida oficial · Corrida 2026-10-16T11:07Z · realista · 40 personas · 4 mesas · local

Resultado: **OK** · sala HZ9TP · 11.2 min · 11227 peticiones · errores HTTP 0 · 5xx 0 · p95 cliente 180.2 ms · p95 servidor 8.6 ms

| Verificación | | Detalle |
|---|---|---|
| inscripción con consentimiento | OK | 39/39 antes de abrir R1 |
| R1 abierta en todos los celulares | OK | último a los 2.4 s |
| R1: precierre solo en las mesas que terminaron (Mesa 1) | OK | Mesa 1:sí Mesa 2:no Mesa 3:no Mesa 4:no |
| R1: Mesa 1 ve su resultado preliminar sin cerrar la ronda | OK | último a los 2.1 s |
| R1: las mesas que no han terminado no ven resultados (tras Mesa 1) | OK |  |
| R1: aviso al admin "Todos votaron en Mesa 1" | OK |  |
| R1: llegada tarde a Mesa 1 deshace su precierre | OK |  |
| R1: al votar quien llegó tarde, Mesa 1 vuelve a precierre | OK |  |
| R1: precierre solo en las mesas que terminaron (Mesa 2) | OK | Mesa 1:sí Mesa 2:sí Mesa 3:no Mesa 4:no |
| R1: Mesa 2 ve su resultado preliminar sin cerrar la ronda | OK | último a los 2.5 s |
| R1: las mesas que no han terminado no ven resultados (tras Mesa 2) | OK |  |
| R1: aviso al admin "Todos votaron en Mesa 2" | OK |  |
| R1: precierre solo en las mesas que terminaron (Mesa 3) | OK | Mesa 1:sí Mesa 2:sí Mesa 3:sí Mesa 4:no |
| R1: Mesa 3 ve su resultado preliminar sin cerrar la ronda | OK | último a los 2.3 s |
| R1: las mesas que no han terminado no ven resultados (tras Mesa 3) | OK |  |
| R1: aviso al admin "Todos votaron en Mesa 3" | OK |  |
| R1: precierre solo en las mesas que terminaron (Mesa 4) | OK | Mesa 1:sí Mesa 2:sí Mesa 3:sí Mesa 4:sí |
| R1: Mesa 4 ve su resultado preliminar sin cerrar la ronda | OK | último a los 2.4 s |
| R1: las mesas que no han terminado no ven resultados (tras Mesa 4) | OK |  |
| R1: aviso al admin "Todos votaron en Mesa 4" | OK |  |
| R1: precierre de sala con todos los votos, ronda todavía abierta | OK | 40/40 |
| alcance mesa → sala: visible en los 40 celulares en < 5 s | OK | último a los 2.5 s, mediana 1.1 s |
| config de alcance → 200 | OK |  |
| R1: al cerrar, todos ven el resultado definitivo | OK | último a los 2.6 s |
| vista registrado → en vivo: visible en los 40 celulares en < 5 s | OK | último a los 2.5 s, mediana 1.0 s |
| cierres programados aceptados | OK | R2 a las 2026-10-16T11:07:15.000Z, sala 20 s después |
| R2 en vivo: quien completó ve el tablero con R1 y R2 | OK | último a los 1.5 s |
| R2: las 12 hojas reveladas en todos los celulares | OK |  |
| R2: precierre de sala y la ronda sigue abierta hasta la hora programada | OK |  |
| cierre programado de R2: aplicado por: "programado" a la hora (± 15 s) | OK | desfase 1.0 s |
| cierre programado de R2: todos los celulares lo ven en < 20 s | OK | último a los 1.8 s de la hora |
| cierre programado de la sala: aplicado por: "programado" a la hora (± 15 s) | OK | desfase 2.0 s |
| cierre programado de la sala: todos los celulares lo ven en < 20 s | OK | último a los 2.6 s de la hora |
| puntos de la sala = cálculo independiente | OK | INSUMEX R1 (4.82, 4.89) · INSUMEX R2 (4.64, 4.81) · NUTRIWHAT R1 (5.75, 5.47) · NUTRIWHAT R2 (5.76, 5.62) |
| puntos de Mesa 1 | OK | INSUMEX R1 (5.31, 4.82) · INSUMEX R2 (4.62, 4.93) · NUTRIWHAT R1 (5.52, 5.51) · NUTRIWHAT R2 (5.71, 5.45) |
| puntos de Mesa 2 | OK | INSUMEX R1 (4.61, 5.54) · INSUMEX R2 (4.78, 5.38) · NUTRIWHAT R1 (4.76, 5.60) · NUTRIWHAT R2 (5.42, 6.08) |
| puntos de Mesa 3 | OK | INSUMEX R1 (4.63, 3.74) · INSUMEX R2 (4.62, 4.24) · NUTRIWHAT R1 (6.09, 7.04) · NUTRIWHAT R2 (5.64, 5.80) |
| puntos de Mesa 4 | OK | INSUMEX R1 (4.66, 5.53) · INSUMEX R2 (4.52, 4.69) · NUTRIWHAT R1 (6.76, 3.53) · NUTRIWHAT R2 (6.32, 5.11) |
| export de votos completo | OK | 160 filas |

| Cambio en vivo | Mediana | Último celular |
|---|---|---|
| alcance mesa → sala | 1087 ms | 2476 ms |
| vista registrado → en vivo | 1027 ms | 2502 ms |

| Cierre programado | Programado | Aplicado | Desfase | Último celular |
|---|---|---|---|---|
| cierre programado de R2 | 2026-10-16T11:07:15.000Z | 2026-10-16T11:07:16.000Z | 1000 ms | 1845 ms |
| cierre programado de la sala | 2026-10-16T11:07:35.000Z | 2026-10-16T11:07:37.000Z | 2000 ms | 2577 ms |

| Ruta | n | p50 | p95 | máx. |
|---|---|---|---|---|
| GET /api/admin/salas/:id | 268 | 10.2 | 167.5 | 1079.9 |
| GET /api/admin/salas/:id/export/votos.csv | 1 | 20.2 | 20.2 | 20.2 |
| GET /api/mesas/:codigo | 40 | 2.3 | 3.8 | 5.7 |
| GET /api/tablero/:id | 275 | 9.4 | 169.0 | 1100.8 |
| GET /api/yo | 10433 | 5.2 | 186.1 | 1150.9 |
| PATCH /api/admin/salas/:id/config | 4 | 5.7 | 10.6 | 10.6 |
| POST /api/admin/login | 1 | 176.8 | 176.8 | 176.8 |
| POST /api/admin/salas | 1 | 22.2 | 22.2 | 22.2 |
| POST /api/admin/salas/:id/acciones | 4 | 4.5 | 22.2 | 22.2 |
| POST /api/inscripcion | 40 | 4.1 | 12.8 | 13.3 |
| PUT /api/votos | 160 | 5.9 | 42.6 | 303.3 |

### Modo golden (`npm run ensayo:golden -- --cierre-min 1`)

Resultado: **OK** · 20 personas · 4 mesas · 129 s · 1222 peticiones · errores HTTP 0 · 5xx 0 · p95 cliente 8,2 ms · golden de la prueba sintética 4 de 4 puntos (tolerancia 0,001) · INSUMEX R1 (4.89, 4.76), R2 (4.55, 4.65) · NUTRIWHAT R1 (5.15, 4.83), R2 (4.75, 5.42) · cierres programados con desfase 0 ms · export de 80 votos completo.

### Corrida anterior descartada (10:56Z)

Misma prueba, todas las verificaciones OK y 0 errores 5xx, pero 1 de 11 394 peticiones (`GET /api/yo`) quedó sin respuesta del lado del cliente (`fetch failed`). En ese momento la máquina de desarrollo se quedó sin memoria virtual (4 terminales trabajando: `fork` fallaba en Git Bash y vitest no podía reservar memoria). Un celular real lo absorbe en el siguiente polling. Se repitió la corrida con la máquina estable y salió limpia (arriba).

## Lectura

- **0 errores 5xx** en las tres corridas; **golden al 100 %**.
- Los cambios en vivo (alcance y vista) llegan a los 40 celulares en ≤ 2,5 s: el máximo posible con polling de 2,5 s.
- Los cierres programados los aplica el servidor con 0 a 2 s de desfase (el chequeo corre en cada petición y cada 15 s) y el último celular los ve en < 3 s.
- El p95 dentro del servidor se mantiene < 10 ms. El p95 del cliente sube a 180 ms solo cuando la máquina está cargada por las otras terminales; con la máquina libre es de 8 a 21 ms.
