export type HealthResponse = { status: "ok"; database: "ok" };

export type SessionUser = { id: number; email: string; isAdmin: boolean };
export type SessionInfo = { user: SessionUser; csrfToken: string };
