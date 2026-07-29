import assert from "node:assert/strict";
import test from "node:test";
import { createMcpServiceCredential, mcpClientConfig, verifyMcpServiceCredential } from "./mcp-service-token";

test("service credential is prefixed while persistence keeps only hash and hint", () => {
  const value = createMcpServiceCredential();
  assert.match(value.token, /^phmcp_live_[A-Za-z0-9_-]{40,}$/);
  assert.equal(value.tokenHash.length, 64);
  assert.equal(value.tokenHint, value.token.slice(-4));
  assert.equal(value.tokenHash.includes(value.token), false);
});

test("verification accepts active credentials and rejects revoked or expired credentials", () => {
  const value = createMcpServiceCredential();
  const record = { tokenHash: value.tokenHash, status: "ACTIVE", expiresAt: null };
  assert.equal(verifyMcpServiceCredential(value.token, record), true);
  assert.equal(verifyMcpServiceCredential(value.token, { ...record, status: "REVOKED" }), false);
  assert.equal(verifyMcpServiceCredential(value.token, { ...record, expiresAt: new Date(0) }), false);
});

test("client config contains service token and never a JWT", () => {
  const config = mcpClientConfig("phmcp_live_demo", "https://crm.example/mcp");
  assert.equal(config.mcpServers["pharma-crm"].headers.Authorization, "Bearer phmcp_live_demo");
});
