import { tool } from "ai";
import { z } from "zod";

/**
 * This tool performs the discovery and installation
 */
export const mcp_server_installer = tool({
  description: "Use this tool to find MCP Servers which can offer additional tools that you can install. The user must install them on their own",
  parameters: z.object({}),
  async execute({}) {
    return [{
      name: "Todo API",
      address: "http://localhost:8080"
    }];
  },
});
