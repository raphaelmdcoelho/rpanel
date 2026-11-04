# Spec: Admin and operations polish

Blocked by #1 (walking skeleton). Completes the administration and operations stories that the first slice only started.

## Problem Statement

The panel is public and holds my Projects. Beyond the first slice's basics, I need to manage who has access and keys, be sure the HTTPS certificate keeps renewing, and be able to recover from a bad deploy or data loss. Without that, the panel is risky to keep running and to share with anyone else.

## Solution

Admin screens to manage Users, Invites and Project keys, an audit trail of security-relevant events, a verified automatic HTTPS renewal, and a backup routine that I can actually restore from, all proven by tests and a deployment smoke test.

## User Stories

1. As an Admin, I want a Users page listing every User and their status, so that I know who has access
2. As an Admin, I want to generate an Invite from a screen, so that I don't need the API directly
3. As an Admin, I want to see outstanding, used, and expired Invites, so that I can tidy up
4. As an Admin, I want to revoke an unused Invite, so that a link I regret sending stops working
5. As an Admin, I want to disable a User, so that they are logged out and cannot log in
6. As an Admin, I want to re-enable a disabled User, so that a mistake is reversible
7. As an Admin, I want a disabled User's Project keys to stop working, so that their Agents are cut off too
8. As an Admin, I want to be unable to disable the last remaining Admin, so that I can't lock myself out
9. As a User, I want to change my own password, so that I can rotate it
10. As a User, I want changing my password to log out my other sessions, so that a stolen session ends
11. As a User, I want to see my active sessions and end any of them, so that I can control where I am logged in
12. As a User, I want a Keys page listing every Project key with its name, Project, creation time, and last use, so that I can spot unused or suspicious keys
13. As a User, I want to revoke a key from that page, so that I can cut an Agent off immediately
14. As a User, I want a revoked key to stay listed as revoked, so that I keep a record
15. As an Admin, I want an audit trail of logins, failed logins, lockouts, Invites, revocations, and key creation and revocation, so that I can investigate problems
16. As an Admin, I want each audit entry to show who, what, when, and from where, so that it is useful
17. As an Admin, I want the audit trail never to contain passwords or key values, so that it isn't itself a leak
18. As an operator, I want the HTTPS certificate to renew automatically, so that the panel never breaks with an expired certificate
19. As an operator, I want a visible check that shows the certificate's expiry date, so that I notice if renewal has silently failed
20. As an operator, I want a health endpoint reporting that the API and database are working, so that I can monitor it simply
21. As an operator, I want the daily backup to be verified after it runs, so that a corrupt backup is noticed
22. As an operator, I want a documented one-command restore from a backup, so that recovery is practiced and quick
23. As an operator, I want the restore to be tested, so that I know the backups actually work
24. As an operator, I want old backups beyond the last 7 removed automatically, so that the disk does not fill up
25. As an operator, I want a failed backup or renewal to be easy to see, so that I'm not relying on luck
26. As an operator, I want a deployment smoke test that starts the stack, hits the public path through nginx, and checks login, so that a bad deploy is caught
27. As an operator, I want secrets such as the session key and any App credentials kept outside the repo and the image, so that nothing sensitive is committed
28. As an operator, I want clear setup documentation for a fresh VPS, so that I can rebuild the panel from scratch
29. As a User, I want security headers set on every response, so that common browser attacks are blocked
30. As a User, I want all state-changing browser requests protected against cross-site request forgery, so that another site cannot act as me

## Implementation Decisions

- **Admin screens:** Users, Invites, and a cross-Project Keys page, using the API behaviours from #1 and adding what they lack.
- **User status:** a User is active or disabled. Disabling ends their sessions and makes all their Project keys stop working. The last Admin cannot be disabled.
- **Sessions:** a User can list and end their sessions. Changing a password ends all other sessions.
- **Keys page:** shows name, Project, creation time, and last-used time per key. Revoked keys remain listed.
- **Audit trail:** a stored, append-only record of security-relevant events with who, what, when, and source address. It never stores secrets. Only Admins can read it, and it is read-only in the UI.
- **Certificate renewal:** automatic through the existing certbot job from #1, with the certificate expiry date exposed to the Admin.
- **Health endpoint:** public and minimal, reporting only whether the API and database are reachable and revealing no internal details.
- **Backups:** the daily SQLite copy from #1 is verified after it is taken. The last 7 are kept. A documented command restores from a chosen backup.
- **Deployment smoke test:** brings up the full stack and checks the public path through nginx, including login and the health endpoint.
- **Secrets:** all secrets come from files or the environment outside the repo and images.
- **Security headers and CSRF:** applied consistently, with CSRF protection on every state-changing browser request.
- **Documentation:** a fresh-VPS setup guide covering Docker, nginx, certificate, secrets, backups, and restore.

## Testing Decisions

- **Seam:** the panel's HTTP API through the running stack, as in #1. One extra deployment smoke test runs against the full Docker stack through nginx.
- **A good test** asserts observable behavior, such as disabled Users being unable to log in, revoked keys returning errors, and the audit trail containing the right entries without secrets.
- **Behaviors that must be covered:**
  - disabling and re-enabling a User, session termination, and Project keys stopping and not resuming incorrectly
  - the last Admin protection
  - Invite revocation and states
  - password change ending other sessions
  - key listing, last-used tracking, and revocation records
  - audit entries for each security event and the absence of secrets in them
  - CSRF rejection and the presence of security headers
  - the health endpoint's output
  - backup creation, verification, retention to 7, and a real restore into a fresh database
- **Prior art:** the HTTP seam and fixtures from #1.
- **Build method:** each behavior starts with a failing test.

## Out of Scope

- Multi-factor login and password reset by email
- Off-site backups and offsite log shipping
- Monitoring dashboards, alerting services, and metrics systems
- Postgres and high availability
- GitHub sync and the MCP server

## Further Notes

- Certificate renewal can only be fully proven on the real VPS, so the deployment smoke test checks the expiry date and not the renewal itself.
- All dependencies must be free and open source.
