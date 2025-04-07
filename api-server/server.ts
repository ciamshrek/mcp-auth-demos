import"dotenv/config";
import Fastify from "fastify";
import todosRoutes from "routes/todos";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import fastifyAuth0Api from "@auth0/auth0-fastify-api";

const app = Fastify();

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "TODO API",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        auth0: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: `https://${process.env.AUTH0_DOMAIN}/authorize`,
              tokenUrl: `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
              scopes: {
                "read:todos": "Read your todos",
                "write:todos": "Create or update todos",
                "delete:todos": "Delete your todos",
              },
            },
          },
        },
      },
    },
  },
});

app.register(fastifySwaggerUI, {
  routePrefix: "/docs",
});

app.register(fastifyAuth0Api, {
  domain: process.env.AUTH0_DOMAIN!,
  audience: process.env.AUTH0_AUDIENCE!,
});

app.register(todosRoutes);

app.listen({ port: 3001 }, () => {
  console.log("🚀 Server running at http://localhost:3001");
});
