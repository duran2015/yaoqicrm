import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthErrorCode =
  | "MALFORMED_TOKEN"
  | "UNSUPPORTED_ALGORITHM"
  | "INVALID_SIGNATURE"
  | "INVALID_CLAIMS"
  | "INVALID_ISSUER"
  | "INVALID_AUDIENCE"
  | "TOKEN_EXPIRED"
  | "EMPLOYEE_NOT_FOUND"
  | "EMPLOYEE_MISMATCH"
  | "ROLE_MISMATCH";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface JwtVerificationConfig {
  secret: string;
  issuer: string;
  audience: string;
}

export interface WorkBuddyClaims {
  sub: string;
  employeeId: string;
  role: string;
  departmentId?: string;
  tenantId?: string;
  iss: string;
  aud: string | string[];
  iat?: number;
  exp: number;
}

export interface CrmEmployeeIdentity {
  id: string;
  name: string;
  role: string;
  division?: string;
  departmentId?: string | null;
}

export interface SessionActor {
  userId: string;
  employeeId: string;
  employeeName: string;
  role: string;
  division?: string;
  departmentId?: string;
  tenantId?: string;
}

function decodeJsonPart(part: string): Record<string, unknown> {
  try {
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as Record<string, unknown>;
  } catch {
    throw new AuthError("MALFORMED_TOKEN", "JWT 不是合法的 base64url JSON");
  }
}

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new AuthError("INVALID_CLAIMS", `JWT 缺少有效的 ${key}`);
  }
  return value;
}

export function verifyWorkBuddyJwt(
  token: string,
  config: JwtVerificationConfig,
  now = new Date(),
): WorkBuddyClaims {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new AuthError("MALFORMED_TOKEN", "JWT 必须包含 header.payload.signature");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart(encodedHeader);
  if (header.alg !== "HS256") {
    throw new AuthError("UNSUPPORTED_ALGORITHM", "演示环境只接受 HS256 JWT");
  }

  const expected = createHmac("sha256", config.secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new AuthError("MALFORMED_TOKEN", "JWT 签名编码无效");
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AuthError("INVALID_SIGNATURE", "JWT 签名验证失败");
  }

  const payload = decodeJsonPart(encodedPayload);
  const sub = requiredString(payload, "sub");
  const employeeId = requiredString(payload, "employeeId");
  const role = requiredString(payload, "role");
  const iss = requiredString(payload, "iss");
  if (iss !== config.issuer) throw new AuthError("INVALID_ISSUER", "JWT issuer 不匹配");

  const aud = payload.aud;
  if (
    !(typeof aud === "string" || (Array.isArray(aud) && aud.every((item) => typeof item === "string"))) ||
    !(typeof aud === "string" ? aud === config.audience : aud.includes(config.audience))
  ) {
    throw new AuthError("INVALID_AUDIENCE", "JWT audience 不匹配");
  }
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new AuthError("INVALID_CLAIMS", "JWT 缺少有效的 exp");
  }
  if (payload.exp <= Math.floor(now.getTime() / 1000)) {
    throw new AuthError("TOKEN_EXPIRED", "JWT 已过期");
  }

  return {
    sub,
    employeeId,
    role,
    ...(typeof payload.departmentId === "string" ? { departmentId: payload.departmentId } : {}),
    ...(typeof payload.tenantId === "string" ? { tenantId: payload.tenantId } : {}),
    iss,
    aud,
    ...(typeof payload.iat === "number" ? { iat: payload.iat } : {}),
    exp: payload.exp,
  };
}

export function mapClaimsToEmployee(
  claims: WorkBuddyClaims,
  employee: CrmEmployeeIdentity | null,
): SessionActor {
  if (!employee) throw new AuthError("EMPLOYEE_NOT_FOUND", "JWT employeeId 在 CRM 中不存在");
  if (employee.id !== claims.employeeId) {
    throw new AuthError("EMPLOYEE_MISMATCH", "CRM 员工与 JWT employeeId 不匹配");
  }
  if (employee.role !== claims.role) {
    throw new AuthError("ROLE_MISMATCH", "JWT role 与 CRM 员工角色不匹配");
  }
  return Object.freeze({
    userId: claims.sub,
    employeeId: employee.id,
    employeeName: employee.name,
    role: employee.role,
    ...(employee.division ? { division: employee.division } : {}),
    ...(employee.departmentId ? { departmentId: employee.departmentId } : {}),
    ...(claims.tenantId ? { tenantId: claims.tenantId } : {}),
  });
}
