<!-- BEGIN:rtk-agent-rules -->

# Use RTK Skill First

Always use the RTK skill before doing any task.

<!-- END:rtk-agent-rules -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:session-continuation-rules -->

# Session Continuation and Handoff

When the user provides a handoff document, read it first and treat it as the current working context. Prefer following its referenced files, decisions, constraints, and recommended next steps before re-discovering the whole project.

If the handoff conflicts with the current code, git state, or newer user instructions, trust the current code and latest user instructions. Report the mismatch briefly before proceeding.

When preparing a handoff for a future session, keep it compact and action-oriented. Include the current objective, what has been done, important decisions and constraints, relevant files or commands, open questions, suggested skills, and recommended next steps. Store temporary handoff documents outside the workspace unless the user explicitly asks to commit them.

<!-- END:session-continuation-rules -->

# Git Rule
<!-- BEGIN:github-rules -->
- Do not run any Git command that changes repository state unless the user explicitly requests that exact action.
- Read-only Git commands such as `git status`, `git diff`, and `git log` are allowed.
- Never automatically stage, commit, amend, push, pull, merge, rebase, reset, checkout, switch, stash, tag, or create/delete branches.
<!-- END:github-rules -->
