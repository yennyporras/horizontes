# Backlog extra por área (si sobra tiempo; cada área toma solo de su lista)

## Servidor
- Caché de agregados por `(sala_id, version, alcance, mesa)` y medición p95.
- Endpoint `GET /api/admin/salas/{id}/eventos` paginado.
- Respaldo automático de la BD al cerrar cada sala.
- Rate limit en `/api/inscripcion` y `/api/votos` por IP.

## Celular
- Modo sin conexión: guardar el voto en cola y reenviar al recuperar señal.
- Accesibilidad: navegación completa por teclado, lectores de pantalla en la rúbrica.
- Indicador de "tu voto cuenta en el promedio de tu mesa" tras guardar.

## Tablero
- Animación suave R1 → R2 al cerrar la ronda 2.
- Modo pantalla completa con atajo de teclado (F) y ocultar controles.
- Vista "todas las mesas" en cuadrícula para comparar empresas.

## Panel e infraestructura
- Hoja imprimible con QR de todas las mesas (A4, una mesa por cuarto de hoja).
- Duplicar sala para ensayos.
- Monitor de salud en `/admin/salud` (latencia, versión desplegada, último error).

## Ideas para después de la v1 (acta del 16-oct, fuera de alcance)
- **Panel unificado de herramientas (IRMI, Horizontes…)** (acta A12): un solo acceso para los facilitadores de Estratek con las herramientas en una lista, usuarios y roles compartidos, y cada herramienta en su propio repo y despliegue. Solo idea: no se diseña ni se construye en esta entrega.

## Seguridad y datos (auditoría del 20-oct, para decidir)
- **Fotos de 3 en 3 con identidades falsas (M-2).** Una persona que inscribe 2 identidades falsas en su mesa puede forzar dos fotos seguidas y restar para deducir el voto de otra. Opciones: con la ronda abierta mostrar solo la posición redondeada en la matriz y dejar promedios y distribución para el cierre; renovar la foto solo con 3 votantes nuevos (no 3 cambios); avisar en el panel cuando una mesa pase de un tope de inscritos. Cambia lo que se ve en vivo: lo decide Paola.
- **Enlace de «Dar acceso de nuevo» sin segundo factor (B-1).** Quien fotografíe el QR del facilitador antes que la persona se queda con su sesión durante 15 minutos. Opción: pedir también el correo inscrito al canjear (no es recuperación por correo: hacen falta los dos).
- **Supresión de datos y vencimiento de respaldos (B-5).** Hoy se desactiva a una persona pero no se borra, y los respaldos por sala no vencen. Propuesta: borrar los respaldos de una sala cerrada después de N días y una ruta de admin para suprimir a un participante (votos, consentimientos, accesos y fotos), como pide el aviso (Ley 1581 y Ley 29733).
- Login: el tope es por IP y usuario; falta un tope global por IP contra quien prueba muchos usuarios. Usar el /64 en IPv6 y `scrypt` asíncrono.
- `/api/health` publica el commit desplegado; la imagen instala `curl` aunque el healthcheck usa `wget`. Confirmar que `TRUST_PROXY_HOPS=1` coincide con la cadena real (si hay Cloudflare delante, la IP sería la suya).
