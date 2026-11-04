import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "down";

export function App() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => setStatus(res.ok ? "ok" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  return (
    <main>
      <h1>rpanel</h1>
      <p data-testid="api-status">API: {status}</p>
    </main>
  );
}
