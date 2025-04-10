import { z } from "zod";
import { withAuthz } from "./auth-context";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createTodoSchema = {
  title: z.string().describe("Title for the Todo"),
  description: z.string().describe("The task to perform").optional(),
  tags: z.string().describe("A hashtag associated with it like #job #personal").optional(),
} as const;

export const createTodoTool = withAuthz<typeof createTodoSchema>(
  "write:todos",
  async ({ title, description, tags }, { user }) => {
    console.info("Attempting to create todo");

    const todo = await prisma.todo.create({
      data: {
        title,
        description,
        tags: tags ?? "",
        user: {
          connectOrCreate: {
            create: {
              id: user.sub,
            },
            where: {
              id: user.sub,
            },
          },
        },
      },
    });

    return { content: [{ type: "text", text: JSON.stringify(todo, null, 2) }] };
  }
);

export const searchTodoSchema = {
  search: z.string().describe("Search title or description").optional(),
  tags: z.string().describe("Comma-separated list of tags").optional(),
} as const;

export const searchTodoTool = withAuthz(
  "read:todos",
  async ({ search, tags }, { user }) => {
    console.info("Searching todos");

    const todos = await prisma.todo.findMany({
      where: {
        userId: user.sub,
        AND: [
          search
            ? {
                OR: [
                  { title: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                ],
              }
            : {},
          tags
            ? {
                tags: {
                  contains: tags,
                  mode: "insensitive"
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

export const updateTodoSchema = {
  id: z.string().describe("ID of the Todo to update"),
  title: z.string().describe("Updated title").optional(),
  description: z.string().describe("Updated task").optional(),
  tags: z.string().describe("Updated tags").optional(),
  completed: z.boolean().describe("Mark as complete or not").optional(),
} as const;

export const updateTodoTool = withAuthz(
  "write:todos",
  async ({ id, title, description, tags, completed }, { user }) => {
    console.info("Updating todos");

    const existing = await prisma.todo.findFirst({
      where: { id, userId: user.sub },
    });
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

export const deleteTodoSchema = {
  id: z.string().describe("ID of the Todo to delete"),
} as const;

export const deleteTodoTool = withAuthz("delete:todos", async ({ id }, { user }) => {
  console.info("Deleting todos");

  const existing = await prisma.todo.findFirst({
    where: { id, userId: user.sub },
  });
  if (!existing) return { content: [{ type: "text", text: "Todo not found" }] };

  await prisma.todo.delete({ where: { id } });

  return { content: [{ type: "text", text: "Todo deleted successfully." }] };
});
