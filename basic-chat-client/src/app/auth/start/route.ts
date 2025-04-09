"use server";
import { IClientInfo } from "@/app/tools/protected-metadata-discovery";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as client from "openid-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const cookie = await cookies();

  if (!resource) {
    return new NextResponse("Bad Request", {
        status: 400,
      });
  }

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

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

  const url = client.buildAuthorizationUrl(config, {
    scope: parsed.scopesSupported.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: "http://localhost:3000/auth/callback",
    // @todo: identify the ideal outcome here
    audience: parsed.resource,
    resource: parsed.resource,
  });

  // Store verifier + issuer in secure cookies
  cookie.set("t_code_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  // Set transaction resource
  cookie.set("t_resource", resource, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return NextResponse.redirect(url);
}
