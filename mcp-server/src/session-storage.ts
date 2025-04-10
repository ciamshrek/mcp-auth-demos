import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

export class Sessions {
  private sessions = new Map<string, SSEServerTransport>();

  public add(sessionId: string, transport: SSEServerTransport): void {
    this.sessions.set(sessionId, transport);
  }

  public get(sessionId: string): SSEServerTransport | undefined {
    return this.sessions.get(sessionId);
  }

  public remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}