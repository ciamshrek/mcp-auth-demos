import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const ClientInfoSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  protocol: z.enum(["oidc", "oauth2"]),
  scopesSupported: z.array(z.string()),
  name: z.string(),
  authorizationServer: z.string(),
  resource: z.string(),
});

export type ClientInfo = z.infer<typeof ClientInfoSchema>;

export async function POST(req: Request) {
  const cookie = await cookies();
  const body = await req.json();
  const clientInfo = ClientInfoSchema.parse(body);
  cookie.set("r_" + clientInfo.resource, JSON.stringify(clientInfo), {
    httpOnly: true,
  });

  return NextResponse.json(
    { message: "ok" },
    {
      status: 200,
    }
  );
}
