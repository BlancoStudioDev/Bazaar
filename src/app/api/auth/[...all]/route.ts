import { getAuth } from "@/lib/auth/auth";

async function handle(request: Request) {
  const auth = getAuth();
  if (!auth) {
    return Response.json({ error: "Autenticazione disabilitata in questo ambiente." }, { status: 404 });
  }
  return auth.handler(request);
}

export { handle as GET, handle as POST };
