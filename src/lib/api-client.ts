/** 统一 fetch 封装:处理 query 参数、错误结构与 JSON 序列化 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Params = Record<string, string | number | undefined | null>;

function buildUrl(path: string, params?: Params): string {
  if (!params) return path;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("网络请求失败,请确认服务已启动", 0);
  }
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `请求失败(${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export function apiGet<T>(path: string, params?: Params): Promise<T> {
  return request<T>("GET", path, undefined, params);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}
