import assert from "node:assert/strict";
import test from "node:test";
import { AuthError, type SessionActor } from "./auth.js";
import {
  assertEmployeeScope,
  assertSessionRequestActor,
  bearerToken,
  type SessionContext,
} from "./session-auth.js";

const actorA: SessionActor = Object.freeze({
  userId: "user-a",
  employeeId: "employee-a",
  employeeName: "刘洋",
  role: "MR",
});
const actorB: SessionActor = Object.freeze({
  userId: "user-b",
  employeeId: "employee-b",
  employeeName: "陈晨",
  role: "MR",
});
const jwtContext: SessionContext = { mode: "jwt", actor: actorA };

test("assertSessionRequestActor accepts the same immutable actor", () => {
  assert.doesNotThrow(() => assertSessionRequestActor(jwtContext, actorA));
});

test("assertSessionRequestActor rejects another WorkBuddy actor on an existing session", () => {
  assert.throws(
    () => assertSessionRequestActor(jwtContext, actorB),
    (error: unknown) => error instanceof AuthError && error.code === "EMPLOYEE_MISMATCH",
  );
});

test("assertEmployeeScope prevents explicit actor override in JWT mode", () => {
  assert.equal(assertEmployeeScope(jwtContext), "employee-a");
  assert.equal(assertEmployeeScope(jwtContext, "employee-a"), "employee-a");
  assert.throws(
    () => assertEmployeeScope(jwtContext, "employee-b"),
    (error: unknown) => error instanceof AuthError && error.code === "EMPLOYEE_MISMATCH",
  );
});

test("stdio mode retains explicit employee selection for local development", () => {
  const stdio: SessionContext = { mode: "stdio", actor: actorA };
  assert.equal(assertEmployeeScope(stdio, "employee-b"), "employee-b");
});

test("bearerToken requires a single Bearer credential", () => {
  assert.equal(bearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.throws(() => bearerToken(undefined), /Authorization/);
  assert.throws(() => bearerToken("Basic abc"), /Bearer/);
});
