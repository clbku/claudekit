# Subagents List

Claudekit includes 35 specialized AI subagents that provide deep domain expertise. These agents work alongside Claude Code to handle complex, domain-specific tasks.

## Installation

```bash
# Install all agents
claudekit setup --all

# Install specific agents
claudekit setup --agents typescript-expert,react-expert

# Install by category (e.g., testing stack)
claudekit setup --agents testing-expert,jest-expert,vitest-testing-expert,playwright-expert
```

## Usage

After installation, use agents in two ways:

1. **Explicit invocation**: "Use the oracle agent to debug this issue"
2. **Proactive usage**: Run `/agents-md:init` to configure automatic delegation

## Available Agents

### 🧠 Advanced Analysis

#### oracle
Deep debugging, audits, and architectural decisions.
- **Expertise**: Complex bug analysis, security audits, code reviews
- **Special**: Uses external CLI tools for second opinions
- **Setup**: [Oracle Setup Guide](../integrations/oracle.md)

#### code-search
Specialized codebase search for finding specific implementations and patterns.
- **Expertise**: Fast, parallel codebase searches with 3-10x speed improvements

#### research-expert
Comprehensive parallel research with structured reporting.
- **Expertise**: 90% time reduction via parallel agents, automatic citation management

#### triage-expert
Context gathering and initial problem diagnosis specialist.
- **Expertise**: Error analysis, performance issues, problem routing to specialized experts

### 🔧 Build Tools

#### webpack-expert
Webpack build optimization and configuration specialist.
- **Expertise**: Bundle analysis, code splitting, module federation

#### vite-expert
Vite development and build optimization expert.
- **Expertise**: ESM-first development, HMR optimization, plugin ecosystem

### 🎯 Code Quality

#### code-review-expert
Comprehensive 6-aspect parallel code review specialist.
- **Expertise**: Architecture, security, performance, testing, quality, documentation

#### refactoring-expert
Code smell detection and comprehensive refactoring guidance.
- **Expertise**: 25+ code smell patterns, safe refactoring process, test-driven changes

#### linting-expert
Code linting, formatting, and static analysis across languages.
- **Expertise**: ESLint, Prettier, static analysis tools

#### documentation-expert
Documentation structure, content strategy, and information architecture.
- **Expertise**: Technical writing, content organization, readability, user experience

### 🗄️ Database

#### database-expert
Cross-database optimization and schema design.
- **Expertise**: PostgreSQL, MySQL, MongoDB, SQLite, ORM integration

#### postgres-expert
PostgreSQL-specific optimization and administration.
- **Expertise**: Query optimization, JSONB, indexing, partitioning

#### mongodb-expert
MongoDB document modeling and aggregation specialist.
- **Expertise**: Document modeling, aggregation pipelines, sharding

### 🚀 DevOps & Infrastructure

#### devops-expert
CI/CD pipelines and infrastructure as code.
- **Expertise**: Containerization, orchestration, monitoring, security

#### docker-expert (infrastructure/docker-expert)
Docker containerization and orchestration expert.
- **Expertise**: Multi-stage builds, image optimization, Docker Compose

#### github-actions-expert (infrastructure/github-actions-expert)
GitHub Actions workflow automation specialist.
- **Expertise**: CI/CD pipelines, custom actions, security best practices

### 🎨 Frontend Development

#### css-styling-expert (frontend/css-styling-expert)
CSS architecture and responsive design expert.
- **Expertise**: Modern CSS, CSS-in-JS, design systems, accessibility

#### accessibility-expert (frontend/accessibility-expert)
WCAG compliance and accessibility optimization.
- **Expertise**: WCAG 2.1/2.2, WAI-ARIA, screen readers, keyboard navigation

### 📦 Frameworks

#### nextjs-expert (framework/nextjs-expert)
Next.js App Router and Server Components specialist.
- **Expertise**: App Router, Server Components, performance, deployment

#### nestjs-expert
Nest.js framework expert.
- **Expertise**: Module architecture, dependency injection, middleware, TypeORM/Mongoose

#### loopback-expert
LoopBack 4 framework specialist.
- **Expertise**: Dependency injection, repository patterns, authentication, database integration

#### ai-sdk-expert
Vercel AI SDK v5 specialist.
- **Expertise**: Streaming, model integration, tool calling, edge runtime

#### kafka-expert
Apache Kafka distributed streaming expert.
- **Expertise**: Consumer/producer management, topic management, performance tuning

#### cli-expert
CLI tool development specialist.
- **Expertise**: npm package CLIs, argument parsing, interactive modes

### 🌿 Version Control

#### git-expert
Git workflow and repository management expert.
- **Expertise**: Merge conflicts, branching, recovery, performance

### ⚙️ Runtime

#### nodejs-expert
Node.js runtime and ecosystem expert.
- **Expertise**: Async patterns, module systems, streams, performance

### ⚛️ React

#### react-expert
React patterns and best practices specialist.
- **Expertise**: Component patterns, hooks, state management

#### react-performance-expert
React performance optimization specialist.
- **Expertise**: DevTools Profiler, memoization, Core Web Vitals

### 🧪 Testing

#### testing-expert
Cross-framework testing architecture specialist.
- **Expertise**: Test structure, mocking, coverage, debugging

#### jest-expert (testing/jest-expert)
Jest testing framework specialist.
- **Expertise**: Advanced mocking, snapshots, async patterns

#### vitest-testing-expert (testing/vitest-testing-expert)
Vitest modern testing framework expert.
- **Expertise**: ESM patterns, Vite integration, performance

#### playwright-expert (e2e/playwright-expert)
End-to-end testing and browser automation.
- **Expertise**: Cross-browser testing, visual regression, CI/CD

### 📘 TypeScript

#### typescript-expert
General TypeScript and JavaScript expertise.
- **Expertise**: Best practices, patterns, ecosystem

#### typescript-build-expert
TypeScript compiler and build configuration.
- **Expertise**: tsconfig, module resolution, build optimization

#### typescript-type-expert
Advanced TypeScript type system specialist.
- **Expertise**: Complex generics, conditional types, type-level programming

## Creating Custom Agents

Use `/create-subagent` in Claude Code for guided agent creation, or manually create agents following the structure in `src/agents/`.

## Agent Frontmatter Fields

Each agent markdown file includes:
- `name`: Agent identifier
- `description`: When to use this agent
- `tools`: Available Claude Code tools
- `category`: Agent category for organization
- `displayName`: Human-friendly name
- `color`: UI theme color

## Contributing

See [Creating Subagents Guide](../internals/creating-subagents.md) for detailed instructions on creating custom agents.