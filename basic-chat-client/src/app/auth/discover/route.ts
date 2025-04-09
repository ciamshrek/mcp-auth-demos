import {
  discoverResource,
  tryRegister,
} from "../../tools/protected-metadata-discovery";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { address } = await req.json();

  if (!address) return new Response("Missing 'address'", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (message: string, rest: Record<string, any> = {}) => {
        controller.enqueue(encoder.encode(`${JSON.stringify({ message, ...rest })}\n`));
      };

      try {
        send(`🔍 Discovering ${address}`);

        const resource = await discoverResource(address);
        send(`✅ Discovered: ${resource.name}`);

        send(`🔐 Trying OIDC registration...`);

        let instance;
        let protocol: "oidc" | "oauth2";
        try {
          instance = await tryRegister(resource.authorizationServer, "oidc");
          protocol = "oidc";
          send(`✅ OIDC registration succeeded.`);
        } catch {
          send(`⚠️ OIDC failed, trying OAuth2...`);
          instance = await tryRegister(resource.authorizationServer, "oauth2");
          protocol = "oauth2";
          send(`✅ OAuth2 registration succeeded.`);
        }

        const clientMetadata = instance.clientMetadata();
        const { client_secret: clientSecret } = clientMetadata;

        const serverMetadata = instance.serverMetadata();
        const { scopes_supported: authzServerScopesSupported } = serverMetadata;

        let scopesSupported =
          resource.scopesSupported || authzServerScopesSupported;

        if (!scopesSupported) {
          throw new Error("Could not establish which scopes to use");
        }

        if (
          protocol === "oidc" &&
          (!scopesSupported || scopesSupported.includes("openid") !== true)
        ) {
          scopesSupported = [
            ...new Set(["openid", "profile", ...scopesSupported]),
          ];
        }

        if (!clientSecret) {
          throw new Error(
            "Client Secret was not provided in the registration metadata"
          );
        }

        send(`🎉 Done.`, {
          ...resource,
          clientId: clientMetadata.client_id,
          clientSecret: clientMetadata.client_secret,
          protocol,
          scopesSupported,
        });
      } catch (err: any) {
        send(`❌ Install failed: ${err.message || err}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}