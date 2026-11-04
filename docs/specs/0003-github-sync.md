# Spec: GitHub sync — mirror GitHub Issues and write status changes back

Blocked by #2 (local Issues and Progress reports). Reuses its Issue model, statuses, and Project page. Implements ADR 0001.

## Problem Statement

My GitHub Projects live on GitHub, so to see their status I open a GitHub tab per repo. When an Agent finishes a feature, I want the GitHub issue to move too, without me doing it. Today the panel cannot see GitHub at all.

## Solution

A User creates a Project with a GitHub source, installs the panel's GitHub App on the chosen repo, and the repo's issues appear in the panel as Issues. GitHub is the source of truth. Changes on GitHub reach the panel by webhook, with a slow poll as a safety net. When an Agent or the User changes an Issue's status in the panel, the change is written back to GitHub.

## User Stories

1. As a User, I want to create a Project with a GitHub source, so that its Issues come from my repo
2. As a User, I want to choose the Project's source when I create it, so that a Project is either GitHub or local and never both
3. As a User, I want to install the panel's GitHub App on only the repos I pick, so that it can touch nothing else
4. As a User, I want the panel to list the repos the App can see for me, so that I can pick one when creating a Project
5. As a User, I want the panel to hold no personal GitHub token for me, so that a database leak exposes no GitHub credentials
6. As a User, I want my repo's existing issues to appear as Issues in the panel after I connect it, so that I see the real state straight away
7. As a User, I want new, edited, closed and reopened GitHub issues to show up in the panel within seconds, so that the panel stays current
8. As a User, I want the panel to still catch up if a webhook is missed, so that nothing stays stale
9. As a User, I want GitHub to win when the panel and GitHub disagree, so that I can trust GitHub as the source
10. As a User, I want a GitHub Issue in the panel to show its number, title, body, labels, and a link to GitHub, so that I can jump to the original
11. As a User, I want an open GitHub issue to show as `todo` and a closed one as `done`, so that the statuses line up
12. As a User, I want `in progress` and `blocked` to be representable on GitHub, so that the richer statuses survive the round trip
13. As a User, I want to change an Issue's status in the panel and see GitHub change to match, so that I don't update two places
14. As an Agent, I want my status changes on a GitHub-backed Issue to be written back to GitHub, so that the repo reflects my progress
15. As an Agent, I want to post a Progress report on a GitHub-backed Issue and have it appear as a comment on the GitHub issue, so that the repo records what was implemented
16. As an Agent, I want a failed write-back to be reported to me, so that I don't think a change reached GitHub when it didn't
17. As a User, I want a failed write-back to be visible on the Issue and retried, so that a brief GitHub outage doesn't lose changes
18. As a User, I want to see when an Issue was last synced, so that I know how fresh it is
19. As a User, I want to trigger a manual re-sync of a Project, so that I can force an update
20. As a User, I want GitHub-backed Issues to appear on the same dashboard and Project page as local ones, so that I have one view
21. As a User, I want the dashboard counts to include GitHub-backed Issues, so that the figures are complete
22. As a User, I want only webhook deliveries that GitHub actually signed to be accepted, so that nobody can forge changes
23. As a User, I want webhook deliveries for an unknown repo or an uninstalled App to be ignored safely, so that the panel doesn't break
24. As a User, I want repeated deliveries of the same webhook to cause no duplicate changes, so that retries from GitHub are harmless
25. As a User, I want to disconnect a Project from GitHub, so that I can stop syncing without deleting the panel record
26. As a User, I want uninstalling the App on GitHub to be noticed, so that the Project shows as disconnected and not silently stale
27. As a User, I want my sync to respect GitHub rate limits, so that heavy use cannot get the App blocked
28. As a User, I want only my own Projects' GitHub data visible to me, so that other Users never see my repos
29. As an Admin, I want the App's private key to live outside the database, so that a database leak cannot be used to act on GitHub
30. As an Admin, I want a clear setup guide for registering the App and setting its webhook address and secret, so that registration is repeatable

## Implementation Decisions

- **ADR 0001 applies:** access is through a GitHub App. Its private key lives in a file or Docker secret outside the database, and installation tokens are generated on demand and expire after about an hour. The database stores only the installation id and the Project-to-repo link.
- **Project source:** chosen at creation and fixed. A GitHub Project links to exactly one repo.
- **Source of truth:** GitHub, for GitHub-backed Issues. The panel mirrors them. On conflict the next sync overwrites the panel.
- **Status mapping (proposal, confirm during build):** open on GitHub maps to `todo` and closed maps to `done`. The richer statuses `in progress` and `blocked` are carried as GitHub labels, for example `status:in-progress` and `status:blocked`, created if missing. An open issue with one of those labels shows the matching status.
- **Inbound sync:** webhooks first, with a poll every 10 to 15 minutes as a fallback. Inbound handling is idempotent, so a repeated delivery changes nothing.
- **Webhook security:** every delivery's signature is verified against the App's webhook secret before anything is read. Unsigned or wrongly signed deliveries are rejected. The webhook address is on the public HTTPS hostname from #1.
- **Outbound write-back:** status changes and Progress reports are written to GitHub, as state or labels and as comments. Failures are stored on the Issue, shown to the User, retried with back-off, and reported to the Agent calling the API.
- **Progress reports on GitHub:** each report is posted as a comment, marked with the Agent label so it can be told apart from human comments.
- **Mirrored fields:** number, title, body, labels, state, URL, last synced time. The panel does not mirror comments in this slice.
- **Disconnect and uninstall:** both leave the panel's Issues in place and mark the Project as disconnected until reconnected.
- **Rate limits:** the sync respects GitHub's rate-limit headers and slows down before it is blocked.
- **Frontend:** a Project creation form with a source choice, a repo picker after the App is installed, and sync status on the Project page.
- **Admin documentation:** a setup guide for registering the App, its minimum permissions (issues read and write), the webhook URL, and where the key and secret go.

## Testing Decisions

- **Seam:** the panel's HTTP API through the running stack, with GitHub replaced by a fake GitHub server that speaks the same API and can send signed webhooks. No real GitHub calls in tests.
- **A good test** asserts observable behavior: what the Project shows after a delivery, what the fake GitHub received after a status change, and what other Users can see.
- **Behaviors that must be covered:**
  - signed webhooks are applied, and unsigned or tampered ones are rejected
  - repeated deliveries are idempotent
  - the poll recovers an Issue after a missed webhook
  - GitHub wins when the panel and GitHub disagree
  - status changes and Progress reports reach the fake GitHub, and failures are surfaced and retried
  - `in progress` and `blocked` round-trip through labels
  - no credentials or private key appear in the database
  - ownership isolation between Users' Projects and repos
  - uninstall and disconnect leave the Project readable
- **Prior art:** the HTTP seam and fixtures from #1 and #2.
- **Build method:** each behavior starts with a failing test.

## Out of Scope

- Mirroring GitHub comments, pull requests, milestones, and assignees
- Creating GitHub issues from local Issues
- A Project mixing GitHub and local Issues
- OAuth apps and personal access tokens
- GitLab or other trackers

## Further Notes

- Registering the GitHub App is a manual step that needs the User's GitHub account. The build should provide the guide, not attempt to automate registration.
- GitHub must be able to reach the webhook URL, so HTTPS from #1 must be live first.
- All dependencies must be free and open source.
