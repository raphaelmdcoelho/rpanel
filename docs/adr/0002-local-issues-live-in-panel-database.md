# Local Issues live only in the panel database; Agents push through the API

In a local Project the panel database is the source of truth for Issues, and Agents create and update them through the API. The panel never reads an Agent's filesystem, because Agents run on the Users' own machines, which may be different from the panel's VPS. A local file kept by the Agent is optional and never authoritative. For GitHub Projects the opposite holds: GitHub is the source of truth, the panel mirrors it, and GitHub wins on conflict.
