// todo_mcp_server.ts
import 'dotenv/config.js';
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fastifyMCPSSE } from "fastify-mcp-sse";
import fastifyAuth0Fork from "fastify-auth0-fork";

const API_BASE = "http://localhost:3001"; // your todo-api base URL

const fastify = Fastify();

const server = new McpServer({
  name: "Todo MCP Server",
  version: "1.0.0",
});

server.tool(
  "create_todo",
  "Creates a todo",
  {
    title: z.string().describe("Title for the Todo"),
    description: z.string().describe("The task to perform").optional(),
    tags: z
      .array(
        z.string().describe("A hashtag associated with it like #job #personal")
      )
      .optional(),
  },
  async ({ title, description, tags }: any) => {
    const res = await fetch(`${API_BASE}/todos`, {
      method: "POST",
      body: JSON.stringify({ title, description, tags }),
    });
    const json = await res.text();
    return { content: [{ type: "text", text: json }] };
  }
);

server.tool(
  "list_todos",
  "List all todos with optional filters",
  {
    search: z
      .string()
      .describe("Full-text search (title or description)")
      .optional(),
    tags: z.string().describe("Comma-separated list of tags").optional(),
  },
  async ({ search, tags }: any) => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (tags) params.append("tags", tags);
    const res = await fetch(`${API_BASE}/todos?${params.toString()}`);
    const json = await res.text();
    return { content: [{ type: "text", text: json }] };
  }
);

server.tool(
  "update_todo",
  "Update a todo",
  {
    id: z.string().describe("ID of the Todo to update"),
    title: z.string().describe("Updated title").optional(),
    description: z.string().describe("Updated task").optional(),
    tags: z.array(z.string().describe("Updated tags")).optional(),
    completed: z
      .boolean()
      .describe("Mark as complete or incomplete")
      .optional(),
  },
  async ({ id, title, description, tags, completed }: any) => {
    const res = await fetch(`${API_BASE}/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title, description, tags, completed }),
    });
    const json = await res.text();
    return { content: [{ type: "text", text: json }] };
  }
);

server.tool(
  "delete_todo",
  "Delete a todo",
  {
    id: z.string().describe("ID of the Todo to delete"),
  },
  async ({ id }: any) => {
    const res = await fetch(`${API_BASE}/todos/${id}`, {
      method: "DELETE",
    });
    const json = await res.text();
    return { content: [{ type: "text", text: json }] };
  }
);

fastify.register(fastifyAuth0Fork, {
    audience: process.env.AUTH0_AUDIENCE!,
    domain: process.env.AUTH0_DOMAIN!,
})
fastify.register(fastifyMCPSSE,
    server
);

const start = async () => {
  try {
    await fastify.listen({ port: 8080 });
    console.log("MCP server running on " + process.env.AUTH0_AUDIENCE! + "/message");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
