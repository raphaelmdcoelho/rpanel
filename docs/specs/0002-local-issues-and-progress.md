# Spec: Local Issues, Progress reports, Project page and status dashboard

Blocked by #1 (walking skeleton). Reuses its login, Project, and Project API key behaviour.

## Problem Statement

Today I can see an Agent's questions, but not what the Agent has done or what is left. For local Projects there is no list of work items, and no way to tell at a glance which Project is blocked, which is moving, and which has finished work. I still have to open local directories or ask the Agent.

## Solution

A local Project gets Issues that Agents create and update through the API, and Progress reports that Agents attach to Issues to say what was implemented. The User sees a Projects dashboard with the status of every Project at a glance, and a Project page listing its Issues, their statuses, and their Progress reports and open Decisions.

## User Stories

1. As an Agent, I want to create an Issue in my Project with a title and description, so that planned work is recorded in the panel
2. As an Agent, I want a new Issue to start as `todo`, so that its state is predictable
3. As an Agent, I want to move an Issue between `todo`, `in progress`, `blocked` and `done`, so that the panel reflects the real state of the work
4. As an Agent, I want to edit an Issue's title and description, so that the record stays accurate as the work is understood
5. As an Agent, I want to post a Progress report on an Issue, so that the User can see what was implemented
6. As an Agent, I want each Progress report to carry my label, so that the User knows which Agent did the work
7. As an Agent, I want to read back the list of Issues in my Project, so that I can pick up work and avoid duplicates
8. As an Agent, I want to read one Issue with its Progress reports, so that I can continue earlier work
9. As an Agent, I want to link an Issue to a Decision I raised about it, so that the User sees why the Issue is blocked
10. As an Agent, I want a clear error when I reference an Issue from another Project, so that I notice a misconfiguration
11. As an Agent, I want to mark an Issue `blocked` with a short reason, so that the User knows what is holding it up
12. As a User, I want a Projects dashboard showing every Project I own, so that I see all of them without opening tabs
13. As a User, I want each Project on the dashboard to show counts of Issues by status, so that I can judge progress quickly
14. As a User, I want each Project on the dashboard to show how many Decisions are waiting on me, so that I know where I am the bottleneck
15. As a User, I want each Project on the dashboard to show when it last had activity, so that I can spot stalled Projects
16. As a User, I want blocked Projects to stand out on the dashboard, so that I deal with them first
17. As a User, I want to open a Project page, so that I can see its detail
18. As a User, I want the Project page to list Issues grouped or filterable by status, so that I can focus on what matters
19. As a User, I want to open an Issue and read its description and Progress reports in order, so that I understand what happened
20. As a User, I want the Project page to show that Project's open Decisions, so that I can answer them in context
21. As a User, I want to see what was implemented, meaning the `done` Issues and their Progress reports, separately from what is still planned, so that I can answer "what is built and what is left"
22. As a User, I want to change an Issue's status from the panel, so that I can correct or override the Agent
23. As a User, I want to create an Issue from the panel, so that I can add work for the Agents myself
24. As a User, I want changes made by Agents to appear in my open page without a refresh, so that the view is always current
25. As a User, I want the dashboard and Project page to show only my own Projects and Issues, so that other Users never see them
26. As a User, I want an Issue's history to show who changed its status and when, so that I can see how work moved
27. As a User, I want a Progress report to show its Agent label and time, so that I can follow a timeline across parallel Agents
28. As a User, I want to see an empty Project clearly labelled as having no Issues yet, so that I know nothing is broken
29. As a User, I want to archive a finished Project, so that it stops cluttering the dashboard
30. As a User, I want to unarchive a Project, so that I can bring work back

## Implementation Decisions

- **Domain language:** this slice builds Issue and Progress report as defined in `GLOSSARY.md`. Issues here belong to local Projects only, per ADR 0002: the panel database is the source of truth and Agents write through the API.
- **Issue model:** a title, a description, a status, a source of `local`, the owning Project, and the owning User. Every owned row carries `user_id`.
- **Statuses:** exactly `todo`, `in progress`, `blocked`, `done`. A new Issue starts as `todo`. Any status can move to any other status. `blocked` takes an optional short reason.
- **Progress report model:** an Issue, an Agent label, free text, and a timestamp. Reports are append-only and cannot be edited or deleted in this slice.
- **Status history:** every status change is recorded with who made it, either a User or an Agent label, and when.
- **Decision link:** an Issue may reference a Decision raised on the same Project. The link is informational and does not block anything by itself.
- **Dashboard figures:** per Project, the Issue counts by status, the number of open Decisions, and the time of the most recent activity. A Project counts as blocked when it has a `blocked` Issue or an open Decision.
- **Archive:** archiving hides a Project from the default dashboard and refuses new Issues and Decisions on it. It does not delete anything.
- **API contract (Agent side):** create, update and list Issues, read one Issue with its reports, post a Progress report, set status. All use a Project key and an Agent label, and all are scoped to that Project.
- **API contract (browser side):** list Projects with their summary figures, read a Project page, list and read Issues, create an Issue, change status, archive and unarchive.
- **Live updates:** the existing event stream carries Issue and report changes for the signed-in User only.
- **Frontend screens:** the Projects dashboard, the Project page with its Issue list, and an Issue detail view.
- **Out-of-order safety:** two writers changing the same Issue at once must not corrupt it. The last write wins and both changes appear in history.

## Testing Decisions

- **Seam:** the panel's HTTP API through the running stack, the same single seam as #1. No new seam is introduced.
- **A good test** asserts observable behavior only: responses, counts, ordering, and what another caller can or cannot see. It does not assert on table layout or internal calls.
- **Behaviors that must be covered:**
  - ownership isolation, so one User never sees another User's Issues, reports or dashboard figures
  - a Project key can only touch Issues in its own Project
  - status transitions, history entries, and the blocked-with-reason case
  - dashboard counts and the blocked flag matching the underlying Issues and Decisions
  - archived Projects refuse new Issues and Decisions but still read correctly
  - Progress reports are ordered and append-only
- **Browser:** extend the single Playwright smoke test from #1 with one flow: an Agent creates an Issue and a report, and the User sees both appear on the Project page.
- **Prior art:** the API test pattern and fixtures established by #1.
- **Build method:** each behavior starts with a failing test.

## Out of Scope

- GitHub-backed Issues, labels, and write-back, which belong to the GitHub sync spec
- Issue comments, assignees, due dates, priorities, and custom fields
- Editing or deleting Progress reports
- Sharing a Project between Users
- The MCP server

## Further Notes

- The panel must never store or receive an Agent's LLM credentials.
- All dependencies must be free and open source.
- Statuses were chosen to map onto GitHub's open and closed states in the GitHub sync spec.
