# Spec: MCP server exposing the Agent actions as tools

Blocked by #1 (Decisions and Project keys) and #2 (Issues and Progress reports).

## Problem Statement

An Agent can use the panel through its REST API, but each Agent has to be told how to call it, build the requests, and handle the long-poll. That is fragile and repeated for every Agent session. Claude Code Agents already know how to use MCP tools.

## Solution

A small MCP server that an Agent runs on its own machine. It exposes the panel's Agent actions as tools, such as raising a Decision and posting a Progress report, and it calls the panel's REST API underneath. The User configures it once with the panel address and a Project key, and any Agent can use the panel without custom prompting.

## User Stories

1. As an Agent, I want a tool to raise a Decision with a question and options, so that I can ask the User without building HTTP requests
2. As an Agent, I want a tool to wait for a Decision's answer, so that I can continue once the User responds
3. As an Agent, I want the wait tool to handle the panel's long-poll timeouts itself, so that I don't loop manually
4. As an Agent, I want the wait tool to stop after a total time I choose, so that I am never stuck forever
5. As an Agent, I want to learn from the wait tool whether the Decision was answered, cancelled, expired, or still open, so that I can act correctly
6. As an Agent, I want a tool to cancel a Decision, so that I can withdraw an obsolete question
7. As an Agent, I want a tool to create an Issue, so that I can record planned work
8. As an Agent, I want a tool to update an Issue's title, description, or status, so that the panel stays accurate
9. As an Agent, I want a tool to post a Progress report on an Issue, so that I can say what I implemented
10. As an Agent, I want a tool to list and read Issues, so that I can pick up work and avoid duplicates
11. As an Agent, I want every call to carry my label automatically, so that I don't repeat it each time
12. As a User, I want to set the Agent label once in the configuration, so that parallel Agents are distinguishable
13. As a User, I want to configure the panel address and Project key in one place, so that setup is quick
14. As a User, I want the key read from configuration or the environment and never printed in output or logs, so that it doesn't leak
15. As a User, I want the server to run on my own machine, so that nothing about my LLM subscription ever reaches the panel
16. As a User, I want the server to work with Claude Code's MCP configuration, so that I add it with one entry
17. As an Agent, I want a clear error when the panel is unreachable, so that I can tell the User instead of hanging
18. As an Agent, I want a clear error when the key is wrong or revoked, so that I stop and report it
19. As an Agent, I want a clear error when I send an invalid request, so that I can correct it
20. As an Agent, I want the tool descriptions to say exactly when to use each one, so that I pick the right tool
21. As an Agent, I want the Decision tool to make the options exactly the strings I pass, so that the User's answer is unambiguous
22. As an Agent, I want a tool option to allow free-text answers, so that I can ask open questions when I choose to
23. As a User, I want the same behavior through the MCP server as through the REST API, so that the two never disagree
24. As a User, I want the server to use free, open-source libraries only, so that there are no paid dependencies
25. As a maintainer, I want the tool names and inputs documented, so that Agents and Users know what is available

## Implementation Decisions

- **Placement:** the MCP server is its own app in the repo and talks to the panel only over the public REST API, so it needs no database access and behaves like any other Agent client.
- **Transport:** it runs locally on the Agent's machine as a standard-input and standard-output MCP server. The User adds it to the Agent's MCP configuration.
- **Configuration:** panel address, Project key, and Agent label, supplied by environment variables or a config entry. The key is never echoed.
- **Tools:** raise a Decision, wait for a Decision, cancel a Decision, create an Issue, update an Issue, list Issues, read an Issue, and post a Progress report.
- **Wait behavior:** the wait tool repeats the panel's long-poll until the Decision leaves `open` or the caller's total timeout passes. It returns the state and, if answered, the chosen option or free text.
- **Decision input:** options are passed through unchanged. Free text is off unless the caller turns it on.
- **Errors:** unreachable panel, rejected key, and invalid input each produce a distinct, readable tool error and never expose the key.
- **No logic of its own:** validation, ownership, and state rules stay in the panel. The server only translates tool calls to API calls and back.
- **Documentation:** a short reference of tool names, inputs, and an example configuration for Claude Code.

## Testing Decisions

- **Seam:** the MCP tool interface. Tests start the MCP server, call its tools as an Agent would, and run against a real panel started from the stack in #1 with its throwaway database.
- **A good test** asserts what the tool returns and what the panel then shows, not how the server builds its requests.
- **Behaviors that must be covered:**
  - raising a Decision and seeing it in the panel, then answering it and having the wait tool return the answer
  - the wait tool surviving several long-poll timeouts, and stopping at the caller's total timeout
  - cancel, expiry, and already-answered cases
  - Issue create, update, list, read, and Progress report round trips
  - the Agent label appearing on everything created
  - wrong key, revoked key, unreachable panel, and bad input producing the right errors
  - the key never appearing in tool output or logs
- **Prior art:** the HTTP test fixtures and running-stack setup from #1 and #2.
- **Build method:** each behavior starts with a failing test.

## Out of Scope

- A hosted or remote MCP server on the VPS
- Tools for GitHub sync, User management, Invites, or Project creation
- Any handling of LLM credentials
- Browser-side use of MCP
- Agent registries or authenticated Agent labels

## Further Notes

- Because the server runs on the User's machine, the panel only ever sees the Project key and the Agent label.
- All dependencies must be free and open source.
