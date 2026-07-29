import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { McpEvaluationClient } from "./agent-evaluation-mcp";

test("MCP client initializes, reuses session, and unwraps tool content", async () => {
  const sessions: string[] = [];
  const server = http.createServer((req, res) => {
    sessions.push(String(req.headers["mcp-session-id"] ?? ""));
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const request = JSON.parse(body);
      res.setHeader("content-type", "application/json");
      if (request.method === "initialize") {
        res.setHeader("mcp-session-id", "session-1");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: "2025-03-26" } }));
      } else {
        res.end(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { content: [{ type: "text", text: "{\"ok\":true}" }] } }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const client = new McpEvaluationClient(`http://127.0.0.1:${address.port}`, "token", 1000);
  await client.initialize();
  const result = await client.callTool("demo", {});
  assert.deepEqual(result.data, { ok: true });
  assert.equal(sessions[1], "session-1");
  server.close();
});
