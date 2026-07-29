export class McpEvaluationClient {
  private sessionId?: string;
  private nextId = 1;

  constructor(private endpoint: string, private token?: string, private timeoutMs = 15_000) {}

  private async rpc(method: string, params: unknown, useSession = true) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(useSession && this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
    });
    this.sessionId = response.headers.get("mcp-session-id") ?? this.sessionId;
    const text = await response.text();
    const dataLine = response.headers.get("content-type")?.includes("text/event-stream")
      ? text.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim()
      : text;
    let body: Record<string, unknown> | undefined;
    try { body = dataLine ? JSON.parse(dataLine) : undefined; } catch { body = undefined; }
    return { status: response.status, ok: response.ok, body };
  }

  async initialize() {
    const result = await this.rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "pharma-crm-evaluator", version: "1.0.0" },
    }, false);
    if (!result.ok || !this.sessionId) throw new Error(`initialize 失败：HTTP ${result.status}`);
    await this.rpc("notifications/initialized", {});
    return result;
  }

  async listTools() {
    const result = await this.rpc("tools/list", {});
    const rpcResult = result.body?.result as { tools?: { name: string }[] } | undefined;
    return { ...result, tools: rpcResult?.tools ?? [] };
  }

  async callTool(name: string, args: Record<string, unknown>) {
    const result = await this.rpc("tools/call", { name, arguments: args });
    const rpcResult = result.body?.result as { isError?: boolean; content?: { type: string; text: string }[] } | undefined;
    const text = rpcResult?.content?.find((item) => item.type === "text")?.text;
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : undefined; } catch { /* retain text */ }
    return { ...result, isError: Boolean(rpcResult?.isError || result.body?.error), data };
  }
}
