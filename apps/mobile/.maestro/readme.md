# Tests E2E de mobile (Maestro)

Flujos de [Maestro](https://maestro.mobile.dev) para la app Expo (`appId: cl.bnp.farmacias`).

> El archivo se llama `readme.md` (en minúsculas) porque `pnpm check:naming` exige kebab-case en `.maestro/`.

| Flujo                 | Qué valida                                                                       | Necesita API |
| --------------------- | -------------------------------------------------------------------------------- | :----------: |
| `sign-in-screen.yaml` | La app abre en «Iniciar sesión» y muestra errores de validación al enviar vacío. |      No      |
| `sign-up-flow.yaml`   | Registro con nombre, correo y contraseña, llega al inicio y cierra sesión.       |      Sí      |

## Requisitos

1. Maestro CLI: `curl -fsSL "https://get.maestro.mobile.dev" | bash` (requiere Java 17+).
2. Un simulador iOS o emulador Android encendido.
3. Un build de la app instalado (Expo Go no sirve: el `appId` debe ser el de la app):
   - Development build: `pnpm --filter @repo/mobile ios` o `pnpm --filter @repo/mobile android`.
   - O un build `preview` de EAS instalado en el dispositivo.
4. Para `sign-up-flow.yaml`: el API corriendo (`pnpm dev:services` + `pnpm --filter @repo/server dev`) y
   `EXPO_PUBLIC_API_URL` apuntando a él (en el emulador Android usa `http://10.0.2.2:4000`).

## Ejecutar

```bash
# Todos los flujos (lee .maestro/config.yaml)
pnpm --filter @repo/mobile test:e2e

# Un flujo
maestro test apps/mobile/.maestro/sign-in-screen.yaml

# Registro con datos propios (el correo debe ser único y en minúsculas)
maestro test \
  -e MAESTRO_NAME="Ana Pérez" \
  -e MAESTRO_EMAIL="ana+$(date +%s)@example.cl" \
  -e MAESTRO_PASSWORD="una-clave-segura" \
  apps/mobile/.maestro/sign-up-flow.yaml

# Solo el smoke test (no necesita API)
maestro test --include-tags smoke apps/mobile/.maestro
```

Si no se pasan variables, `sign-up-flow.yaml` usa un correo único generado con `Date.now()`.

## Escribir flujos

- Selecciona elementos por `testID` (`id:` en Maestro): `sign-in-email`, `sign-in-password`, `sign-in-submit`,
  `sign-up-name`, `sign-up-email`, `sign-up-password`, `sign-up-submit`, `home-title`, `edit-profile`,
  `profile-name-input`, `profile-save`, `sign-out`.
- Los textos de la UI están en español; si cambias un texto, actualiza los `assertVisible`.
- Los resultados (capturas, logs) quedan en `.maestro/output/` (ignorado por git).
