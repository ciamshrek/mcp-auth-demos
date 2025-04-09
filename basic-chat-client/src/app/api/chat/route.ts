import { getTokenSet } from "@/app/auth/get-tokenset";
import { mcp_server_installer } from "@/app/tools/mcp-server-helper";
import { openai } from "@ai-sdk/openai";
import { experimental_createMCPClient, streamText } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * This is a very basic demonstration
 *
 * @param req
 * @returns
 */
export async function POST(req: Request) {

  // @todo: allow accepting shortlist of "tools" from frontend.
  // mostly just names.
  
  const { messages, } = await req.json();
  let tools = {};
  try {
    // @todo: This is obtaining the credentials too early
    // once the newer MCP spec (HTTP-Streamable) is implemented we should
    // remove this
    const mcp = await experimental_createMCPClient({
      transport: {
        type: "sse",
        url: "http://localhost:8080/sse",
        headers: {
          Authorization:
            "Bearer " + (await getTokenSet("http://localhost:8080")).access_token,
        },
      },
    });

    tools = await mcp.tools();
    console.log("Successfully loaded tools");
  } catch (err){
    console.log("Failed to load tools");
    console.error(err);
  }

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    maxSteps: 10,
    toolCallStreaming: true,
    tools: {
      mcp_server_installer,
      ...tools,
    },
  });

  return result.toDataStreamResponse({
    getErrorMessage(error) {
      console.error(error);
      return "No";
    },
  });
}
