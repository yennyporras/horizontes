# R4 · T1 Backend · 4 h autónomas · Cambios del acta del 16-oct y endurecimiento

Lee CLAUDE.md, docs (SPEC, CONTRATO_API, MODELO_DATOS, DECISIONES), **`docs/ACTA_2026-10-16.md` completo (manda sobre la SPEC donde choquen)**, `docs/bitacora/S_R3.md` y las bitácoras `R3_T*.md` de las 4 terminales. Empieza por cualquier falla de pruebas atribuible a tu área.

## Prioridad 1 · Contrato del acta (publícalo en la primera hora: T2, T3 y T4 dependen de él)
Todos los campos nuevos son **opcionales** (regla del contrato). Anota cada uno en `docs/DECISIONES.md` con `CONTRATO:` y `ACTA-16OCT:`, y actualiza `web/shared/api/contrato.ts` y los mocks (`mocks/`, `server/mocks.ts`) para que las otras terminales trabajen con mocks mientras tanto. Haz commit apenas el contrato esté publicado.
1. **«Total» (P2):** campo `total` = `eje_x + eje_y` por proyecto, ronda y alcance, calculado en el servidor junto a `eje_x` y `eje_y` (`shared/motor/motor.ts`, `server/dominio/resultados.ts`). `null` cuando el alcance está `bajo_minimo`. Agrega su caso a `tests/golden/motor_golden.json` **sin cambiar ningún esperado existente** y deja el golden al 100 %.
2. **Mínimo de 3 votos por alcance (P6, TRIAGE #29):** `MINIMO_VOTOS = 3`. Ajusta pruebas, simulador y ensayo.
3. **Visibilidad por defecto (A2):** resultados de **toda la sala**, consolidados y visibles tras votar. Nueva migración aditiva para los valores por defecto de `alcance_resultados` y `vista_participante`, más los valores con que se crea, duplica (`salas.ts`) y reinicia (`mantenimiento.ts`) una sala. Las salas existentes conservan su configuración. El cambio frente a SPEC §6 va en `docs/DECISIONES.md`.
4. **País por sala (P4):** columnas `pais` (`CO`, `PE`, `GT`, por defecto `CO`) y `zona_horaria` (`America/Bogota`, `America/Lima`, `America/Guatemala`), editables por el admin en `PATCH /api/admin/salas/{id}/config`. Las horas de cierres programados, respaldos y export usan la zona de la sala, no la fija de `server/dominio/util.ts`. Expón `pais` y `zona_horaria` donde las vistas las necesiten (tablero, participante, admin).
5. **IP (P4):** guarda la IP real (detrás del proxy, `TRUST_PROXY_HOPS`) en cada inscripción y en cada voto (columnas nuevas, migración aditiva). Nunca sale en respuestas públicas ni en logs; solo en el export interno del admin. La versión del consentimiento pasa a `hz-1.1` y su texto depende del país (lo escribe T2; tú expones el país).
6. **Dominio (A10):** nada fijo con `estratek.com.co` en el código: todo sale de `BASE_URL`. En `tools/deploy.sh` el dominio de producción sale de una variable (`HZ_DOMINIO_PROD`, por defecto el actual). **No cambies el dominio por defecto**: `horizontes.com.co` todavía no tiene DNS (lo hace Paola).

## Prioridad 2 · Pendientes
7. Pendientes de tu bitácora R3, TRIAGE abierto de tu área y `docs/ENSAYO.md` con la corrida del ensayo de 10 min en local.
8. Script de reinicio limpio y respaldo final: verifica que siguen funcionando con las columnas nuevas.

## Límites
- **Nada contra staging ni producción**: Coolify no está configurado (ver `docs/BLOQUEOS.md`). El simulador y el ensayo corren en local o con `tools/deploy.sh local`.
- No toques `data/` (solo lectura) ni la semilla: los 6 perfiles se quedan (P1) y los rangos de inversión no cambian (P5).

Aceptación: contrato publicado con los 6 puntos de la prioridad 1, golden al 100 %, `tools/test.sh` en verde, DECISIONES y bitácora al día.
