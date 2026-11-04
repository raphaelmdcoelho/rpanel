import { useEffect, useState, type FormEvent } from "react";
import type { SessionInfo } from "@rpanel/shared";
import { api, ApiError, rememberCsrfToken } from "./api";
import "./App.css";

type View = { kind: "loading" } | { kind: "setup" } | { kind: "login" } | { kind: "signedIn"; session: SessionInfo };

function CredentialsForm(props: { title: string; submitLabel: string; onSubmit: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await props.onSubmit(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2>{props.title}</h2>
      <label>
        Email
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete={props.submitLabel === "Log in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        {props.submitLabel}
      </button>
    </form>
  );
}

export function App() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "down">("checking");

  function signIn(session: SessionInfo) {
    rememberCsrfToken(session.csrfToken);
    setView({ kind: "signedIn", session });
  }

  useEffect(() => {
    fetch("/api/health")
      .then((res) => setApiStatus(res.ok ? "ok" : "down"))
      .catch(() => setApiStatus("down"));

    api
      .me()
      .then(signIn)
      .catch(async (err) => {
        if (!(err instanceof ApiError && err.status === 401)) return setView({ kind: "login" });
        const { needsSetup } = await api.setupStatus();
        setView({ kind: needsSetup ? "setup" : "login" });
      })
      .catch(() => setView({ kind: "login" }));
  }, []);

  async function logout() {
    await api.logout().catch(() => undefined);
    rememberCsrfToken("");
    setView({ kind: "login" });
  }

  return (
    <main>
      <h1>rpanel</h1>
      {view.kind === "loading" && <p>Loading…</p>}
      {view.kind === "setup" && (
        <CredentialsForm title="Create the first account" submitLabel="Create account" onSubmit={async (e, p) => signIn(await api.setup(e, p))} />
      )}
      {view.kind === "login" && <CredentialsForm title="Log in" submitLabel="Log in" onSubmit={async (e, p) => signIn(await api.login(e, p))} />}
      {view.kind === "signedIn" && (
        <section>
          <p>Signed in as {view.session.user.email}</p>
          {view.session.user.isAdmin && <p>Admin</p>}
          <button type="button" onClick={logout}>
            Log out
          </button>
        </section>
      )}
      <p data-testid="api-status">API: {apiStatus}</p>
    </main>
  );
}
