# Instructions for AI coding agents

This is the "Farmacia Comunitaria Peñalolén" MVP (https://github.com/raztor/farmacias): a pnpm 12 + Turborepo 2 TypeScript monorepo (Fastify + tRPC API, BullMQ worker, Next.js admin backoffice, Expo universal resident app for iOS/Android/web, Playwright E2E in `apps/e2e`, shared NativeWind UI). There is no Next.js public web app: the resident web client is the Expo web export (see `docs/adr/0002-clientes-expo-universal-y-admin.md`). Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for package APIs and [docs/REPO_RULES.md](docs/REPO_RULES.md) for the rules before changing code.

## Task tracking (mandatory)

All work is tracked on the GitHub Project <https://github.com/users/raztor/projects/8> (repo issues in `raztor/farmacias`).

- **Before starting a task**, find its issue (story `HU-xx`, task `T-xx`, or create one) and move it to **In progress** on the board. Never work on something that is not on the board.
- **Keep the board updated at every step**: `In progress` while working → `In review` when its PR is open → `Done` only after the PR is merged and the Product Owner accepts it. If it gets blocked, say so on the issue.
- **Comment on the issue as you advance**: what was done, evidence (tests, screenshots, commands), decisions taken, and what is next. One comment per meaningful step, not only at the end.
- Reference the issue in commits and PRs (`Refs #N` while working, `Closes #N` in the PR).

Useful commands:

```bash
gh issue comment <N> -R raztor/farmacias --body "Avance: ..."
gh project item-list 8 --owner raztor --format json   # find the item id
gh project item-edit --project-id PVT_kwHOBDwHKs4Bp7cv --id <ITEM_ID> \
  --field-id PVTSSF_lAHOBDwHKs4Bp7cvzhoUzkc --single-select-option-id <OPTION_ID>
```

Status option ids: Backlog `e8fe2f38` · Ready `a5b77d0c` · In progress `d8c1c3ec` · In review `2ca5965c` · Done `a323e7b3`.

## Must do

- Read `docs/REPO_RULES.md` before your first edit, and the `package.json#exports` of any `@repo/*` package you use.
- Run `pnpm check` before you finish. For a single workspace: `pnpm turbo run lint typecheck test --filter=@repo/<name>`.
- Keep files small: 300 lines per file, 60 per function, complexity 12, depth 4, 4 params, 3 nested callbacks, max 2 levels of `../`. When a limit is hit, split the file.
- Validate every external input (HTTP, env, jobs, forms) with zod. Read env vars only in `env.ts` / config files.
- Follow the folder anatomy: API modules (`router → service → repository`) and app features (`src/features/<feature>/index.ts`).
- Use Conventional Commits with a workspace scope, e.g. `feat(api): add invoice module`.
- Code, identifiers and comments in English; docs and user-facing UI copy in Spanish (Chile).

## Never do

- Never bypass limits or checks: no `eslint-disable`, `@ts-ignore`, `any`, `--no-verify`, or loosening configs in `tooling/`.
- Never add a dependency outside the catalog in `pnpm-workspace.yaml`; workspaces use `"catalog:"` / `"workspace:*"`. New deps need a justification in the PR.
- No `console.*` (use the pino logger), no `enum` (use `as const`), no `export *`, no default exports (except framework files), no `interface` (use `type`), no path aliases like `@/`.
- Never import `@repo/x/src/...`, another app, or tests/stories from production code.
- Never commit `.env` files or secrets.
- Library versions are newer than your training data: read the installed package types/docs instead of guessing APIs.

Changing a rule requires an ADR in `docs/adr/` (see `docs/adr/README.md`).
