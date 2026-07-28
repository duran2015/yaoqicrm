import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  AuthError,
  mapClaimsToEmployee,
  verifyWorkBuddyJwt,
  type JwtVerificationConfig,
} from "./auth.js";

const config: JwtVerificationConfig = {
  secret: "demo-secret-at-least-32-characters",
  issuer: "workbuddy-local",
  audience: "pharma-crm-mcp",
};

function token(
  payload: Record<string, unknown>,
  secret = config.secret,
  header: Record<string, unknown> = { alg: "HS256", typ: "JWT" },
) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

const validPayload = {
  sub: "wb-user-1001",
  employeeId: "employee-1",
  role: "MR",
  departmentId: "department-1",
  tenantId: "demo-company",
  iss: config.issuer,
  aud: config.audience,
  iat: 1_800_000_000,
  exp: 1_800_000_300,
};

test("verifyWorkBuddyJwt accepts a correctly signed short-lived user token", () => {
  const claims = verifyWorkBuddyJwt(token(validPayload), config, new Date(1_800_000_100_000));
  assert.deepEqual(claims, validPayload);
});

test("verifyWorkBuddyJwt rejects a token signed with another secret", () => {
  assert.throws(
    () => verifyWorkBuddyJwt(token(validPayload, "another-secret-at-least-32-char"), config, new Date(1_800_000_100_000)),
    (error: unknown) => error instanceof AuthError && error.code === "INVALID_SIGNATURE",
  );
});

test("verifyWorkBuddyJwt rejects expired tokens", () => {
  assert.throws(
    () => verifyWorkBuddyJwt(token(validPayload), config, new Date(1_800_000_301_000)),
    (error: unknown) => error instanceof AuthError && error.code === "TOKEN_EXPIRED",
  );
});

test("verifyWorkBuddyJwt validates issuer and audience", () => {
  assert.throws(
    () => verifyWorkBuddyJwt(token({ ...validPayload, aud: "some-other-service" }), config, new Date(1_800_000_100_000)),
    (error: unknown) => error instanceof AuthError && error.code === "INVALID_AUDIENCE",
  );
  assert.throws(
    () => verifyWorkBuddyJwt(token({ ...validPayload, iss: "unknown-issuer" }), config, new Date(1_800_000_100_000)),
    (error: unknown) => error instanceof AuthError && error.code === "INVALID_ISSUER",
  );
});

test("verifyWorkBuddyJwt requires user, employee, role, and expiration claims", () => {
  const { employeeId: _employeeId, ...missingEmployee } = validPayload;
  assert.throws(
    () => verifyWorkBuddyJwt(token(missingEmployee), config, new Date(1_800_000_100_000)),
    (error: unknown) => error instanceof AuthError && error.code === "INVALID_CLAIMS",
  );
});

test("mapClaimsToEmployee returns an immutable CRM-backed session actor", () => {
  const actor = mapClaimsToEmployee(validPayload, {
    id: "employee-1",
    name: "刘洋",
    role: "MR",
    division: "肿瘤线",
    departmentId: "department-1",
  });
  assert.deepEqual(actor, {
    userId: "wb-user-1001",
    employeeId: "employee-1",
    employeeName: "刘洋",
    role: "MR",
    division: "肿瘤线",
    departmentId: "department-1",
    tenantId: "demo-company",
  });
  assert.equal(Object.isFrozen(actor), true);
});

test("mapClaimsToEmployee rejects missing employees and role mismatches", () => {
  assert.throws(
    () => mapClaimsToEmployee(validPayload, null),
    (error: unknown) => error instanceof AuthError && error.code === "EMPLOYEE_NOT_FOUND",
  );
  assert.throws(
    () => mapClaimsToEmployee(validPayload, { id: "employee-1", name: "王经理", role: "ASM" }),
    (error: unknown) => error instanceof AuthError && error.code === "ROLE_MISMATCH",
  );
});
