# Tests E2E de mobile (Maestro)

Flujos de [Maestro](https://maestro.mobile.dev) para la app Expo (`appId: cl.bnp.farmacias`).

> El archivo se llama `readme.md` (en minúsculas) porque `pnpm check:naming` exige kebab-case en `.maestro/`.

| Flujo                 | Qué valida                                                                                       | Necesita API |
| --------------------- | ------------------------------------------------------------------------------------------------ | :----------: |
| `sign-in-screen.yaml` | La app abre en el catálogo público; «Mi cuenta» → «Iniciar sesión» valida el formulario vacío.   |      No      |
| `sign-in-flow.yaml`   | Credenciales inválidas → mensaje genérico; luego un residente sintético ingresa y cierra sesión. |      Sí      |

## Requisitos

1. Maestro CLI: `curl -fsSL "https://get.maestro.mobile.dev" | bash` (requiere Java 17+).
2. Un simulador iOS o emulador Android encendido.
3. Un build de la app instalado (Expo Go no sirve: el `appId` debe ser el de la app):
   - Development build: `pnpm --filter @repo/mobile ios` o `pnpm --filter @repo/mobile android`.
   - O un build `preview` de EAS instalado en el dispositivo.
4. Para `sign-in-flow.yaml`: el API corriendo (`pnpm dev:services` + `pnpm --filter @repo/server dev`), las
   cuentas sintéticas creadas (`pnpm db:seed`) y `EXPO_PUBLIC_API_URL` apuntando al API (en el emulador
   Android usa `http://10.0.2.2:4000`). No hay registro público: las cuentas son preinscritas.

## Ejecutar

```bash
# Todos los flujos (lee .maestro/config.yaml)
pnpm --filter @repo/mobile test:e2e

# Un flujo
maestro test apps/mobile/.maestro/sign-in-screen.yaml

# Inicio de sesión con otra cuenta sintética de residente
maestro test \
  -e MAESTRO_EMAIL="residente2@demo.farmacia.cl" \
  -e MAESTRO_PASSWORD="Vecino-Demo-2026" \
  apps/mobile/.maestro/sign-in-flow.yaml

# Solo el smoke test (no necesita API)
maestro test --include-tags smoke apps/mobile/.maestro
```

Si no se pasan variables, `sign-in-flow.yaml` usa `residente1@demo.farmacia.cl` con la contraseña
sintética de `apps/server/.env.example` (`SEED_RESIDENT_PASSWORD`).

## Escribir flujos

- Selecciona elementos por `testID` (`id:` en Maestro): `catalog-title`, `catalog-search-input`,
  `nav-catalog`, `nav-cart`, `nav-orders`, `nav-account`, `sign-in-prompt-button`, `sign-in-email`,
  `sign-in-password`, `sign-in-submit`, `sign-in-error`, `account-title`, `profile-name`, `edit-profile`,
  `profile-name-input`, `profile-save`, `sign-out`, `add-to-order`, `cart-checkout`,
  `fulfillment-pickup`, `checkout-confirm`, `pay-approve`, `pay-reject`, `order-timeline`.
- Los textos de la UI están en español; si cambias un texto, actualiza los `assertVisible`.
- Los resultados (capturas, logs) quedan en `.maestro/output/` (ignorado por git).
