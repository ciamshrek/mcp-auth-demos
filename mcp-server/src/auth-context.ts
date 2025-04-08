// context.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { Token } from './fastify-auth0-fork';

export type AuthContext = Required<Token>;

export const authContextStorage = new AsyncLocalStorage<AuthContext>();

export function getAuthContext(): AuthContext {
  const ctx = authContextStorage.getStore();
  if (!ctx) {
    throw new Error("Fatal: getAuthContext called but no context was provided");
  }

  return ctx;
}
