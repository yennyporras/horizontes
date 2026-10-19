# Integración tras R4 · 2026-10-19

Integración hecha en `main` (local), en este orden: t1-backend → t5-inicio → t4-admin → t2-participante → t3-tablero. Contrato fijado de antemano en `docs/R4_CONTRATO.md`. Base: `docs/ACTA_2026-10-16.md`.

- **t1-backend:** integrada. `total`, `MINIMO_VOTOS = 3`, visibilidad por defecto de sala y en vivo, país y zona horaria por sala, IP solo para el admin, aviso `hz-1.1` por país y `HZ_DOMINIO_PROD`.
- **t5-inicio:** integrada. Landing pública en `/`: qué es, código de la mesa, cómo funciona, qué se evalúa, facilitadores (panel) y privacidad.
- **t4-admin:** integrada. Panel con el acta, guía del facilitador, despliegue a horizontes.com.co, migración a GitHub corporativo, plan B, entrega y hoja de QR en PDF.
- **t2-participante:** integrada. Tabla con «Total», R1 verde y R2 rojo, fases de ronda, aviso de datos por país y e2e con la regla nueva.
- **t3-tablero:** integrada. Tabla con «Total», R1 verde y R2 rojo, franjas de fase y mínimo de votos. Se arregló la animación R1→R2, que volvía a empezar desde R1 cuando se redibujaba (era la prueba en rojo de R3).
- **Conflictos:** solo `docs/DECISIONES.md` y `docs/TRIAGE.md` (entradas que se suman); se conservaron las de todas las terminales.

## Cambios propios de la integración
- **Solo la landing se indexa:** `X-Robots-Tag: noindex, nofollow` en todo menos GET/HEAD de `/`, y `GET /robots.txt`. Con prueba.
- **Un solo texto legal `hz-1.1` por país:** el de `docs/CONSENTIMIENTO.md` §5.1 (mayor de edad, correo de derechos y derechos ARCO en Perú). Una prueba verifica que el servidor y el documento coinciden.
- **`tools/deploy.sh` ya no escribe `CONSENTIMIENTO_VERSION`:** el servidor no la leía.

## Pruebas
- `npx tsc --noEmit`: sin errores.
- `bash tools/test.sh` completo (con navegador): **30 archivos, 457 pruebas pasan, 1 omitida (las capturas, que solo corren con `HZ_CAPTURAS_GUIA`), 0 fallan.**
- TRIAGE: sin hallazgos abiertos.

## Pendiente (Paola)
Ver `docs/ENTREGA.md` §5: staging sano en Coolify (hoy 503 por HTTPS), producción clonada de staging, revisión del texto legal y, después, horizontes.com.co y GitHub corporativo.
