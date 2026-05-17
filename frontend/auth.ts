import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Providing explicit endpoints bypasses OIDC discovery, which avoids
      // oauth4webapi v3 failing on Google's missing "iss" in auth responses
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      return profile?.email?.endsWith("@orcanos.com") ?? false;
    },
  },
  pages: {
    signIn: "/login",
  },
});
