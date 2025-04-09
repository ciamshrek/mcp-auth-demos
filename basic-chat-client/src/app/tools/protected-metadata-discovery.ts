import * as client from "openid-client";

function getBaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

/**
 * Represents the metadata for an OAuth 2.0 protected resource, as defined in
 * https://datatracker.ietf.org/doc/draft-ietf-oauth-resource-metadata/13/
 */
interface OAuthProtectedResourceMetadata {
  /**
   * REQUIRED. The protected resource's identifier.
   * This must be a URL using the HTTPS scheme, without query or fragment components.
   */
  resource: string;

  /**
   * OPTIONAL. List of OAuth authorization server issuer identifiers that can be used with this resource.
   * These are typically URLs as defined in RFC 8414.
   */
  authorization_servers?: string[];

  /**
   * OPTIONAL. The URL of the protected resource’s JSON Web Key (JWK) Set document.
   * This contains public keys used for signing or encryption. The "use" parameter is required for each key.
   */
  jwks_uri?: string;

  /**
   * RECOMMENDED. A list of scope strings supported by the protected resource.
   * These scope values can be requested in authorization requests.
   */
  scopes_supported?: string[];

  /**
   * OPTIONAL. Indicates the supported methods for sending OAuth 2.0 Bearer tokens to the resource.
   * Values include: "header", "body", and "query" (per RFC 6750).
   */
  bearer_methods_supported?: Array<"header" | "body" | "query">;

  /**
   * OPTIONAL. A list of supported JWS algorithms used to sign resource responses.
   * Must not include "none".
   */
  resource_signing_alg_values_supported?: string[];

  /**
   * RECOMMENDED. A human-readable name for the resource, intended for display to end-users.
   * May be internationalized.
   */
  resource_name?: string;

  /**
   * OPTIONAL. A URL to developer documentation for the protected resource.
   * Intended to help developers understand how to interact with the API. May be internationalized.
   */
  resource_documentation?: string;

  /**
   * OPTIONAL. A URL to human-readable policy information about how the client may use the data.
   * May be internationalized.
   */
  resource_policy_uri?: string;

  /**
   * OPTIONAL. A URL to the resource’s terms of service.
   * May be internationalized.
   */
  resource_tos_uri?: string;

  /**
   * OPTIONAL. Indicates whether the resource supports mutual-TLS client certificate-bound access tokens.
   * Defaults to false if omitted.
   */
  tls_client_certificate_bound_access_tokens?: boolean;

  /**
   * OPTIONAL. A list of supported `type` values for authorization details, as defined in RFC 9396.
   */
  authorization_details_types_supported?: string[];

  /**
   * OPTIONAL. A list of supported JWS algorithms for verifying DPoP proof JWTs (RFC 9449).
   */
  dpop_signing_alg_values_supported?: string[];

  /**
   * OPTIONAL. Indicates whether the resource *requires* DPoP-bound access tokens for all requests.
   * Defaults to false if omitted.
   */
  dpop_bound_access_tokens_required?: boolean;

  /**
   * OPTIONAL. Allows custom metadata fields beyond those defined in the specification.
   */
  [key: string]: unknown;
}

async function fetchMetadata(
  url: string
): Promise<OAuthProtectedResourceMetadata> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch metadata from ${url}: ${response.statusText}`
    );
  }
  return response.json();
}

async function discoverProtectedResourceMetadata(
  resourceUrl: string
): Promise<OAuthProtectedResourceMetadata> {
  const metadataUrl = `${getBaseUrl(
    resourceUrl
  )}/.well-known/oauth-protected-resource`;
  const resourceMetadata = await fetchMetadata(metadataUrl);

  if (resourceMetadata.resource !== resourceUrl) {
    throw new Error("Resource does not match metadata in origin");
  }

  return resourceMetadata;
}

/**
 * This performs and converts into a resource
 * our MCP Client can understand.
 *
 * @param resourceUrl
 */
export async function discoverResource(resourceUrl: string) {
  const resourceMetadata = await discoverProtectedResourceMetadata(resourceUrl);

  const {
    scopes_supported: scopesSupported,
    authorization_servers: authorizationServers,
    resource,
    bearer_methods_supported: methodsSupported,
    resource_name: resourceName,
  } = resourceMetadata;

  if (!authorizationServers) {
    throw new Error(
      "This resource server metadata does not reference any authorization server(s)"
    );
  }

  if (!scopesSupported) {
    console.warn(
      "This resource server did not specify which scopes can be used for authorization"
    );
  }

  if (authorizationServers.length > 1) {
    throw new Error(
      "Only 1 Authorization Server is supported for this current implementation"
    );
  }

  if (!methodsSupported || !methodsSupported.includes("header")) {
    throw new Error(
      "This resource server does not support authorizatiom method header"
    );
  }

  return {
    name: resourceName || resourceUrl,
    authorizationServer: authorizationServers[0],
    scopesSupported,
    // Parameter used to make a request
    resource,
  };
}

export async function tryRegister(
  authorizationServerUrl: string,
  algorithm: "oidc" | "oauth2"
) {
  return await client.dynamicClientRegistration(
    new URL(authorizationServerUrl),
    {
      client_name: "Basic Chat Client",
      redirect_uris: ["http://localhost:3000/auth/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "client_secret_post",
    },
    client.None,
    {
      algorithm,
      timeout: 5,
      [client.customFetch]: async (url, opts) => {
        let response = await globalThis.fetch(url, opts);
        if (response.ok) {
          const body = await response.json();
          response = new Response(
            JSON.stringify({
              ...body,
              client_secret_expires_at: body.client_secret_expires_at || 0,
            }),
            response
          );
        }
        return response;
      },
    }
  );
}

export async function discoverAndRegister(resourceUrl: string) {
  const resource = await discoverResource(resourceUrl);
  let instance;
  let protocol: "oidc" | "oauth2";

  // @todo: we should break discovery and DCR into two separate steps
  try {
    instance = await tryRegister(resource.authorizationServer, "oidc");
    protocol = "oidc";
  } catch (err) {
    console.log(
      "Failed on OIDC Discovery + Registration, trying OAuth2 Discovery + Registration",
      err
    );
    instance = await tryRegister(resource.authorizationServer, "oauth2");
    protocol = "oauth2";
  }

  const clientMetadata = instance.clientMetadata();
  const { client_secret: clientSecret } = clientMetadata;

  const serverMetadata = instance.serverMetadata();
  const { scopes_supported: authzServerScopesSupported } = serverMetadata;

  let scopesSupported = resource.scopesSupported || authzServerScopesSupported;

  if (!scopesSupported) {
    throw new Error("Could not estabilish which scopes to use");
  }

  // Pretty profile for OIDC
  if (
    protocol === "oidc" &&
    (!scopesSupported || scopesSupported.includes("openid") !== true)
  ) {
    scopesSupported = [...new Set(["openid", "profile", ...scopesSupported])];
  }

  if (!clientSecret) {
    throw new Error(
      "Client Secret was not provided in the registration metadata"
    );
  }

  return {
    ...resource,
    clientId: clientMetadata.client_id,
    clientSecret: clientMetadata.client_secret!,
    protocol,
    scopesSupported,
  };
}

/**
 * Stored information.
 */
export interface IClientInfo {
  clientId: string;
  clientSecret: string;
  protocol: "oidc" | "oauth2";
  scopesSupported: string[];
  name: string;
  authorizationServer: string;
  resource: string;
}