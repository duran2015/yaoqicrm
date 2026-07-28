import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiPath } from "./api-client";

test("resolveApiPath prefixes application-relative API paths with the deployment base path", () => {
  assert.equal(resolveApiPath("/api/employees", "/pharma"), "/pharma/api/employees");
  assert.equal(resolveApiPath("/pharma/api/employees", "/pharma"), "/pharma/api/employees");
  assert.equal(resolveApiPath("/api/employees", ""), "/api/employees");
  assert.equal(resolveApiPath("https://example.com/api", "/pharma"), "https://example.com/api");
});
