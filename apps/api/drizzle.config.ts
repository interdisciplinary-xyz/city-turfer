// drizzle-kit: generates versioned SQL migrations from src/db/schema.ts into drizzle/ (committed).
//   pnpm --filter @cityturfer/api run db:generate   # after changing the schema
// Applying them is scripts/db-migrate.ts (`db:migrate`), not drizzle-kit.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
