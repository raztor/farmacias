/**
 * Integration-test harness of `@repo/api` (PostgreSQL). Only `*.int.test.ts` files import it.
 * How to run: docs/REPO_RULES.md §8.1.
 */
export {
  createOrder,
  createPayment,
  createProduct,
  createUser,
  setStock,
  type OrderLineInput,
  type OrderOverrides,
  type OrderWithLines,
  type PaymentOverrides,
  type ProductOverrides,
  type ProductWithInventory,
  type UserOverrides,
} from "./factories";
export {
  INTEGRATION_ENABLED,
  INTEGRATION_SKIP_REASON,
  disconnectTestDb,
  getIntegrationDatabaseUrl,
  getTestDb,
  resetDatabase,
} from "./test-db";
export { listMigrationNames } from "./db-package";
