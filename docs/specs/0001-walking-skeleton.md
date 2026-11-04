# Spec: Walking skeleton — a User answers an Agent's Decision in the browser

## Problem Statement

I run several Projects in parallel with Agents working on them. To know where each Project stands I open many GitHub tabs and local directories. When an Agent needs a Decision from me, I have to find its terminal or app and answer there. There is no central place to see status or to answer Agents.

## Solution

A web panel, served from my VPS over HTTPS, where a User logs in, creates a local Project, and generates an API key for it. An Agent uses that key to raise a Decision with multiple-choice options and waits for the answer. The User sees the Decision appear live in the browser, picks an option, and the waiting Agent receives the answer. This first slice proves the whole loop end to end. GitHub sync, the MCP server, and the full dashboards come later.

## User Stories

1. As a User, I want to log in with my email and password, so that only I can see my Projects
2. As a User, I want my session to persist securely in the browser, so that I don't log in on every page
3. As a User, I want to log out, so that nobody can use my session on a shared machine
4. As a User, I want repeated failed logins to lock the account for a while, so that my password can't be guessed
5. As an Admin, I want the first account created at setup to become the Admin, so that the panel is never open to strangers
6. As an Admin, I want to generate a single-use expiring Invite link, so that I can onboard another User without email
7. As an invited person, I want to open an Invite link and set my password, so that I get my own User account
8. As an invited person, I want an expired or already-used Invite to be rejected, so that old links are harmless
9. As an Admin, I want to revoke a User's access, so that a former collaborator is locked out
10. As a User, I want to create a local Project with a name, so that I have a place to track an Agent's work
11. As a User, I want to see only the Projects I own, so that other Users' work stays private
12. As a User, I want to generate a named API key for a Project, so that an Agent can connect to that Project
13. As a User, I want to see an API key only once when it is generated, so that it cannot be read from the panel later
14. As a User, I want to revoke a Project's API key, so that a leaked or retired key stops working immediately
15. As a User, I want an API key to work only for its own Project, so that a leaked key exposes one Project only
16. As an Agent, I want to authenticate with a Project API key, so that the panel knows which Project I am working on
17. As an Agent, I want to send a self-chosen label with each request, so that the User can tell parallel Agents apart
18. As an Agent, I want to raise a Decision with a question and a list of options, so that the User can choose from exactly what I asked
19. As an Agent, I want to allow free-text answers on a Decision only when I choose to, so that I control what kind of answer I receive
20. As an Agent, I want to set an optional expiry on a Decision, so that stale questions don't block forever
21. As an Agent, I want to wait for a Decision's answer with a long-poll that times out and can be retried, so that I get the answer quickly without holding a connection forever
22. As an Agent, I want the long-poll to return immediately if the Decision is already answered, so that I never miss an answer given while I was disconnected
23. As an Agent, I want to cancel an open Decision I no longer need, so that the User isn't asked an obsolete question
24. As an Agent, I want a clear error when I try to raise a Decision for a Project my key doesn't cover, so that I notice a misconfiguration
25. As a User, I want a Decisions inbox listing open Decisions across my Projects, so that I see everything waiting on me in one place
26. As a User, I want each Decision to show its Project, the Agent's label, the question, and the options, so that I have the context to answer
27. As a User, I want to answer a Decision by picking one of the exact options, so that the Agent receives an unambiguous answer
28. As a User, I want to type a free-text answer only when the Agent allowed it, so that I can't send an answer the Agent can't handle
29. As a User, I want a Decision to be answerable only once, so that two clicks or two tabs can't give the Agent conflicting answers
30. As a User, I want a Decision to show as expired or cancelled and refuse answers once it is, so that I never answer a dead question
31. As a User, I want a newly raised Decision to appear in my open browser page without a refresh, so that I notice it quickly
32. As a User, I want an answered Decision to disappear from the open list, so that the inbox only shows what still needs me
33. As a User, I want to see answered, cancelled and expired Decisions in a history, so that I can recall what was decided
34. As a User, I want no other User ever to see or answer my Decisions, so that my Projects stay private
35. As an operator of the VPS, I want the whole stack started with one Docker command, so that deployment is repeatable
36. As an operator of the VPS, I want nginx to be the only public entry point and the API and database to be unreachable directly, so that the attack surface is small
37. As an operator of the VPS, I want HTTPS on an `sslip.io` hostname with a free Let's Encrypt certificate that renews automatically, so that passwords and keys are encrypted without owning a domain
38. As an operator of the VPS, I want nginx to rate-limit login and invite-accept, so that brute-force attempts are slowed
39. As an operator of the VPS, I want a daily local backup of the SQLite file keeping the last 7, so that I can recover from corruption or a bad deploy
40. As a future maintainer, I want every owned row to carry its owner's `user_id`, so that a later move to Postgres and per-User checks stay simple

## Implementation Decisions

- **Stack:** TypeScript on Node for the API, Vite for the web frontend, SQLite for storage. All tools are free and open source. Docker runs everything, with nginx as the only public service.
- **Repo shape:** one npm-workspaces repo with an API app, a web app, and a shared-types package, with room for an MCP app later.
- **Domain language:** User, Admin, Invite, Agent, Project, Issue, Decision, Progress report, as defined in `GLOSSARY.md`. This slice builds User, Admin, Invite, Project, Decision, and the Agent's key-based access. Issue and Progress report are modeled later.
- **Ownership:** every owned record carries `user_id`, and every read and write is checked against the caller's User. A Project belongs to exactly one User.
- **Auth for Users:** email and password stored as a slow salted hash, with a secure, HttpOnly, SameSite session cookie, and CSRF protection on state-changing browser requests. Failed logins are counted per account and lock it temporarily.
- **Admin and Invites:** the first account created at setup becomes the Admin. Invites are single-use, expiring, and generated by the Admin only. There is no open signup and no email.
- **Project API keys:** one or more named, revocable keys per Project. Only a hash is stored. The plain key is shown once at creation. A key authorizes actions on its own Project only.
- **Agent identity:** a free-text label sent with each request and stored on what it creates. There is no Agent registry and the label is not authenticated.
- **Decision model:** a question, a list of options supplied by the Agent, a flag for whether free text is allowed, an optional expiry, and a state of `open`, `answered`, `cancelled` or `expired`. It records the answer, who answered, and when. It can be answered at most once.
- **Decision state rules:** only `open` Decisions can be answered or cancelled. Expiry is evaluated when the Decision is read or answered, so no background job is required. Terminal states are final.
- **Long-poll:** the wait endpoint holds the request until the Decision leaves `open` or a server timeout passes, and replies with the current state. If the Decision is already answered, it replies immediately. The Agent retries on timeout.
- **Live updates:** the browser receives new and changed Decisions over server-sent events, scoped to the signed-in User. nginx is configured so the event stream is not buffered.
- **API contract (Agent side, REST):** create a Decision, wait for a Decision, cancel a Decision. Authenticated with a Project key and an Agent label.
- **API contract (browser side, REST):** log in, log out, accept an Invite, create and list Projects, create and revoke Project keys, list Decisions, answer a Decision, and a live event stream. Admin-only: create an Invite and revoke a User.
- **Frontend screens in this slice:** login, Invite acceptance, a Projects list with key management, and the Decisions inbox with history. The full Projects dashboard and Project page come later.
- **Deployment:** Docker Compose runs nginx, the API, and a certbot renewal job. nginx terminates TLS on an `sslip.io` hostname derived from the VPS IP, redirects HTTP to HTTPS, serves the built frontend at the root, proxies the API under a path prefix, and rate-limits login and Invite acceptance. The API and SQLite are on the internal Docker network only.
- **Backups:** a scheduled job copies the SQLite file daily using a safe online method and keeps the last 7 copies on the VPS.
- **ADRs respected:** 0001 (GitHub App access) and 0002 (local Issues in the panel database) don't change this slice, but the schema must not block them.

## Testing Decisions

- **Single seam:** the panel's HTTP API, exercised through the running stack against a throwaway SQLite database. Tests behave like an Agent or the browser would: log in, create a Project, generate a key, raise a Decision, wait, answer, and check the wait returns.
- **What makes a good test here:** it asserts only observable behavior, such as status codes, response bodies, and what another caller can or cannot see. It does not assert on internal modules, table layout, or call order.
- **Behaviors that must be covered:**
  - ownership isolation, so one User never sees or answers another User's Projects or Decisions
  - a key works only for its own Project and stops working once revoked
  - a Decision can be answered once and refuses later answers, cancels, and answers after expiry
  - free text is accepted only when the Agent allowed it, and options must match exactly
  - the long-poll returns immediately for an already-answered Decision and returns on timeout otherwise
  - Invites are single-use and expire, and login lockout engages after repeated failures
- **One browser smoke test** with Playwright (free): log in, see a raised Decision appear, pick an option, and confirm the Agent-side wait returns that answer. It checks the same flow and is not a second seam.
- **Prior art:** none, the repo is empty. These tests set the pattern for later slices.
- **Build method:** each behavior starts with a failing test, then the code to pass it.

## Out of Scope

- GitHub App registration, GitHub sync, webhooks, and write-back
- Issues, Progress reports, and their statuses
- The MCP server
- The full Projects dashboard and Project page
- Email sending, password reset flows, and multi-factor login
- Sharing a Project between Users
- Off-site backups and Postgres
- Any handling of LLM credentials, which the panel never touches

## Further Notes

- The panel must never store or receive an Agent's LLM subscription or API key.
- Passwords, session cookies, and keys must be protected by HTTPS before the first Invite is issued.
- All dependencies and services must be free and open source.
- rpanel becomes its own first Project once it works, tracked in GitHub.
