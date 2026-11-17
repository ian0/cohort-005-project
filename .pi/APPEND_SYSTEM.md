## Skills

- "Call the Skill tool with X" means: read `.agents/skills/X/SKILL.md` in full and follow it.

## Sub-agent delegation (pre-authorized)

- The `grilling`, `wayfinder`, and `research` skills may dispatch sub-agents without asking. Call `subagents_enable` as needed.
  - Codebase facts (code, `GLOSSARY.md`, docs, closed tickets): the `scout` agent.
  - External facts (vendor docs, APIs, pricing): the `researcher` agent.
- Before the first round of a grilling session, dispatch any fact-finding sub-agents the frontier needs and wait for all of them to return (run them in the foreground, or use `bg_wait`) before asking any questions. After round 1, follow the grilling skill: don't block questions that don't depend on a running exploration.
