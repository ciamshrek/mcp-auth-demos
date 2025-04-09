"use server";
import { IClientInfo } from "@/app/tools/protected-metadata-discovery";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import * as client from "openid-client";

export async function GET(request: NextRequest) {
  const cookie = await cookies();
  const resource = cookie.get("t_resource")?.value;
  const clientInfo = cookie.get("r_" + resource);

  if (!clientInfo) {
    return new NextResponse("Not found", {
      status: 404,
    });
  }

  const parsed: IClientInfo = JSON.parse(clientInfo.value);

  const config = await client.discovery(
    new URL(parsed.authorizationServer),
    parsed.clientId,
    {},
    client.ClientSecretPost(parsed.clientSecret)
  );

  const codeVerifier = cookie.get("t_code_verifier");

  if (!codeVerifier) {
    return new NextResponse("Invalid transaction there was no code_verifier", {
        status: 400
    });
  }

  
  const tokenSet = await client.authorizationCodeGrant(config, new URL(request.nextUrl), {
    idTokenExpected: parsed.protocol === "oidc",
    pkceCodeVerifier: codeVerifier.value,
  });

  if (!tokenSet.access_token) {
    return new NextResponse("Failed to authorize, no access_token", {
        status: 500,
    });
  }

  // We are storing it in cookie for demonstration
  // ideally this should be either encrypted 
  // or stored better
  cookie.set("s_" + resource, JSON.stringify({
    ...tokenSet,
  }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  // Back to chatbot
  return NextResponse.redirect(new URL("/", request.nextUrl));
}
