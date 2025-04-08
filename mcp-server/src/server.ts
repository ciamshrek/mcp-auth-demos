import "dotenv/config.js";
import Fastify from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fastifyMCPSSE } from "./fastify-mcp-sse";
import fastifyAuth0Fork from "./fastify-auth0-fork";
import { PrismaClient } from "@prisma/client";
import { getAuthContext } from "./auth-context";

const fastify = Fastify({
  logger: {
    level: "debug"
  }
});
const prisma = new PrismaClient();

const server = new McpServer({
  name: "Todo MCP Server",
  version: "1.0.0",
});

// CREATE TODO
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
  async ({ title, description, tags }, context) => {
    fastify.log.info("Attempting to create todo");
    const { scope, sub:userId } = getAuthContext();

    if (!scope.includes("write:todos")) {
      return {
        content: [
          {
            type: "text",
            text: "Unauthorized, user has not granted permissions to create todos to this client",
          },
        ],
      };
    }

    const todo = await prisma.todo.create({
      data: {
        title,
        description,
        tags: tags ?? [],
        user: {
          connectOrCreate: {
            create: {
              id: userId,
            },
            where: {
              id: userId
            }
          }
        }
      },
    });

    return { content: [{ type: "text", text: JSON.stringify(todo, null, 2) }] };
  }
);

// LIST TODOS
server.tool(
  "list_todos",
  "List all todos with optional filters",
  {
    search: z.string().describe("Search title or description").optional(),
    tags: z.string().describe("Comma-separated list of tags").optional(),
  },
  async ({ search, tags }, context) => {
    fastify.log.info("Searching todos");
    const { scope, sub: userId } = getAuthContext();

    if (!scope.includes("read:todos")) {
      return {
        content: [
          {
            type: "text",
            text: "Unauthorized, user has not granted permissions to read todos to this client",
          },
        ],
      };
    }

    const tagArray = tags ? tags.split(",") : [];

    const todos = await prisma.todo.findMany({
      where: {
        userId,
        AND: [
          search
            ? {
                OR: [
                  { title: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                ],
              }
            : {},
          tagArray.length
            ? {
                tags: {
                  hasSome: tagArray,
                },
              }
            : {},
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      content: [{ type: "text", text: JSON.stringify(todos, null, 2) }],
    };
  }
);

// UPDATE TODO
server.tool(
  "update_todo",
  "Update a todo",
  {
    id: z.string().describe("ID of the Todo to update"),
    title: z.string().describe("Updated title").optional(),
    description: z.string().describe("Updated task").optional(),
    tags: z.array(z.string()).describe("Updated tags").optional(),
    completed: z.boolean().describe("Mark as complete or not").optional(),
  },
  async ({ id, title, description, tags, completed }, context) => {
    fastify.log.info("Updating todos");
    const { scope, sub: userId } = getAuthContext();

    if (!scope.includes("write:todos")) {
      return {
        content: [
          {
            type: "text",
            text: "Unauthorized, user has not granted permissions to read todos to this client",
          },
        ],
      };
    }

    const existing = await prisma.todo.findFirst({ where: { id, userId } });
    if (!existing)
      return { content: [{ type: "text", text: "Todo not found" }] };

    const updated = await prisma.todo.update({
      where: { id },
      data: { title, description, tags, completed },
    });

    return {
      content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
    };
  }
);

// DELETE TODO
server.tool(
  "delete_todo",
  "Delete a todo",
  {
    id: z.string().describe("ID of the Todo to delete"),
  },
  async ({ id }, context) => {
    fastify.log.info("Deleting todos");
    const { scope, sub: userId } = getAuthContext();

    if (!scope.includes("delete:todos")) {
      return {
        content: [
          {
            type: "text",
            text: "Unauthorized, user has not granted permissions to delete todos to this client",
          },
        ],
      };
    }

    const existing = await prisma.todo.findFirst({ where: { id, userId } });
    if (!existing)
      return { content: [{ type: "text", text: "Todo not found" }] };

    await prisma.todo.delete({ where: { id } });

    return { content: [{ type: "text", text: "Todo deleted successfully." }] };
  }
);

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
