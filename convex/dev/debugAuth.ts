/**
 * Debug auth accounts to see password hash format
 */

import { query } from "../_generated/server";

export const checkAuthAccounts = query({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("provider"), "password"))
      .take(10);

    return accounts.map((acc) => ({
      provider: acc.provider,
      providerAccountId: acc.providerAccountId,
      secretLength: acc.secret?.length || 0,
      secretPrefix: acc.secret?.substring(0, 20) || "",
      userId: acc.userId,
    }));
  },
});
