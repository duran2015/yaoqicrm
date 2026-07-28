import { AuthError, type SessionActor } from "./auth.js";

export interface SessionContext {
  mode: "stdio" | "jwt";
  actor: SessionActor | null;
}

export function bearerToken(authorization: string | undefined): string {
  if (!authorization) throw new AuthError("MALFORMED_TOKEN", "缺少 Authorization 请求头");
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!match) throw new AuthError("MALFORMED_TOKEN", "Authorization 必须使用 Bearer <JWT>");
  return match[1];
}

export function assertSessionRequestActor(context: SessionContext, requestActor: SessionActor): void {
  if (context.mode !== "jwt" || !context.actor) return;
  if (
    context.actor.employeeId !== requestActor.employeeId ||
    context.actor.userId !== requestActor.userId
  ) {
    throw new AuthError("EMPLOYEE_MISMATCH", "当前 JWT 身份与已绑定的 MCP session 不一致");
  }
}

export function assertEmployeeScope(context: SessionContext, explicitEmployeeId?: string): string {
  const actorId = context.actor?.employeeId;
  if (context.mode === "jwt") {
    if (!actorId) throw new AuthError("INVALID_CLAIMS", "MCP session 未绑定 CRM 员工");
    if (explicitEmployeeId && explicitEmployeeId !== actorId) {
      throw new AuthError("EMPLOYEE_MISMATCH", "工具参数不能覆盖 WorkBuddy 会话员工身份");
    }
    return actorId;
  }
  const employeeId = explicitEmployeeId ?? actorId;
  if (!employeeId) {
    throw new AuthError("INVALID_CLAIMS", "未指定 employeeId，且当前未设置操作身份");
  }
  return employeeId;
}
