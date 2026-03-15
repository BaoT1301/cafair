import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

type SecureDbOptions = {
  token?: string | null;
};

/**
 * Get a secure database connection with RLS (Row Level Security) enabled.
 * Uses Clerk JWT token to set the request context for Supabase RLS policies.
 */
export async function getSecureDb(options: SecureDbOptions = {}) {
  const token =
    options.token ?? (await (await auth()).getToken({ template: "supabase" }));

  if (!token) {
    throw new Error("Unauthorized: No Clerk Supabase token found");
  }

  type DbTransaction = Parameters<typeof db.transaction>[0] extends (
    tx: infer T,
  ) => Promise<unknown>
    ? T
    : never;

  return {
    rls: async <T>(
      queryCallback: (tx: DbTransaction) => Promise<T>,
    ): Promise<T> => {
      return await db.transaction(async (tx) => {
        // Set the JWT claims for RLS
        // Using `true` (local=true) scopes the setting to this transaction,
        // so it's automatically cleared on both COMMIT and ROLLBACK.
        await tx.execute(
          sql`select set_config('request.jwt.claims', ${token}, true)`,
        );

        return await queryCallback(tx);
      });
    },
  };
}
