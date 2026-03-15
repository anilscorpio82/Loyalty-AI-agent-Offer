import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "testuser" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // In a real Fortune 500 app, this connects to Auth0 or AWS Cognito.
        // For this local MVP demo, we simply issue a secure JWT for any user
        if (credentials?.username) {
          // The ID we return here becomes the secure subject in the JWT token (acting as our Vault ID proxy)
          return { id: `member_${credentials.username.replace(/\s+/g, '').toLowerCase()}`, name: credentials.username, email: `${credentials.username}@example.com` }
        }
        return null
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "loyalty-agent-super-secret-key-12345",
})

export { handler as GET, handler as POST }
