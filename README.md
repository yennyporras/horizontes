# Horizontes

Herramienta web de Estratek para el taller **Portafolio por Horizontes**. Cada mesa de un taller simula una empresa: sus participantes leen el caso Foodsume en el celular, reciben una hoja de información según su perfil y califican dos proyectos vivos (INSUMEX y NUTRIWHAT) en seis criterios, en dos rondas. La matriz de burbujas muestra cuánto se movieron los proyectos entre la ronda 1 (individual y en silencio) y la ronda 2 (con discusión en la mesa).

| Ruta | Para quién |
|---|---|
| `/` | Landing pública: qué es, cómo funciona y entrada con el código de la mesa |
| `/m/:codigo` | Participante (celular): inscripción, caso, hoja, votación y resultados |
| `/tablero/:sala` | Tablero para el proyector (enlace con token que comparte el facilitador) |
| `/admin` | Panel del facilitador: salas, mesas y QR, rondas, configuración, rúbricas y exportes |

## Stack
Node 24 · Fastify 5 · TypeScript (`tsx`) · SQLite (`node:sqlite`) · React 18 · Vite 6 · react-router 7 · Vitest 3. Tiempo real por polling con ETag. Despliegue con Docker en Coolify (VPS de Hostinger). Detalle en [`docs/STACK.md`](docs/STACK.md).

## Empezar
Requisitos: Node 24 y Git Bash en Windows.

```bash
npm install
npm run dev        # web en http://localhost:5173 con API simulada (mocks)
npm run dev:api    # web + API real con SQLite local
```

Para la API real, crea un `.env` (nunca se sube) con `SUPERADMIN_USUARIO` y `SUPERADMIN_CLAVE`; el superadmin se crea al arrancar sobre una base vacía. Para una sala de prueba:

```bash
npm run seed -- --sala "Taller de prueba" --mesas 3
```

## Pruebas

```bash
bash tools/test.sh   # typecheck + todas las pruebas (servidor, motor, UI y navegador)
```

Las pruebas en navegador necesitan Chromium (`npx playwright-core install chromium-headless-shell`); con `HZ_E2E=0` se omiten. El golden del motor (`tests/golden/motor_golden.json`) debe pasar al 100 %. Simulador de carga: `npm run simular` (40 personas) y `npm run ensayo` (taller completo con cierres programados).

## Despliegue
`tools/deploy.sh verificar | local | staging | produccion`. Producción se despliega a mano (Auto Deploy apagado). Guía completa en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md); pasos pendientes de puesta en marcha en [`docs/ENTREGA.md`](docs/ENTREGA.md).

## Flujo de trabajo
Ramas, commits, pull requests, reglas del contrato y del motor, datos personales y definición de terminado: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Documentación
| Documento | Contenido |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Especificación funcional |
| [`docs/ACTA_2026-10-16.md`](docs/ACTA_2026-10-16.md) | Decisiones del 16-oct que mandan sobre la SPEC |
| [`docs/CONTRATO_API.md`](docs/CONTRATO_API.md) · [`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) | API y base de datos |
| [`docs/DECISIONES.md`](docs/DECISIONES.md) | Registro de decisiones |
| [`docs/DISENO.md`](docs/DISENO.md) | Sistema de diseño |
| [`docs/CONSENTIMIENTO.md`](docs/CONSENTIMIENTO.md) | Aviso de datos por país |
| [`docs/GUIA_FACILITADOR.md`](docs/GUIA_FACILITADOR.md) · [`docs/PLAN_B.md`](docs/PLAN_B.md) | Operación del taller |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) · [`docs/ENTREGA.md`](docs/ENTREGA.md) · [`docs/MIGRACION_GITHUB.md`](docs/MIGRACION_GITHUB.md) | Infraestructura |

---
Estratek S.A.S. · Medellín, Colombia
