# R4 · T4 Admin + Infra · 4 h autónomas · Cambios del acta, entrega y producción lista

Lee CLAUDE.md, docs, **`docs/ACTA_2026-10-16.md` completo (manda sobre la SPEC donde choquen)**, `docs/bitacora/S_R3.md` y las bitácoras `R3_T*.md` de las 4 terminales. Empieza por cualquier falla de pruebas atribuible a tu área. T1 publica los campos nuevos del contrato en su primera hora; mientras tanto trabaja con los mocks.

## Prioridad 1 · Cambios del acta en el panel
1. **Sala en vivo (A3, P2):** en `web/admin/paginas/SalaEnVivo.tsx` quita Eje X, Eje Y, T2M y Votos de la tabla de resultados y agrega la fila **«Total»** del servidor. R1 en verde y R2 en rojo con los tokens de T2 (P3), siempre con texto.
2. **Configuración de la sala:** selector de **país** (Colombia, Perú, Guatemala) y zona horaria (P4). La visibilidad por defecto pasa a **resultados de toda la sala, visibles tras votar** (A2); el facilitador puede cambiarla. Los mensajes 422 del servidor se muestran tal cual.
3. **Registro interno (A1):** el export interno del admin incluye quién votó, cuándo, país e IP. Las vistas públicas y el export de resumen siguen anónimos. Explícalo en una línea de ayuda del panel.

## Prioridad 2 · Documentación de entrega
4. `docs/GUIA_FACILITADOR.md` (1 página, voz Estratek) al día con el acta: ronda 1 individual y en silencio, ronda 2 con discusión, colores por ronda, resultados de la sala por defecto, mínimo de 3 votos, «Total».
5. `docs/DESPLIEGUE.md`: sección **«Cambio a horizontes.com.co»** con los pasos exactos para Paola: compra del dominio, DNS A al VPS, dominio en Coolify, `BASE_URL`, `HZ_DOMINIO_PROD` y reimpresión de los QR. No cambies el dominio actual.
6. `docs/MIGRACION_GITHUB.md` (A11): pasos para que Paola mueva el repo a la cuenta corporativa de Estratek (transferir o espejar, `git remote set-url`, GitHub App de Coolify, secretos, protección de `main`). Lo ejecuta Paola, no un agente.
7. `docs/BACKLOG_EXTRA.md`: entrada «Panel unificado de herramientas (IRMI, Horizontes…)» (A12), solo como idea.
8. `docs/PLAN_B.md`, la papeleta y la plantilla: confirma que siguen con 6 criterios y escala 1-3-5-7-9, y agrega la fila «Total».
9. Hoja de QR A4 en PDF y **`docs/ENTREGA.md`**: URLs, accesos (sin claves), qué está listo, qué falta y la lista de verificación del día del taller.

## Prioridad 3 · QA y producción
10. Pasada 2 de QA en local de todo el sistema a 360 px y 1920 px, y `docs/TRIAGE.md` al día (verifica #2, #3, #4 y #18 a #21).
11. **Producción:** si `docs/BLOQUEOS.md` muestra que Coolify, `deploy/.env.deploy` y el DNS ya están listos, sigue `tools/deploy.sh produccion`. **Si no**, no despliegues: deja en `docs/ENTREGA.md` los pasos exactos que faltan para Paola. Nunca leas `.env`, `.env.*` ni `deploy/.env.deploy`.

Aceptación: panel con los cambios del acta; guía, despliegue, migración y entrega escritos; TRIAGE al día; `tools/test.sh` en verde; bitácora al día.
