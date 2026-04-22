# claudekit Documentation

A toolkit of custom commands, hooks, and utilities for Claude Code.

## Quick Start

- **[Installation](getting-started/installation.md)** — Get up and running
- **[Configuration](getting-started/configuration.md)** — Setup and common configurations
- **[Troubleshooting](getting-started/troubleshooting.md)** — Common issues and solutions

## Guides

| Guide | Description |
|-------|-------------|
| [Codebase Map](guides/codebase-map.md) | Automatic project context for AI assistants |
| [Checkpoint System](guides/checkpoint.md) | Git checkpointing and safe development |
| [File Guard](guides/file-guard.md) | Protect sensitive files from AI access |
| [Hook Profiling](guides/hook-profiling.md) | Measure and optimize hook performance |
| [Thinking Level](guides/thinking-level.md) | Configure AI reasoning enhancement |
| [Session Hook Control](guides/session-hook-control.md) | Temporarily disable/enable hooks per session |
| [Self Review](guides/self-review.md) | Automated code quality validation |
| [Spec Workflow](guides/spec-workflow.md) | Specification-driven development |
| [Research Workflow](guides/research-workflow.md) | Multi-agent parallel research |
| [Project Organization](guides/project-organization.md) | File and directory structure conventions |
| [AI Migration](guides/ai-migration.md) | Migrate from other AI coding tools |
| [Using Prompts with External LLMs](guides/using-prompts-with-external-llms.md) | Extract prompts for other tools |

### Hook Guides

| Guide | Description |
|-------|-------------|
| [TypeScript Hooks](guides/typescript-hooks.md) | Type checking on file changes and project |
| [ESLint Hooks](guides/eslint-hooks.md) | Linting on file changes and project |
| [Test Hooks](guides/test-hooks.md) | Run tests on file changes and project |
| [Check Any Changed](guides/check-any-changed.md) | Forbid `any` types in TypeScript |
| [Check Comment Replacement](guides/check-comment-replacement.md) | Detect code replaced with comments |
| [Git Workflow](guides/git-workflow.md) | Git commands with safety checks |

## Reference

| Reference | Description |
|-----------|-------------|
| [CLI Reference](reference/cli.md) | `claudekit` and `claudekit-hooks` commands |
| [Slash Commands](reference/commands.md) | All available slash commands |
| [Hooks Reference](reference/hooks.md) | All hooks and their configurations |
| [Subagents](reference/subagents.md) | 35 specialized AI subagents |

## Official Claude Code Docs

| Document | Description |
|----------|-------------|
| [CLI](official/cli.md) | Official Claude Code CLI reference |
| [Commands](official/commands.md) | Built-in slash commands |
| [Hooks](official/hooks.md) | Hooks system documentation |
| [Subagents](official/subagents.md) | Subagent system documentation |

## Integrations

| Integration | Description |
|-------------|-------------|
| [Publishing & CI/CD](integrations/publishing.md) | NPM publishing via GitHub Actions |
| [MCP Context7](integrations/mcp-context7.md) | Library documentation access |
| [Oracle](integrations/oracle.md) | Deep debugging with external AI tools |
| [STM Tasks](integrations/stm-tasks.md) | Task management integration |

## Internals

For contributors and advanced users:

| Document | Description |
|----------|-------------|
| [Creating Commands](internals/creating-commands.md) | Build custom slash commands |
| [Creating Hooks](internals/creating-hooks.md) | Develop custom hooks |
| [Creating Subagents](internals/creating-subagents.md) | Build specialized AI assistants |
| [Claude Code Config](internals/claude-code-config.md) | Configuration system internals |
| [Package Managers](internals/package-managers.md) | Multi-package manager support |
| [Principles](internals/principles.md) | Design principles and architecture |
| [Prompting Guide](internals/prompting-guide.md) | Writing effective prompts |
| [Writing Guides](internals/writing-guides.md) | Documentation authoring guidelines |
