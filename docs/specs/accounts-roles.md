# Cuentas y roles

> Módulo: `packages/auth` (Better Auth), `packages/api/src/trpc` (guardas), `packages/api/src/modules/admin` (usuarios y roles), `packages/shared` (roles) · Historias: HU-02 · Issues: #11, #26 · Estado: Borrador v1 (Sprint 1)

## 1. Propósito

Autenticar cuentas **sintéticas preinscritas** y aplicar permisos por rol, para habilitar los flujos privados sin incorporar inscripción documental (Inception §4.1 punto 2, §5.1).

## 2. Actores y roles

| Rol        | App de vecinos (`apps/mobile`)                                   | Backoffice (`apps/admin`)               |
| ---------- | ---------------------------------------------------------------- | --------------------------------------- |
| anónimo    | Catálogo público; inicio de sesión                               | Solo inicio de sesión                   |
| `resident` | Pedido, pago simulado, seguimiento                               | “Sin acceso” (no ve la bandeja)         |
| `operator` | Aviso «esta app es para personas inscritas»; no entra (R-ACC-11) | Bandeja y detalle; transiciones físicas |
| `admin`    | Igual que `operator`                                             | Todo lo anterior + Usuarios + Auditoría |

## 3. Reglas de negocio

1. **R-ACC-01.** Roles cerrados: `resident` (por defecto), `operator`, `admin`, definidos una sola vez en `@repo/shared` (`ROLES`, `ROLE_VALUES`, `isRole`) como `as const`. _(RF-03, D-06)_
2. **R-ACC-02.** No existe registro público: `emailAndPassword.disableSignUp = true` y ningún cliente ofrece “Crear cuenta”. Las cuentas se crean con el seed (`residente1..3@demo.farmacia.cl`, `operador@demo.farmacia.cl`, `admin@demo.farmacia.cl`), con contraseñas tomadas de variables `SEED_*` y valores sintéticos de desarrollo solo en `.env.example`. _(RF-03, §5.1, D-07, RNF-06)_
3. **R-ACC-03.** Con credenciales válidas se inicia sesión con los permisos del rol de la cuenta (cookie de sesión de Better Auth con prefijo `bnp`). _(HU-02 criterio 1)_
4. **R-ACC-04.** Con credenciales inválidas (correo inexistente, contraseña incorrecta o ambos) se muestra **el mismo** mensaje genérico, sin revelar qué dato falló, y el formulario conserva el correo para reintentar. _(HU-02 criterio 2, RNF-09, D-07)_
5. **R-ACC-05.** Toda operación de administración, inventario o cambio de estado exige sesión y rol, verificado **en el servidor** por el tipo de procedimiento (ver [convenciones](./README.md#roles-y-tipos-de-procedimiento)); ocultar un botón en el cliente no es una medida de seguridad. _(RNF-05)_
6. **R-ACC-06.** Sin sesión → `UNAUTHORIZED`; con sesión pero rol no permitido → `FORBIDDEN`. _(RNF-05, HU-07 criterio 2)_
7. **R-ACC-07.** El backoffice solo admite `operator` y `admin`; un `resident` que inicia sesión ve una página “Sin acceso” con la salida a la app de vecinos. Las secciones Usuarios y Auditoría solo las ve `admin`. _(RF-03, RNF-05)_
8. **R-ACC-08.** Solo `admin` cambia roles (`admin.setRole`) entre `resident`, `operator` y `admin`. Un administrador no puede quitarse su propio rol de administrador. Cada cambio escribe `AuditLog` `user.role_change` con rol anterior y nuevo, en la misma transacción. _(RNF-05, RNF-07, D-22)_
9. **R-ACC-09.** En producción el inicio de sesión tiene _rate limiting_ (almacenado en base de datos) y la sesión no se registra en logs. _(RNF-05, RNF-06)_
10. **R-ACC-10.** El flujo de correo de bienvenida al registrarse se retira del producto (no hay registro). La infraestructura de colas se conserva para notificaciones futuras (fuera del Must). _(D-07)_
11. **R-ACC-11.** La app de vecinos es solo para `resident`. Si una cuenta `operator` o `admin` inicia sesión con credenciales válidas, la app cierra de inmediato esa sesión y muestra «Esta app es para personas inscritas. Si trabajas en la farmacia, ingresa al sistema de administración desde un computador.» Una sesión guardada cuyo rol cambió a operativo vuelve a la pantalla de inicio de sesión. Las cuentas con rol desconocido o vacío se tratan como `resident` (el menor privilegio). _(RF-03, RNF-05, decisión de T-03)_
12. **R-ACC-12.** La API lee la sesión y el rol **desde la base de datos en cada llamada tRPC** (sin la caché de sesión en cookie de 5 minutos): un cambio de rol o una sesión revocada se aplica en la siguiente llamada. Si Better Auth guarda varios roles (`"resident,operator"`), vale el de mayor privilegio (`toRole`). _(RNF-05)_

### Matriz de permisos por rol

Definida una sola vez en `@repo/shared` (`PERMISSION_STATEMENTS`, `ROLE_PERMISSIONS`, `can(role, recurso, acción)`) y registrada en el control de acceso del plugin `admin` de Better Auth (`@repo/auth`: `accessControl`, `AUTH_ROLES`), junto a los permisos propios del plugin (`user`, `session`), que solo tiene `admin`. Las guardas tRPC aplican la misma matriz por tipo de procedimiento (un test verifica que coinciden).

| Recurso: acción                            | anónimo | `resident` | `operator` | `admin` | Procedimiento        |
| ------------------------------------------ | :-----: | :--------: | :--------: | :-----: | -------------------- |
| Catálogo: buscar y ver                     |   ✅    |     ✅     |     ✅     |   ✅    | `publicProcedure`    |
| `order`: create, read-own, pay, cancel-own |    —    |     ✅     |     —      |    —    | `residentProcedure`  |
| `operations`: read, transition             |    —    |     —      |     ✅     |   ✅    | `operatorProcedure`  |
| `users`: list, set-role                    |    —    |     —      |     —      |   ✅    | `adminProcedure`     |
| `audit`: read                              |    —    |     —      |     —      |   ✅    | `adminProcedure`     |
| Better Auth `/admin/*` (`user`, `session`) |    —    |     —      |     —      |   ✅    | endpoints del plugin |

## 4. Estados y transiciones

No aplica. (Una cuenta puede quedar bloqueada con `banned` del plugin `admin`, pero bloquear cuentas no es parte del Must.)

## 5. API

Better Auth (HTTP, no tRPC):

| Endpoint                       | Acceso  | Entrada               | Salida                      | Errores                                      |
| ------------------------------ | ------- | --------------------- | --------------------------- | -------------------------------------------- |
| `POST /api/auth/sign-in/email` | público | `{ email, password }` | sesión + cookie             | `401` genérico (el cliente muestra R-ACC-04) |
| `POST /api/auth/sign-out`      | sesión  | —                     | `{ success: true }`         | —                                            |
| `GET /api/auth/get-session`    | público | cookie                | `{ session, user } \| null` | —                                            |
| `POST /api/auth/sign-up/email` | —       | —                     | deshabilitado               | error (registro deshabilitado)               |

tRPC:

| Procedimiento     | Tipo     | Acceso  | Entrada                                                         | Salida                               | Errores                                                                                     |
| ----------------- | -------- | ------- | --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `user.me`         | query    | sesión  | —                                                               | `{ id, email, name, role }`          | `UNAUTHORIZED`                                                                              |
| `admin.listUsers` | query    | `admin` | `{ search?: string (0..100), cursor?, limit? }`                 | `{ items: AdminUser[], nextCursor }` | `UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`                                                  |
| `admin.setRole`   | mutation | `admin` | `{ userId: string, role: "resident" \| "operator" \| "admin" }` | `AdminUser`                          | `UNAUTHORIZED`, `FORBIDDEN` (no admin o quitarse su propio rol), `NOT_FOUND`, `BAD_REQUEST` |

Guardas exportadas por `packages/api/src/trpc`: `publicProcedure`, `protectedProcedure`, `residentProcedure`, `operatorProcedure`, `adminProcedure`. El contexto de todo procedimiento con sesión incluye `ctx.role` (rol efectivo). Helpers puros en `@repo/shared`: `isRole`, `toRole(valor)` (normaliza; desconocido → `resident`), `isResident`, `isOperational` (operator o admin), `isAdmin`, `can(role, recurso, acción)`, `ROLE_LABELS` (Persona inscrita, Operario, Administrador) y los mensajes `INVALID_CREDENTIALS_MESSAGE`, `RESIDENT_APP_ONLY_MESSAGE`, `BACKOFFICE_ONLY_MESSAGE`.

## 6. Datos

Tablas de Better Auth (`user`, `session`, `account`, `verification`, `rate_limit`) con los campos del plugin `admin` (`role`, `banned`, `ban_reason`, `ban_expires`, `impersonated_by`). `user.role` guarda uno de `ROLE_VALUES`; el valor por defecto es `resident`. Las contraseñas solo existen como hash en `account`.

## 7. Casos de prueba

| ID      | Nivel      | Caso                                                                                                                              | Criterio cubierto  | Archivo esperado                                                                                                                                     |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACC-U01 | unit       | Helpers de rol (`isRole`, `toRole`, `isResident`, `isOperational`, `isAdmin`) y matriz de permisos (`can`) para cada rol          | R-ACC-01, R-ACC-12 | `packages/shared/src/roles.test.ts`, `packages/shared/src/permissions.test.ts`                                                                       |
| ACC-U02 | unit       | Matriz guardas × rol: anónimo/resident/operator/admin contra cada tipo de procedimiento → permitido, `UNAUTHORIZED` o `FORBIDDEN` | HU-02 #1, R-ACC-06 | `packages/api/src/trpc/procedures.test.ts`                                                                                                           |
| ACC-U03 | unit       | `admin.setRole`: cambia rol, escribe auditoría, impide quitarse el propio rol, `NOT_FOUND`                                        | R-ACC-08           | `packages/api/src/modules/admin/admin.service.test.ts`                                                                                               |
| ACC-U04 | unit       | Router `admin.*` con `operator` y `resident` → `FORBIDDEN`                                                                        | R-ACC-07           | `packages/api/src/modules/admin/admin.router.test.ts`                                                                                                |
| ACC-U05 | unit       | `createAuth` deshabilita el registro (`sign-up/email` → 400) y el plugin `admin` respeta los roles (`userHasPermission`)          | R-ACC-02, R-ACC-08 | `packages/auth/src/create-auth.test.ts`, `packages/auth/src/access-control.test.ts`                                                                  |
| ACC-U06 | unit       | Clientes: el mapeo de errores de inicio de sesión produce un único mensaje genérico                                               | HU-02 #2           | `packages/shared/src/auth-messages.test.ts`, `apps/admin/src/features/auth/auth-errors.test.ts`, `apps/mobile/src/features/auth/auth-errors.test.ts` |
| ACC-U07 | unit       | Acceso al backoffice: `resident` → “Sin acceso”; Usuarios/Auditoría solo `admin`                                                  | R-ACC-07           | `apps/admin/src/lib/admin-access.test.ts`, `apps/admin/src/lib/nav-items.test.ts`                                                                    |
| ACC-U08 | unit       | App de vecinos solo para `resident` (operativos reciben el aviso)                                                                 | R-ACC-11           | `apps/mobile/src/features/auth/resident-access.test.ts`, `apps/mobile/src/features/auth/auth-errors.test.ts`                                         |
| ACC-U09 | unit       | Seed de cuentas idempotente: crea las 5 cuentas, no duplica y restaura un rol alterado sin tocar la contraseña                    | R-ACC-02           | `apps/server/src/scripts/seed-accounts.test.ts`                                                                                                      |
| ACC-U10 | unit       | El contexto tRPC lee la sesión sin caché de cookie                                                                                | R-ACC-12           | `packages/api/src/trpc/context.test.ts`                                                                                                              |
| ACC-E01 | e2e        | Inicio de sesión válido en admin y en la web de la app                                                                            | HU-02 #1           | `apps/e2e/src/admin/sign-in.spec.ts`, `apps/e2e/src/mobile-web/sign-in.spec.ts`                                                                      |
| ACC-E02 | e2e        | Credenciales inválidas → mensaje genérico, sin indicar el campo                                                                   | HU-02 #2           | `apps/e2e/src/admin/sign-in.spec.ts`, `apps/e2e/src/mobile-web/sign-in.spec.ts`                                                                      |
| ACC-E03 | e2e        | `resident` no puede abrir el backoffice                                                                                           | HU-07 #2           | `apps/e2e/src/admin/access-denied.spec.ts`                                                                                                           |
| ACC-M01 | e2e nativo | Maestro: pantalla de inicio de sesión (sin registro)                                                                              | HU-02 #1           | `apps/mobile/.maestro/sign-in-screen.yaml`                                                                                                           |
| ACC-M02 | e2e nativo | Maestro: credenciales inválidas → mensaje genérico; residente sintético inicia y cierra sesión                                    | HU-02 #1, #2       | `apps/mobile/.maestro/sign-in-flow.yaml`                                                                                                             |

## 8. Trazabilidad

| Requisito | Historia     | Reglas                       | Pruebas                            |
| --------- | ------------ | ---------------------------- | ---------------------------------- |
| RF-03     | HU-02        | R-ACC-01..04, R-ACC-07       | ACC-U01, ACC-U02, ACC-U07, ACC-E01 |
| RNF-05    | HU-02, HU-07 | R-ACC-05, R-ACC-06, R-ACC-08 | ACC-U02..U04, ACC-E03              |
| RNF-06    | HU-02        | R-ACC-02, R-ACC-09           | revisión de seed y `.env.example`  |
| RNF-07    | HU-02        | R-ACC-08                     | ACC-U03                            |
| RNF-09    | HU-02        | R-ACC-04                     | ACC-U06, ACC-E02                   |
