import { FastifyPluginAsync } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TodoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string", nullable: true },
    tags: { type: "array", items: { type: "string" } },
    completed: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    userId: { type: "string" },
  },
};

const todosRoutes: FastifyPluginAsync = async (fastify) => {
  // PATCH /todos/:id - update a todo (title, description, tags, completed)
  fastify.patch(
    "/todos/:id",
    {
      preHandler: fastify.requireAuth({
        scopes: "write:todos",
      }),
      schema: {
        security:[{
            auth0: ["write:todos"]
        }],
        summary: "Update a todo",
        tags: ["Todos"],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            completed: { type: "boolean" },
          },
        },
        response: {
          200: TodoSchema,
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: any, reply) => {
      const userId = request.user.id;
      const { id } = request.params as { id: string };
      const { title, description, tags, completed } = request.body as {
        title?: string;
        description?: string;
        tags?: string[];
        completed?: boolean;
      };

      const existing = await prisma.todo.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Todo not found" });
      }

      const updated = await prisma.todo.update({
        where: { id },
        data: {
          title,
          description,
          tags,
          completed,
        },
      });

      return updated;
    }
  );

  // DELETE /todos/:id - remove a todo
  fastify.delete(
    "/todos/:id",
    {
      preHandler: fastify.requireAuth({
        scopes: "delete:todos",
      }),

      schema: {
        security:[{
            auth0: ["delete:todos"]
        }],
        summary: "Delete a todo",
        tags: ["Todos"],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: any, reply) => {
      const userId = request.user.id;
      const { id } = request.params as { id: string };

      const existing = await prisma.todo.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "Todo not found" });
      }

      await prisma.todo.delete({ where: { id } });

      return { success: true };
    }
  );

  // GET /todos - list todos with optional search + tag filtering
  fastify.get(
    "/todos",
    {
      preHandler: fastify.requireAuth({
        scopes: "read:todos",
      }),
      schema: {
        security:[{
            auth0: ["read:todos"]
        }],
        summary: "List all todos",
        description:
          "Retrieve todos for the current user with optional tag and search filters.",
        tags: ["Todos"],
        querystring: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "Full-text search (title or description)",
            },
            tags: {
              type: "string",
              description: "Comma-separated list of tags",
            },
          },
        },
        response: {
          200: {
            type: "array",
            items: TodoSchema,
          },
        },
      },
    },
    async (request: any, reply) => {
      const userId = request.user.id;
      const { search, tags } = request.query as {
        search?: string;
        tags?: string;
      };

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
        orderBy: {
          createdAt: "desc",
        },
      });

      return todos;
    }
  );

  // POST /todos - create a new todo
  fastify.post(
    "/todos",
    {
      preHandler: fastify.requireAuth({
        scopes: "write:todos",
      }),

      schema: {
        security:[{
            auth0: ["write:todos"]
        }],
        summary: "Create a new todo",
        tags: ["Todos"],
        body: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
        response: {
          200: TodoSchema,
        },
      },
    },
    async (request: any, reply) => {
      const userId = request.user.id;
      const { title, description, tags } = request.body as {
        title: string;
        description?: string;
        tags?: string[];
      };

      if (!title) {
        return reply.code(400).send({ error: "Title is required" });
      }

      const todo = await prisma.todo.create({
        data: {
          title,
          description,
          tags: tags ?? [],
          userId,
        },
      });

      return todo;
    }
  );
};

export default todosRoutes;
