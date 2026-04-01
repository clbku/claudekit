# Claudekit - Phân tích tổng hợp thành phần

> Ngày phân tích: 2026-03-31 | Phiên bản: 0.9.4

---

## 1. Tổng quan kiến trúc

Claudekit là bộ toolkit mở rộng cho Claude Code, gồm 3 loại thành phần chính:

| Thành phần | Số lượng | Vai trò |
|------------|----------|---------|
| **Hooks** | 17 hooks | Tự động kích hoạt theo sự kiện (sửa file, dừng session, v.v.) |
| **Commands** | 26 commands | Slash commands gọi thủ công bởi user (vd: `/git:commit`) |
| **Agents** | 34 agents | Chuyên gia domain, được dispatch bởi Claude khi cần |

**Nguyên lý hoạt động:**

```
User → Claude Code → Hooks (tự động) → Commands (thủ công) → Agents (theo nhu cầu)
         ↑                                    ↓
         └──────── Kết quả trả về ────────────┘
```

---

## 2. Hooks (17 hooks)

Hooks được kích hoạt tự động bởi Claude Code khi xảy ra sự kiện cụ thể.

### 2.1 Hooks theo loại sự kiện

#### PreToolUse (trước khi Claude thực hiện tool call)

| Hook | Mục đích |
|------|----------|
| **file-guard** | Chặn truy cập file nhạy cảm (.env, credentials, private keys). Parse Bash commands để phát hiện cat/read file nhạy cảm. |

#### PostToolUse (sau khi Claude sửa file)

| Hook | Matcher | Mục đích |
|------|---------|----------|
| **typecheck-changed** | `Write\|Edit\|MultiEdit` | Kiểm tra TypeScript type errors cho file vừa sửa |
| **lint-changed** | `Write\|Edit\|MultiEdit` | Chạy ESLint/Biome lint trên file vừa sửa |
| **test-changed** | `Write\|Edit\|MultiEdit` | Chạy test liên quan đến file vừa sửa |
| **check-any-changed** | `Write\|Edit\|MultiEdit` | Phát hiện `any` type trong TypeScript files vừa sửa |
| **check-unused-parameters** | `Edit\|MultiEdit` | Phát hiện parameters không sử dụng trong code vừa sửa |
| **check-comment-replacement** | `Edit\|MultiEdit` | Phát hiện khi code bị thay bằng comments (anti-pattern) |
| **codebase-map-update** | `Write\|Edit\|MultiEdit` | Cập nhật codebase map index khi file thay đổi (debounce 5s) |

#### UserPromptSubmit (khi user gửi prompt)

| Hook | Mục đích |
|------|----------|
| **codebase-map** | Cung cấp codebase map context cho session (chỉ lần đầu) |
| **thinking-level** | Inject thinking level keywords dựa trên config (think/megathink/thinkhard) |

#### SessionStart (khi bắt đầu session mới)

| Hook | Mục đích |
|------|----------|
| **codebase-map** | Nạp codebase map ban đầu cho session |

#### Stop / SubagentStop (khi Claude dừng)

| Hook | Mục đích |
|------|----------|
| **typecheck-project** | Kiểm tra TypeScript toàn project |
| **lint-project** | Chạy lint toàn project (ESLint + Biome) |
| **test-project** | Chạy full test suite |
| **create-checkpoint** | Tự động tạo git stash checkpoint |
| **self-review** | Nhắc Claude tự review code trước khi dừng |
| **check-todos** | Kiểm tra todo completion status |

### 2.2 Phân loại theo chức năng

```
Validation (6)     → typecheck-changed, lint-changed, check-any-changed,
                      check-unused-parameters, check-comment-replacement, file-guard
Project-wide (3)   → typecheck-project, lint-project, test-project
Utility (3)        → codebase-map, codebase-map-update, thinking-level
Git (1)            → create-checkpoint
Project Mgmt (1)   → check-todos
Quality (1)        → self-review
Testing (1)        → test-changed
```

---

## 3. Commands (26 commands)

Commands là slash commands do user gọi thủ công trong Claude Code.

### 3.1 Git Workflow (`/git:*`)

| Command | Mô tả |
|---------|-------|
| `/git:status` | Phân tích git status thông minh, nhóm changes theo loại, đề xuất chiến lược commit |
| `/git:commit` | Tạo commit theo convention của project (conventional commits) |
| `/git:push` | Push an toàn với pre-flight checks |
| `/git:checkout` | Tạo/chuyển branch với naming convention |
| `/git:ignore-init` | Khởi tạo `.gitignore` với patterns cho Claude Code |

### 3.2 Checkpoint System (`/checkpoint:*`)

| Command | Mô tả |
|---------|-------|
| `/checkpoint:create` | Tạo git stash checkpoint với mô tả tùy chọn |
| `/checkpoint:list` | Liệt kê tất cả checkpoints |
| `/checkpoint:restore` | Restore về checkpoint trước đó |

### 3.3 Specification Workflow (`/spec:*`)

| Command | Mô tả |
|---------|-------|
| `/spec:create` | Nghiên cứu codebase và tạo specification cho feature/bugfix |
| `/spec:validate` | Phân tích spec xem đủ chi tiết để implement tự động chưa |
| `/spec:decompose` | Phân tách spec thành tasks (stm task management) |
| `/spec:execute` | Thực thi spec với concurrent agents |

### 3.4 Code Quality

| Command | Mô tả |
|---------|-------|
| `/code-review` | Multi-aspect code review với 6 parallel review agents |
| `/validate-and-fix` | Chạy quality checks và tự động fix bằng concurrent agents |

### 3.5 Configuration & Setup

| Command | Mô tả |
|---------|-------|
| `/agents-md:init` | Khởi tạo AGENTS.md và symlinks cho AI assistants |
| `/agents-md:migration` | Migrate cấu hình AI assistant sang chuẩn AGENTS.md |
| `/agents-md:cli` | Capture CLI tool help docs và thêm vào AGENTS.md |
| `/config:bash-timeout` | Cấu hình bash timeout trong settings |

### 3.6 Hook Management (`/hook:*`)

| Command | Mô tả |
|---------|-------|
| `/hook:status` | Xem trạng thái hooks hiện tại |
| `/hook:enable` | Bật hook cho session |
| `/hook:disable` | Tắt hook cho session |

### 3.7 Development & Creation

| Command | Mô tả |
|---------|-------|
| `/create-command` | Hướng dẫn tạo slash command mới |
| `/create-subagent` | Tạo subagent chuyên biệt |
| `/dev:cleanup` | Dọn dẹp debug files, test artifacts, temp reports |
| `/gh:repo-init` | Tạo GitHub repository mới với setup đầy đủ |

### 3.8 Research

| Command | Mô tả |
|---------|-------|
| `/research` | Deep research với parallel subagents và auto citations |

---

## 4. Agents (34 agents)

Agents là chuyên gia domain được Claude dispatch khi cần. Được phân thành 10 categories:

### 4.1 TypeScript & JavaScript (3)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **typescript-expert** | General TS/JS expertise: monorepo, migration, tooling |
| **typescript-build-expert** | Compiler config, build optimization, module resolution |
| **typescript-type-expert** | Advanced type system: generics, conditional types, inference |

### 4.2 React & Frontend (4)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **react-expert** | Components, hooks, patterns, state management |
| **react-performance-expert** | DevTools Profiler, memoization, bundle optimization |
| **css-styling-expert** | CSS architecture, responsive design, design systems |
| **accessibility-expert** | WCAG compliance, ARIA, keyboard navigation |

### 4.3 Testing (4)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **testing-expert** | Cross-framework testing, mocking, coverage |
| **jest-testing-expert** | Jest snapshots, async patterns, migration |
| **vitest-testing-expert** | Vitest + Vite integration, browser mode |
| **playwright-expert** | E2E testing, visual regression, CI integration |

### 4.4 Database (3)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **database-expert** | Cross-DB optimization, schema design (PostgreSQL, MySQL, MongoDB, SQLite) |
| **postgres-expert** | PostgreSQL-specific: JSONB, partitioning, indexing |
| **mongodb-expert** | MongoDB: aggregation pipeline, sharding, replica sets |

### 4.5 Infrastructure (3)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **devops-expert** | CI/CD, IaC, monitoring, security |
| **docker-expert** | Container optimization, Docker Compose, security |
| **github-actions-expert** | Workflow automation, custom actions |

### 4.6 Build Tools (2)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **vite-expert** | ESM, HMR, plugin ecosystem, production builds |
| **webpack-expert** | Bundle analysis, code splitting, module federation |

### 4.7 Frameworks (4)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **nextjs-expert** | App Router, Server Components, deployment |
| **nestjs-expert** | Module architecture, DI, middleware, testing |
| **loopback-expert** | LoopBack 4: DI, repositories, authentication |
| **ai-sdk-expert** | Vercel AI SDK v5: streaming, tool calling, hooks |

### 4.8 Code Quality (3)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **linting-expert** | Linting, formatting, static analysis |
| **refactoring-expert** | Code smells, structural optimization |
| **code-review-expert** | 6-aspect code review (architecture, quality, security, performance, testing, docs) |

### 4.9 General Purpose (5)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **triage-expert** | Initial diagnosis, routing to specialists |
| **oracle** | Deep analysis, second opinions, complex debugging |
| **research-expert** | Parallel web research, structured output |
| **code-search** | Fast codebase search for files, functions, patterns |
| **documentation-expert** | Docs structure, navigation, anti-patterns |

### 4.10 Other (3)

| Agent | Trách nhiệm chính |
|-------|-------------------|
| **git-expert** | Merge conflicts, branching, repository management |
| **nodejs-expert** | Node.js runtime: event loop, streams, process management |
| **cli-expert** | CLI tool development, npm packages, argument parsing |
| **kafka-expert** | Kafka: consumers, producers, cluster operations |

---

## 5. Workflows đã định nghĩa

Claudekit có **4 workflow chính** được định nghĩa rõ ràng:

### 5.1 Code Quality Pipeline (Tự động)

**Kích hoạt:** Mỗi khi Claude sửa file (PostToolUse)

```
File Edit → typecheck-changed → lint-changed → test-changed
                  ↓                   ↓               ↓
              Block nếu lỗi     Block nếu lỗi    Block nếu lỗi
                  ↓                   ↓               ↓
              check-any-changed  check-comment-replacement
              check-unused-parameters
```

Khi Claude dừng (Stop), pipeline chạy thêm ở cấp project-wide:

```
Session Stop → typecheck-project → lint-project → test-project
            → self-review → create-checkpoint → check-todos
```

### 5.2 Git Checkpoint Workflow

**Kích hoạt:** Thủ công hoặc tự động khi Stop

```
/checkpoint:create → làm việc → /checkpoint:create → ...
                                              ↓
                              Nếu cần revert: /checkpoint:restore
                              Liệt kê: /checkpoint:list
```

- Tự động tạo checkpoint qua hook `create-checkpoint` mỗi khi Stop
- Git stash-based, non-destructive

### 5.3 Specification Workflow

**Kích hoạt:** Thủ công

```
/spec:create "feature"     → Tạo spec file chi tiết
         ↓
/spec:validate spec.md     → Kiểm tra đủ chi tiết chưa
         ↓
/spec:decompose spec.md    → Phân tách thành tasks (stm)
         ↓
/spec:execute spec.md      → Thực thi với concurrent agents
```

Workflow này kết hợp:
- Codebase research (spec creation)
- Validation logic (completeness check)
- Task management (stm integration)
- Parallel execution (concurrent agents)

### 5.4 Code Review Workflow

**Kích hoạt:** Thủ công

```
/code-review → Spawn 6 parallel agents:
  ├── Architecture & Design review
  ├── Code Quality review
  ├── Security & Dependencies review
  ├── Performance & Scalability review
  ├── Testing Coverage review
  └── Documentation & API Design review
       ↓
  Tổng hợp kết quả → Report cho user
```

### 5.5 File Protection Workflow (Tự động)

**Kích hoạt:** Mỗi lần Claude gọi tool (PreToolUse)

```
Claude gọi Read/Edit/Write/Bash
         ↓
    file-guard hook
         ↓
    Parse command → Check patterns
         ↓
    Cho phép / Chặn + Cảnh báo
```

---

## 6. Ma trận tích hợp

Bảng dưới đây cho thấy cách components phối hợp:

| Workflow | Hooks | Commands | Agents |
|----------|-------|----------|--------|
| Code Quality Pipeline | typecheck, lint, test (changed + project) | `/validate-and-fix` | linting-expert, testing-expert |
| Git Management | create-checkpoint | `/git:commit`, `/git:push`, `/checkpoint:*` | git-expert |
| Spec Workflow | — | `/spec:*` | triage-expert, research-expert |
| Code Review | self-review | `/code-review` | code-review-expert |
| File Protection | file-guard | — | — |
| Codebase Navigation | codebase-map, codebase-map-update | — | code-search |
| Project Setup | — | `/agents-md:init`, `/gh:repo-init` | — |

---

## 7. Thống kê tổng quan

```
Tổng số hooks:      17 (6 validation, 3 project-wide, 3 utility, 2 git/mgmt, 3 other)
Tổng số commands:   26 (5 git, 3 checkpoint, 4 spec, 3 config, 3 hook, 3 dev, 1 research, 4 other)
Tổng số agents:     34 (3 TS, 4 React, 4 testing, 3 DB, 3 infra, 2 build, 4 framework, 3 quality, 5 general, 3 other)
Workflows:           5 workflow chính được định nghĩa
                     1 pipeline tự động (code quality)
```
