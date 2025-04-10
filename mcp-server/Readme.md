# How to set this up

This is an example demonstration of MCP Server with OAuth Protected Resource Metadata, building on top of #233 by @localden. For the purpose of demonstration the OP / AS is Auth0. 

This is deployed at `https://todo-mcp.auth101.dev`.


## Instructions on How to Setup Auth0

1. Enable Dynamic Client Registration
2. Create an API in your Auth0 account, and set up the TODO scopes (`read:todos`, `write:todos`, `delete:todos`)
3. Enable a connection to be a "domain wide" connection (see https://auth0.com/docs/authenticate/identity-providers/promote-connections-to-domain-level) Without this, dynamically registred clients won't have any ability to login

## Acknowledgements and Thanks

For sake of clarity and completeness and adjustments this implementation inlines two packages

- Fastify-MCP https://www.npmjs.com/package/fastify-mcp 
- Fastify-Auth0-API https://www.npmjs.com/package/@auth0/auth0-fastify-api
