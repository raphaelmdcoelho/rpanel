# rpanel

A central panel where Users and their Agents track the status of parallel Projects, and where Agents ask Users to take Decisions.

## Language

**User**:
A human who logs in to the panel and sees only the Projects they own.
_Avoid_: Operator, admin, customer

**Admin**:
The first User, who invites other Users and revokes their access.
_Avoid_: Owner, superuser

**Invite**:
A single-use, expiring link an Admin generates and hands to a person so they can create a User account.
_Avoid_: Signup link, registration

**Agent**:
An AI coding session that authenticates to the panel API on behalf of a User and works on a Project.
_Avoid_: Bot, worker, client

**Project**:
A unit of work owned by one User. Its source, either a GitHub repo or local, is chosen when the Project is created and never mixes.
_Avoid_: Repo, workspace

**Issue**:
A work item belonging to a Project. In a GitHub Project it mirrors a GitHub issue; in a local Project it exists only in the panel.
_Avoid_: Ticket, task

**Decision**:
A question raised by an Agent, with the exact multiple-choice options the Agent supplied, and optionally a free-text answer if the Agent allows it. A User answers it once through the panel.
_Avoid_: Approval, prompt, question

**Progress report**:
A status note an Agent attaches to an Issue describing what was implemented.
_Avoid_: Log, update
