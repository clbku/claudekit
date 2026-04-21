# Claudekit Hooks Testing Plan

## Overview

This document outlines the testing strategy for claudekit hooks and CLI. The project uses a dual testing approach: a bash-based framework for integration tests that run hooks end-to-end, and Vitest for TypeScript unit tests.

## Testing Frameworks

### 1. Bash Test Framework (`tests/test-framework.sh`)

A lightweight shell-based test framework for testing hooks via the CLI entry point.

**Core assertion functions:**
- `assert_equals`, `assert_not_equals` - Value comparison
- `assert_contains`, `assert_not_contains` - String matching
- `assert_exit_code` - Process exit code validation
- `assert_file_exists`, `assert_file_not_exists` - File system assertions
- `assert_file_contains` - File content matching
- `assert_pass`, `assert_fail` - Simple pass/fail (also increments TESTS_RUN)

**Test lifecycle:**
- `setUp()` / `tearDown()` - Suite-level setup/teardown
- `init_test()` / `cleanup_test()` - Per-test isolation with temp directories
- `run_test_suite()` - Discovers and runs all `test_*` functions
- `run_all_tests_in_file()` - Runs tests from a specific file

**Mock utilities:**
- `create_mock_command()` - Create mock CLI commands
- `create_mock_git()` - Mock git with configurable scenarios
- `create_test_file()`, `create_command_file()` - Test data helpers

### 2. Vitest (`vitest.config.ts`)

TypeScript unit testing framework for CLI and library code.

**Configuration highlights:**
- `singleFork: true` - All tests in one process (prevents orphaned workers)
- `fileParallelism: false` - Sequential execution for predictability
- Coverage provider: v8 with lcov reporter
- Global thresholds: 70% branches/functions/lines/statements
- CI: JUnit XML output via `--reporter junit`

## Test Organization

```
tests/
├── test-framework.sh            # Bash test framework (assertions, lifecycle, mocks)
├── test-reporter.sh              # Test output counting and summary
├── run-tests.sh                  # Main test runner (unit + integration + e2e)
├── setup.ts                      # Vitest global setup
│
├── unit/                         # Bash unit tests for individual hooks
│   └── hooks/
│       ├── file-guard.test.sh           # File guard Read/Edit/Write/MultiEdit
│       ├── file-guard-ignore-processing.test.sh  # Ignore file negation patterns
│       ├── test-file-guard-bash.sh         # Bash command security analysis
│       ├── sfw-install.test.sh            # Socket Firewall install protection
│       └── test-subagents.sh              # Agent frontmatter validation
│
├── integration/                  # Integration tests (multi-component workflows)
│   ├── sensitive-file-protection.test.sh  # Multi-ignore-file pattern merging
│   └── test-setup-agents.sh               # CLI setup agent installation
│
├── e2e/                          # End-to-end tests (real CLI, no mocks)
│   ├── README.md
│   └── cli-show-piping.test.sh           # CLI show command piping
│
├── unit/                         # Vitest TypeScript unit tests
│   ├── agents/                            # Agent registry, loader
│   ├── loaders/                           # Agent/command loader
│   ├── hooks/                             # Hook runner, base, utils, session
│   ├── transcript-parser*.test.ts         # Transcript parsing
│   ├── lint-project.test.ts              # Lint project hook
│   ├── test-project.test.ts              # Test project hook
│   ├── typecheck-project.test.ts         # Typecheck project hook
│   ├── codebase-map.test.ts             # Codebase map hook
│   ├── self-review.test.ts              # Self-review hook
│   ├── profile.test.ts                  # Hook profiling
│   ├── list-hooks.test.ts              # Hook listing
│   └── load-* / validation / config      # Library unit tests
│
├── integration/                  # Vitest integration tests
│   ├── cli-show.test.ts                  # CLI show command
│   ├── setup-embedded-hooks.test.ts      # Hook setup
│   ├── setup-flags.test.ts               # CLI flags
│   └── workflow.test.ts                  # Full workflow
│
├── cli/                          # CLI command tests
│   └── commands/                          # Setup, list, doctor
│
├── lib/                          # Library tests
│   └── components, filesystem, installer, project-detection, etc.
│
└── mocks/                        # Test mocks
    ├── fs-extra.ts                         # Filesystem mock
    └── inquirer-prompts.ts                 # Interactive prompt mock
```

## Running Tests

```bash
# Run all bash tests
./tests/run-tests.sh

# Run only unit tests (skip integration + e2e)
./tests/run-tests.sh --no-integration

# Run specific test suite
./tests/run-tests.sh --test file-guard

# Silent mode (CI-friendly)
./tests/run-tests.sh -s

# Verbose mode
./tests/run-tests.sh -v

# Run Vitest TypeScript tests
npx vitest run

# Run with coverage
npx vitest run --coverage
```

## Key Testing Principles

1. **Isolation**: Each bash test runs in its own temp directory
2. **Meaningful assertions**: Tests must be able to fail — avoid always-pass patterns
3. **No over-mocking**: Bash tests run hooks via real CLI entry point with JSON payloads
4. **Graceful degradation**: Tests skip (not fail) when CLI is not built
5. **Self-containment**: No external test dependencies beyond claudekit CLI

## CI/CD Integration

Tests run via GitHub Actions on push and PR:
- Bash tests: `npm run test-hooks`
- Vitest tests: `npm test`
- Coverage: `npx vitest run --coverage` with JUnit output for CI
