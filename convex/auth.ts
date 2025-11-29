import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: Email({
        id: "password-reset",
        apiKey: process.env.EMAIL_API_KEY!,
        from: process.env.EMAIL_FROM || "onboarding@resend.dev",
        maxAge: 60 * 15, // 15 minutes
        // Skip email verification check - token is enough (magic link behavior)
        authorize: undefined,
        async sendVerificationRequest({ identifier: email, provider, token }) {
          // Use hash routing format since the app uses HashRouter
          // Include email in URL to help with password reset flow
          const url = `${process.env.SITE_URL}/#/reset-password?code=${token}&email=${encodeURIComponent(email)}`;

          // Use fetch to call Resend API directly (works in Convex actions)
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${provider.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: provider.from,
              to: email,
              subject: "Reset your password",
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Reset your password</h2>
                  <p>Click the link below to reset your password:</p>
                  <a href="${url}" style="display: inline-block; background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Reset Password</a>
                  <p>Or copy and paste this link into your browser:</p>
                  <p style="color: #666;">${url}</p>
                  <p style="color: #999; font-size: 14px; margin-top: 32px;">This link will expire in 15 minutes.</p>
                </div>
              `,
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to send email: ${error}`);
          }
        },
      }),
    })
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // Automatically create a profile when a new user is created
      if (!existingUserId) {
        // New user - check if profile exists, if not create a default one
        const existingProfile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique();

        if (!existingProfile) {
          // Get user info from auth tables
          const user = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("_id"), userId))
            .unique();

          await ctx.db.insert("profiles", {
            userId: userId,
            email: user?.email ?? "",
            fullName: user?.name ?? "Traveler",
            role: "customer", // Default role
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    },
  },
});
