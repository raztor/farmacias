# Infraestructura de pre-producción (Azure, rama `QA`)

Bicep y scripts del ambiente de pre-producción descrito en [`docs/azure/README.md`](../docs/azure/README.md). Todo se crea en el resource group `rg-farmacia-bm` (región de los recursos: East US 2). `main` queda reservada para producción, que tendrá su propio resource group.

## Archivos

| Archivo                                                                    | Contenido                                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`main.bicep`](./main.bicep)                                               | Orquesta los módulos y define los nombres de los recursos.                 |
| [`main.bicepparam`](./main.bicepparam)                                     | Parámetros; los secretos se leen desde variables de entorno.               |
| [`modules/network.bicep`](./modules/network.bicep)                         | VNet, subredes (`snet-aca`, `snet-psql`, `snet-pe`) y zonas DNS privadas.  |
| [`modules/monitoring.bicep`](./modules/monitoring.bicep)                   | Log Analytics con tope diario de 0.2 GB.                                   |
| [`modules/security.bicep`](./modules/security.bicep)                       | Identidad gestionada de las apps y Key Vault (RBAC).                       |
| [`modules/postgres.bicep`](./modules/postgres.bicep)                       | PostgreSQL Flexible B1ms privado, base `app`, extensión `pg_trgm`.         |
| [`modules/redis.bicep`](./modules/redis.bicep)                             | Azure Managed Redis B0 (`NoCluster`, `NoEviction`) con endpoint privado.   |
| [`modules/email.bicep`](./modules/email.bicep)                             | Communication Services Email con dominio de Azure y usuario SMTP.          |
| [`modules/secrets.bicep`](./modules/secrets.bicep)                         | Escribe en Key Vault las URLs de conexión y los secretos.                  |
| [`modules/container-env.bicep`](./modules/container-env.bicep)             | Entorno de Container Apps (Consumption) dentro de la VNet.                 |
| [`modules/apps.bicep`](./modules/apps.bicep)                               | server, worker, admin, web y los jobs de migración y seed.                 |
| [`modules/container-app.bicep`](./modules/container-app.bicep)             | Plantilla de una container app.                                            |
| [`modules/container-job.bicep`](./modules/container-job.bicep)             | Plantilla de un job manual.                                                |
| [`modules/budget.bicep`](./modules/budget.bicep)                           | Presupuesto mensual de US$ 80 con alertas a los dueños de la suscripción.  |
| [`scripts/bootstrap.sh`](./scripts/bootstrap.sh)                           | Preparación única: secretos, apps de Entra, OIDC, ambiente `qa` de GitHub. |
| [`scripts/deploy.sh`](./scripts/deploy.sh)                                 | `what-if` (vista previa) o `apply` del Bicep.                              |
| [`scripts/run-job.sh`](./scripts/run-job.sh)                               | Ejecuta un job (migraciones, seed) y espera el resultado.                  |
| [`../.github/workflows/deploy-qa.yml`](../.github/workflows/deploy-qa.yml) | Build y despliegue en cada push a `QA`.                                    |

## Requisitos

- `az` con sesión en la suscripción de destino (`az account show`) y rol Owner (o Contributor + User Access Administrator) sobre `rg-farmacia-bm`, porque el Bicep crea asignaciones de roles.
- Permiso para crear aplicaciones en Entra ID.
- `gh` con permisos de administración sobre `raztor/farmacias`.
- `openssl`.

## Primer despliegue

1. **Preparar** (una vez):

   ```bash
   infra/scripts/bootstrap.sh
   ```

   Genera `infra/.env.qa` con contraseñas y secretos aleatorios (`chmod 600`, ignorado por git). Guarda una copia en un lugar seguro: si se pierde, hay que rotar las credenciales. También crea las apps de Entra para SMTP y para GitHub Actions (credencial federada solo para el ambiente `qa`, que solo acepta la rama `QA`), el ambiente `qa` de GitHub con sus variables, y registra el proveedor `Microsoft.Cache`.

2. **Construir las imágenes:** hacer push o merge a `QA`. El job `build` de `deploy-qa.yml` publica las 5 imágenes en GHCR con el SHA del commit. Como la infraestructura todavía no existe, el job `deploy` termina con un aviso y sin desplegar.

3. **Hacer públicos los paquetes de GHCR:** GitHub crea los paquetes como privados. En _Packages_ de la organización, cambia la visibilidad de `farmacias-server`, `-worker`, `-admin`, `-mobile-web` y `-migrate` a pública. Si deben seguir privados, define `REGISTRY_USERNAME` y `REGISTRY_PASSWORD` (token con `read:packages`) en `infra/.env.qa`.

4. **Revisar y aplicar:**

   ```bash
   IMAGE_TAG=<sha> infra/scripts/deploy.sh what-if
   ```

   ```bash
   IMAGE_TAG=<sha> infra/scripts/deploy.sh apply
   ```

   La primera vez tarda ~20–30 min (Redis y PostgreSQL son lo más lento). Al terminar imprime las URLs de la app web y del backoffice.

5. **Migrar y cargar datos de demo:**

   ```bash
   infra/scripts/run-job.sh caj-farm-migrate
   ```

   ```bash
   infra/scripts/run-job.sh caj-farm-seed
   ```

   El seed es idempotente. Las contraseñas de las cuentas de demo están en `infra/.env.qa` (`SEED_*_PASSWORD`).

Desde ahí, cada push a `QA` construye, migra y actualiza las apps sin intervención manual.

## Operación

- **Cambiar la infraestructura:** edita el Bicep y ejecuta `infra/scripts/deploy.sh what-if` y luego `apply`. Sin `IMAGE_TAG`, el script usa la imagen que ya corre en `ca-farm-server`, así que no hace rollback de las apps.
- **Modo demo (sin arranques en frío):** `DEMO_MODE=true infra/scripts/deploy.sh apply` deja 1 réplica de server, admin y web siempre encendida (~US$ 15–25/mes extra). Para volver al modo ahorro, aplica de nuevo sin la variable.
- **Logs:** `az containerapp logs show -g rg-farmacia-bm -n ca-farm-server --follow`, o la tabla `ContainerAppConsoleLogs_CL` en `log-farmacia-bm`.
- **Rotar un secreto:** cambia el valor en `infra/.env.qa`, ejecuta `apply` y reinicia la revisión de las apps afectadas (`az containerapp revision restart`). Para el secreto SMTP, crea uno nuevo con `az ad app credential reset --id <SMTP_ENTRA_APP_ID> --append` y reemplaza `SMTP_CLIENT_SECRET`.
- **Costos:** el presupuesto `budget-farmacia-bm` avisa a los dueños de la suscripción al 50, 80 y 100 % de US$ 80 (y cuando el pronóstico supera el 100 %).

## Decisiones de esta configuración

- **Una réplica máxima del server:** B1ms admite ~35 conexiones de usuario. Con una réplica, los pools de server, worker y jobs quedan bajo ese límite.
- **Redis sin alta disponibilidad:** reduce el costo a la mitad. En pre-producción se acepta perder jobs en cola si Azure reinicia el nodo.
- **`sslmode=require` en `DATABASE_URL`:** lo entienden tanto `pg` (server, worker) como el CLI de Prisma (migraciones).
- **SMTP en el puerto 587 con STARTTLS:** es lo que ofrece `smtp.azurecomm.net`. El remitente es `DoNotReply@<dominio>.azurecomm.net`.
- **Contributor sobre el RG para GitHub Actions:** basta para actualizar apps y ejecutar jobs. Las asignaciones de roles solo las crea quien ejecuta `deploy.sh apply`.
