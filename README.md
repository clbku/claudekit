![claudekit banner](assets/banner.png)

# claudekit

> Real-time guardrails and workflow automation for Claude Code — catch errors instantly, save checkpoints, and delegate to expert subagents.

[![npm version](https://img.shields.io/npm/v/claudekit-dev.svg)](https://www.npmjs.com/package/claudekit-dev)
[![npm downloads](https://img.shields.io/npm/dt/claudekit-dev.svg)](https://www.npmjs.com/package/claudekit-dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claudekit-dev.svg)](https://nodejs.org)

## Requirements

Claude Code **Max plan** (recommended) · Node.js 20+

## Install

```bash
npm install -g claudekit-dev
claudekit setup          # interactive setup wizard
claudekit setup --yes    # quick setup with defaults
claudekit setup --all    # install everything including all agents
```

## What It Does

Claudekit is a safety net that runs alongside Claude Code:

| Without claudekit | With claudekit |
|---|---|
| Claude adds `any` type → discovered in code review | Instant block: "Use specific type: `User \| null`" |
| Risky refactor fails → git archaeology | One command: `/checkpoint:restore` |
| Claude breaks tests → you find out later | Claude sees the error immediately and fixes it |
| Code review → shallow, sequential analysis | 6 specialized agents analyze in parallel |

## Key Features

### Real-time Error Prevention

Hooks run automatically as Claude works, catching issues before they compound:

- **TypeScript guard** — blocks `any` types and type errors on edit
- **Linting** — catches style issues immediately
- **Test runner** — runs relevant tests on file changes
- **Anti-patterns** — prevents code replacement with comments, lazy refactoring
- **Sensitive file protection** — 195+ patterns across 12 categories (`.env`, SSH keys, cloud credentials)
- **Package install guard** — warns when installing packages without security scanning
- **Multi-tool ignore support** — `.agentignore`, `.aiignore`, `.cursorignore`, `.geminiignore`, etc.

[Hooks reference →](docs/reference/hooks.md) · [File guard guide →](docs/guides/file-guard.md)

### Git Checkpoint System

Undo any set of changes with one command:

- **Auto-save** — creates checkpoints when Claude stops
- **Restore** — `/checkpoint:restore` to undo changes
- **Manage** — `/checkpoint:list`, `/checkpoint:create`

[Checkpoint guide →](docs/guides/checkpoint.md)

### Codebase Navigation

Claude sees your entire project structure automatically — no trial-and-error searches:

- Jump straight to files, functions, and classes
- Understand dependencies and architecture instantly
- Runs invisibly on first prompt, updates as you code
- Configurable include/exclude filters

[Codebase map guide →](docs/guides/codebase-map.md)

### Multi-Agent Code Review

`/code-review` launches 6 specialized agents in parallel for architecture, security, performance, testing, quality, and documentation analysis. Results are prioritized with actionable suggestions.

### Spec-Driven Development

6-phase iterative workflow: Implementation → Test Writing → Code Review → Improvement → Commit → Tracking. Dynamic agent selection with quality gates at each phase.

[Spec workflow guide →](docs/guides/spec-workflow.md)

### Expert Subagents

30+ specialized AI assistants for different domains:

| Category | Agents |
|---|---|
| **Code Review** | `code-review-expert`, `triage-expert` |
| **TypeScript** | `typescript-expert`, `typescript-build-expert`, `typescript-type-expert` |
| **React & Frontend** | `react-expert`, `react-performance-expert`, `nextjs-expert`, `css-styling-expert` |
| **Testing** | `testing-expert`, `vitest-testing-expert`, `jest-testing-expert`, `playwright-expert` |
| **Database** | `database-expert`, `postgres-expert`, `mongodb-expert` |
| **Infrastructure** | `docker-expert`, `github-actions-expert`, `devops-expert` |
| **Research** | `research-expert`, `code-search`, `oracle` |
| **Frameworks** | `nestjs-expert`, `ai-sdk-expert`, `loopback-expert`, `kafka-expert` |

```bash
claudekit list agents                      # list all with token counts
claudekit setup --agents typescript-expert,react-expert  # install specific agents
```

[View all agents →](docs/reference/subagents.md)

## Slash Commands

```
# Git & Checkpoints
/checkpoint:create [msg]    Save current state
/checkpoint:restore [n]     Restore to checkpoint
/checkpoint:list            View all checkpoints
/git:commit                 Smart commit following conventions
/git:status                 Intelligent git analysis
/git:checkout [branch]      Smart branch creation/switching
/git:ignore-init            Initialize AI-safe .gitignore patterns

# Code Quality
/code-review [target]       Multi-agent code review
/validate-and-fix           Run all quality checks and fix issues

# Development
/research [query]           Deep parallel research with subagents
/spec:create [feature]      Generate comprehensive specifications
/spec:execute [file]        Implement specs with iterative workflow
/create-subagent            Build custom AI assistants
/create-command             Create custom slash commands
/agents-md:init             Configure AGENTS.md for auto delegation
```

[View all commands →](docs/reference/commands.md)

## CLI Reference

```bash
# Setup & info
claudekit setup              # Interactive setup wizard
claudekit list               # Show all components
claudekit list agents        # List available agents
claudekit doctor             # Check installation health

# Extract prompts for external LLMs
claudekit show agent <id>    # Display agent prompt
claudekit show command <id>  # Display command prompt
claudekit show agent <id> -f json  # Output as JSON

# Hook management
claudekit-hooks run <hook>   # Execute a hook manually
claudekit-hooks profile      # Profile all hook performance
claudekit-hooks disable <h>  # Disable hook for current session
claudekit-hooks enable <h>   # Re-enable hook
claudekit-hooks status       # Show hook status
```

## Hooks

Hooks automatically enforce quality as Claude works:

| Hook | Trigger | Description |
|---|---|---|
| `file-guard` | PreToolUse | Block access to sensitive files |
| `sfw-install` | PreToolUse | Warn on unsecured package installs |
| `typecheck-changed` | PostToolUse | TypeScript checking on file changes |
| `lint-changed` | PostToolUse | Linting on changed files |
| `test-changed` | PostToolUse | Run tests for changed files |
| `check-any-changed` | PostToolUse | Forbid `any` types |
| `check-comment-replacement` | PostToolUse | Detect code→comment replacement |
| `check-unused-parameters` | PostToolUse | Detect lazy `_param` refactoring |
| `codebase-map` | UserPromptSubmit | Invisible codebase context |
| `thinking-level` | UserPromptSubmit | Enhance Claude's reasoning |
| `create-checkpoint` | Stop | Auto-checkpoint on stop |
| `self-review` | Stop | Targeted self-review |
| `check-todos` | Stop | Validate todo completions |

[Hook configuration →](docs/reference/hooks.md) · [Profiling guide →](docs/guides/hook-profiling.md)

## Configuration

**`.claude/settings.json`** — Project-level hook configuration:
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Read|Edit|MultiEdit|Write",
      "hooks": [{"type": "command", "command": "claudekit-hooks run file-guard"}]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [{"type": "command", "command": "claudekit-hooks run typecheck-changed"}]
    }],
    "Stop": [{
      "matcher": "*",
      "hooks": [{"type": "command", "command": "claudekit-hooks run create-checkpoint"}]
    }],
    "UserPromptSubmit": [{
      "matcher": "*",
      "hooks": [{"type": "command", "command": "claudekit-hooks run codebase-map"}]
    }]
  }
}
```

**`.claudekit/config.json`** — Hook-specific settings:
```json
{
  "hooks": {
    "typecheck-changed": { "command": "npm run typecheck" },
    "thinking-level": { "level": 2 },
    "codebase-map": {
      "include": ["src/**", "lib/**"],
      "exclude": ["**/*.test.ts"],
      "format": "dsl"
    }
  }
}
```

[Configuration guide →](docs/getting-started/configuration.md)

## Troubleshooting

```bash
claudekit doctor              # Check configuration and setup
claudekit-hooks status        # Check hook status
npm list -g claudekit-dev     # Verify installation
```

[Full troubleshooting →](docs/getting-started/troubleshooting.md)

## Development

```bash
git clone https://github.com/carlrannaberg/claudekit.git
cd claudekit && npm install
npm run build                 # Compile TypeScript
npm test                      # Run tests
npm run symlinks              # Create dev symlinks
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
