import type { Project, SessionInfo } from "@rpanel/shared";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let csrfToken = "";

export function rememberCsrfToken(token: string) {
  csrfToken = token;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") headers["x-csrf-token"] = csrfToken;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const api = {
  setupStatus: () => request<{ needsSetup: boolean }>("GET", "/api/setup/status"),
  me: () => request<SessionInfo>("GET", "/api/me"),
  setup: (email: string, password: string) => request<SessionInfo>("POST", "/api/setup", { email, password }),
  login: (email: string, password: string) => request<SessionInfo>("POST", "/api/login", { email, password }),
  logout: () => request<void>("POST", "/api/logout"),
  projects: () => request<{ projects: Project[] }>("GET", "/api/projects").then((data) => data.projects),
  createProject: (name: string) => request<Project>("POST", "/api/projects", { name }),
};
