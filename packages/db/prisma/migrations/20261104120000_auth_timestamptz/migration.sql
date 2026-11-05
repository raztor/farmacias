-- Better Auth tables to `timestamptz(3)` in UTC, like every domain table (D-23, R-DAT-01).
--
-- The init migration created them as `timestamp(3)` (no time zone). Prisma always wrote them in
-- UTC (createPrismaClient forces `timezone=UTC`), so each stored wall-clock value is a UTC
-- instant. `AT TIME ZONE 'UTC'` converts them explicitly, independent of the session time zone
-- that runs this migration (a plain cast would use it and shift every value).

-- AlterTable
ALTER TABLE "user"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "ban_expires" SET DATA TYPE TIMESTAMPTZ(3) USING "ban_expires" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "session"
  ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "account"
  ALTER COLUMN "access_token_expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "access_token_expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "refresh_token_expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "verification"
  ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
