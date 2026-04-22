# Claudekit Subagents Library

Specialized AI assistants for Claude Code with deep domain expertise.

## Structure

```
src/agents/
├── README.md                          # This file
├── oracle.md                          # Deep debugging & analysis
├── code-review-expert.md              # 6-aspect parallel code review
├── code-search.md                     # Fast codebase search
├── triage-expert.md                   # Problem diagnosis & routing
├── research-expert.md                 # Parallel research with citations
├── ai-sdk-expert.md                   # Vercel AI SDK v5
├── cli-expert.md                      # CLI tool development
├── nestjs-expert.md                   # Nest.js framework
├── kafka/                             # Apache Kafka
├── loopback/                          # LoopBack 4 framework
├── refactoring/                       # Code refactoring
├── nodejs/                            # Node.js runtime
├── react/                             # React & performance
├── framework/                         # Next.js, etc.
├── frontend/                          # CSS, accessibility
├── testing/                           # Jest, Vitest, Playwright
├── typescript/                        # TypeScript, build, types
├── database/                          # PostgreSQL, MongoDB
├── build-tools/                       # Webpack, Vite
├── infrastructure/                    # Docker, GitHub Actions
├── devops/                            # DevOps & infrastructure
├── git/                               # Git workflow
├── code-quality/                      # Linting & formatting
└── documentation/                     # Documentation expert
```

## Format

Each agent is a markdown file with YAML frontmatter:

```yaml
---
name: agent-identifier
description: Brief description of when to use this agent
tools: Comma-separated list of allowed tools
---
```

## Adding a New Agent

1. Create a `.md` file in the appropriate domain folder
2. Follow the frontmatter format above
3. Register in `cli/hooks/registry.ts` if it needs hook integration
4. Test with `claudekit setup` and verify delegation in Claude Code

## Naming Conventions

- Lowercase with hyphens: `typescript-expert`
- Specific but not too narrow: `react-expert` not `react-hooks-expert`
- Include domain when helpful: `typescript-type-expert`

## Agent Authoring

See the [Creating Subagents Guide](../../docs/internals/creating-subagents.md) for detailed instructions.
