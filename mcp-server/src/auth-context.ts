// context.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { Token } from "./fastify-auth0-fork";
import { z, ZodObject, ZodRawShape, ZodTypeAny } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type AuthContext = Required<Token>;

export const authContextStorage = new AsyncLocalStorage<AuthContext>();

export function getAuthContext(): AuthContext {
  const ctx = authContextStorage.getStore();
  if (!ctx) {
    throw new Error("Fatal: getAuthContext called but no context was provided");
  }

  return ctx;
}

export class UnauthorizedError extends Error {
  constructor(
    public readonly requiredScope: string,
    message: string = "Unauthorized, the access token does not have required scope"
  ) {
    super(message);
  }
}

type SecureContext = RequestHandlerExtra & {
  user: { sub: string };
};

/** */
export const withAuthz = <Args extends ZodRawShape>(
  requiredScope: string,
  cb: (
    args: z.objectOutputType<Args, ZodTypeAny>,
    context: SecureContext
  ) => CallToolResult | Promise<CallToolResult>
): ToolCallback<Args> => {
  // 🧠 Trick: TypeScript can infer Args from how `withAuthz()` is called inside `tool()`
  return ((args: Args, context: RequestHandlerExtra) => {
    const { scope, sub } = getAuthContext();

    if (!scope.includes(requiredScope)) {
      throw new UnauthorizedError(requiredScope);
    }

    return cb(args, {
      ...context,
      user: { sub },
    });
  }) as ToolCallback<Args>;
};
