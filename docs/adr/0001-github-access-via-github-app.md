# GitHub access through a GitHub App, private key kept outside the database

The panel reads and writes GitHub issues through a GitHub App that Users install on chosen repos, instead of storing per-User personal access tokens. The App's private key lives in a file or Docker secret outside the database, and installation tokens are generated on demand and expire after about an hour, so a leaked database exposes no GitHub credentials. The cost is a one-time App registration and an install step per User.

Considered: per-User fine-grained personal access tokens (long-lived, would have to be stored encrypted in the database), an OAuth App (broader scopes, tokens in the database), and having Agents sync GitHub with their own `gh` login (the panel could not sync or write back while no Agent is online).
