// Obtained from https://www.npmjs.com/package/fastify-mcp
// and adjusted for authz
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { FastifyPluginCallback, FastifyRequest } from "fastify";
import { Sessions } from "./session-storage";
import { authContextStorage } from "./auth-context";
import { Token } from "./fastify-auth0-fork";

type MCPSSEPluginOptions = {
  server: Server;
  sessions?: Sessions;
  sseEndpoint?: string;
  messagesEndpoint?: string;
};

export const fastifyMCPSSE: FastifyPluginCallback<MCPSSEPluginOptions> = (
  fastify,
  options,
  done,
) => {
  const {
    server,
    sessions = new Sessions(),
    sseEndpoint = "/sse",
    messagesEndpoint = "/messages",
  } = options;

  fastify.get(sseEndpoint, { preHandler: fastify.requireAuth() }, async (request, reply) => {
    
    const authContext = request.user as Required<Token>;

    await authContextStorage.run(authContext, async () => {
      const transport = new SSEServerTransport(messagesEndpoint, reply.raw);
      sessions.add(transport.sessionId, transport);
  
      reply.raw.on("close", () => sessions.remove(transport.sessionId));
      fastify.log.info("SSE session started", { sessionId: transport.sessionId });
  
      await server.connect(transport);
    });
  });
  
  // Message Handler
  fastify.post(messagesEndpoint, { preHandler: fastify.requireAuth() }, async (request, reply) => {
    const sessionId = extractSessionId(request);
    if (!sessionId) return reply.code(400).send({ error: "Missing sessionId" });
  
    const transport = sessions.get(sessionId);
    if (!transport) return reply.code(400).send({ error: "Session not found" });
  
    const authContext = request.user as Required<Token>;
  
    await authContextStorage.run(authContext, async () => {
      await transport.handlePostMessage(request.raw, reply.raw, request.body);
    });
  });

  return done();
};

function extractSessionId(req: FastifyRequest) {
  if (typeof req.query !== "object" || req.query === null) {
    return undefined;
  }

  if ("sessionId" in req.query === false) {
    return undefined;
  }

  const sessionId = req.query["sessionId"];
  if (typeof sessionId !== "string") {
    return undefined;
  }

  return sessionId;
}