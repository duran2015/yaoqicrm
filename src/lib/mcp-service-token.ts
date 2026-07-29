import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const MCP_SERVICE_TOKEN_PREFIX = "phmcp_live_";
export const hashMcpServiceToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function createMcpServiceCredential() {
  const token = `${MCP_SERVICE_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashMcpServiceToken(token), tokenHint: token.slice(-4) };
}

export function verifyMcpServiceCredential(token: string, record: { tokenHash: string; status: string; expiresAt: Date | null }, now = new Date()) {
  if (!token.startsWith(MCP_SERVICE_TOKEN_PREFIX) || record.status !== "ACTIVE" || (record.expiresAt && record.expiresAt <= now)) return false;
  const actual = Buffer.from(hashMcpServiceToken(token)); const expected = Buffer.from(record.tokenHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function mcpClientConfig(token: string, url: string) {
  return { mcpServers: { "pharma-crm": { type: "streamable-http", url, headers: { Authorization: `Bearer ${token}` }, disabled: false } } };
}
