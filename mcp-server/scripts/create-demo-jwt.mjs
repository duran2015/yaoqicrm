import { createHmac } from "node:crypto";

const [employeeId, role = "MR", userId = `workbuddy-demo:${employeeId}`] = process.argv.slice(2);
const secret = process.env.WORKBUDDY_JWT_SECRET;
if (!employeeId || !secret) {
  console.error("用法：WORKBUDDY_JWT_SECRET=<secret> node scripts/create-demo-jwt.mjs <employeeId> [role] [userId]");
  process.exit(1);
}
const now = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
  sub: userId,
  employeeId,
  role,
  tenantId: "demo-company",
  iss: process.env.WORKBUDDY_JWT_ISSUER ?? "workbuddy-local",
  aud: process.env.WORKBUDDY_JWT_AUDIENCE ?? "pharma-crm-mcp",
  iat: now,
  exp: now + Number(process.env.WORKBUDDY_JWT_TTL_SECONDS ?? 300),
})}`;
console.log(`${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`);
