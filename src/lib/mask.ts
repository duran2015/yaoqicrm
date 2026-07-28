/**
 * 敏感字段脱敏(数据库存原文,API 层输出时脱敏)
 *
 * - maskName        姓名保留首尾字,中间以 * 替代(冶*玲)
 * - maskPhone       手机号保留前 3 后 2(186****66 风格)
 * - maskIdNumber    证件号保留前 3 后 2
 * - maskBankAccount 银行账号保留前 4 后 2
 */

function maskKeep(value: string | null | undefined, head: number, tail: number): string | null {
  if (!value) return value ?? null;
  const s = String(value);
  if (s.length <= head + tail) return s[0] + "*".repeat(Math.max(1, s.length - 1));
  return s.slice(0, head) + "*".repeat(Math.min(4, s.length - head - tail)) + s.slice(s.length - tail);
}

/** 姓名:保留首尾字 */
export function maskName(name: string | null | undefined): string | null {
  if (!name) return name ?? null;
  const s = String(name);
  if (s.length === 1) return "*";
  if (s.length === 2) return s[0] + "*";
  return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
}

/** 手机号:前 3 后 2 */
export function maskPhone(phone: string | null | undefined): string | null {
  return maskKeep(phone, 3, 2);
}

/** 证件号:前 3 后 2 */
export function maskIdNumber(idNumber: string | null | undefined): string | null {
  return maskKeep(idNumber, 3, 2);
}

/** 银行账号:前 4 后 2 */
export function maskBankAccount(accountNo: string | null | undefined): string | null {
  return maskKeep(accountNo, 4, 2);
}

/** HCP 对象脱敏(列表/详情通用):name / phone / idNumber */
export function maskHcp<T extends { name?: unknown; phone?: unknown; idNumber?: unknown }>(hcp: T): T {
  return {
    ...hcp,
    name: maskName(hcp.name as string | null),
    phone: maskPhone(hcp.phone as string | null),
    idNumber: maskIdNumber(hcp.idNumber as string | null),
  };
}

/** HCP 银行账户数组脱敏:accountNo */
export function maskBankAccounts<T extends { accountNo?: unknown }>(accounts: T[]): T[] {
  return accounts.map((a) => ({ ...a, accountNo: maskBankAccount(a.accountNo as string | null) }));
}
