import "dotenv/config.js";
import Fastify from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fastifyMCPSSE } from "./fastify-mcp-sse";
import fastifyAuth0Fork from "./fastify-auth0-fork";
import {
  createTodoSchema,
  createTodoTool,
  deleteTodoSchema,
  deleteTodoTool,
  searchTodoSchema,
  searchTodoTool,
  updateTodoSchema,
  updateTodoTool,
} from "./tools";

const fastify = Fastify({
  logger: {
    level: "debug",
  },
});

const server = new McpServer({
  name: "Todo MCP Server",
  version: "1.0.0",
});

// CREATE TODO
server.tool("create_todo", "Creates a todo", createTodoSchema, createTodoTool);

// LIST TODOS
server.tool(
  "list_todos",
  "List all todos with optional filters",
  searchTodoSchema,
  searchTodoTool
);

// UPDATE TODO
server.tool("update_todo", "Update a todo", updateTodoSchema, updateTodoTool);

// DELETE TODO
server.tool("delete_todo", "Delete a todo", deleteTodoSchema, deleteTodoTool);

// Auth
fastify.register(fastifyAuth0Fork, {
  audience: process.env.AUTH0_AUDIENCE!,
  domain: process.env.AUTH0_DOMAIN!,
});

// + MCP-SSE
fastify.register(fastifyMCPSSE, server);

const start = async () => {
  try {
    await fastify.listen({ port: 8080 });
    fastify.log.info(
      "MCP server running on " + process.env.AUTH0_AUDIENCE! + "/message"
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
