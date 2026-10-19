# Backlog extra por área (solo si terminas antes; nunca tomes del área de otra terminal)

## T1 Backend
- Caché de agregados por `(sala_id, version, alcance, mesa)` y medición p95.
- Endpoint `GET /api/admin/salas/{id}/eventos` paginado.
- Respaldo automático de la BD al cerrar cada sala.
- Rate limit en `/api/inscripcion` y `/api/votos` por IP.

## T2 Participante
- Modo sin conexión: guardar el voto en cola y reenviar al recuperar señal.
- Accesibilidad: navegación completa por teclado, lectores de pantalla en la rúbrica.
- Indicador de "tu voto cuenta en el promedio de tu mesa" tras guardar.

## T3 Tablero
- Animación suave R1 → R2 al cerrar la ronda 2.
- Modo pantalla completa con atajo de teclado (F) y ocultar controles.
- Vista "todas las mesas" en cuadrícula para comparar empresas.

## T4 Admin + Infra
- Hoja imprimible con QR de todas las mesas (A4, una mesa por cuarto de hoja).
- Duplicar sala para ensayos.
- Monitor de salud en `/admin/salud` (latencia, versión desplegada, último error).

## Ideas para después de la v1 (acta del 16-oct, fuera de alcance)
- **Panel unificado de herramientas (IRMI, Horizontes…)** (acta A12): un solo acceso para los facilitadores de Estratek con las herramientas en una lista, usuarios y roles compartidos, y cada herramienta en su propio repo y despliegue. Solo idea: no se diseña ni se construye en esta entrega.
