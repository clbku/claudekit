#!/usr/bin/env bash
set -euo pipefail

################################################################################
# Integration Tests for Agent Installation in Setup Command                    #
# Tests that claudekit setup correctly installs, configures, and manages       #
# subagent files.                                                              #
################################################################################

# Import test framework
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
source "$SCRIPT_DIR/../test-framework.sh"

# Test configuration
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI_PATH="$PROJECT_ROOT/dist/cli.cjs"
TEMP_PROJECT_DIR=""

################################################################################
# Setup and Teardown                                                          #
################################################################################

setUp() {
    TEMP_PROJECT_DIR=$(mktemp -d)
    cd "$TEMP_PROJECT_DIR"

    # Ensure claudekit CLI is built
    cd "$PROJECT_ROOT"
    if [[ ! -f "$CLI_PATH" ]]; then
        npm run build >/dev/null 2>&1
    fi

    cd "$TEMP_PROJECT_DIR"
}

tearDown() {
    if [[ -n "$TEMP_PROJECT_DIR" ]] && [[ -d "$TEMP_PROJECT_DIR" ]]; then
        rm -rf "$TEMP_PROJECT_DIR"
    fi
}

################################################################################
# Test Functions                                                               #
################################################################################

test_setup_all_installs_agents() {
    # Purpose: Verify --all flag installs agent files to .claude/agents/
    # This ensures the full setup workflow includes agent installation

    if ! command -v node &>/dev/null || [[ ! -f "$CLI_PATH" ]]; then
        assert_pass "Skipped: CLI not available"
        return
    fi

    node "$CLI_PATH" setup --yes --all --skip-commands --skip-hooks >/dev/null 2>&1 || true

    if [[ -d ".claude/agents" ]]; then
        # Check at least one agent file exists
        local agent_count
        agent_count=$(find .claude/agents -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        if [[ "$agent_count" -gt 0 ]]; then
            assert_pass "Setup --all installed $agent_count agent files"
        else
            assert_fail "Setup --all created agents dir but no .md files found"
        fi
    else
        assert_fail "Setup --all did not create .claude/agents/ directory"
    fi
}

test_setup_skip_agents_flag() {
    # Purpose: Verify --skip-agents flag excludes agent installation
    # This ensures users who don't want agents can opt out

    if ! command -v node &>/dev/null || [[ ! -f "$CLI_PATH" ]]; then
        assert_pass "Skipped: CLI not available"
        return
    fi

    node "$CLI_PATH" setup --yes --all --skip-agents >/dev/null 2>&1 || true

    if [[ ! -d ".claude/agents" ]]; then
        assert_pass "Setup --skip-agents did not create agents directory"
    else
        # Check if directory is empty (some setups might create it but leave it empty)
        local agent_count
        agent_count=$(find .claude/agents -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        if [[ "$agent_count" -eq 0 ]]; then
            assert_pass "Setup --skip-agents created empty agents directory"
        else
            assert_fail "Setup --skip-agents still installed $agent_count agent files"
        fi
    fi
}

test_agent_file_integrity() {
    # Purpose: Verify installed agent files have valid frontmatter
    # This ensures agent files aren't corrupted during installation

    if ! command -v node &>/dev/null || [[ ! -f "$CLI_PATH" ]]; then
        assert_pass "Skipped: CLI not available"
        return
    fi

    node "$CLI_PATH" setup --yes --all --skip-commands --skip-hooks >/dev/null 2>&1 || true

    local valid_count=0
    local total_count=0

    for agent_file in .claude/agents/**/*.md .claude/agents/*.md; do
        [[ -f "$agent_file" ]] || continue
        ((total_count++))

        # Check for YAML frontmatter delimiters
        if grep -q "^---$" "$agent_file"; then
            # Check for required name field
            if grep -q "^name:" "$agent_file"; then
                ((valid_count++))
            fi
        fi
    done

    if [[ "$total_count" -eq 0 ]]; then
        assert_fail "No agent files found after setup --all"
    elif [[ "$valid_count" -eq "$total_count" ]]; then
        assert_pass "All $total_count agent files have valid frontmatter"
    else
        assert_fail "Only $valid_count/$total_count agent files have valid frontmatter"
    fi
}

test_setup_idempotency() {
    # Purpose: Verify running setup multiple times produces identical results
    # This ensures no duplicate entries or corruption on repeated runs

    if ! command -v node &>/dev/null || [[ ! -f "$CLI_PATH" ]]; then
        assert_pass "Skipped: CLI not available"
        return
    fi

    # First run
    node "$CLI_PATH" setup --yes --all --skip-commands --skip-hooks >/dev/null 2>&1 || true
    local first_count
    first_count=$(find .claude/agents -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')

    # Second run
    node "$CLI_PATH" setup --yes --all --skip-commands --skip-hooks >/dev/null 2>&1 || true
    local second_count
    second_count=$(find .claude/agents -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$first_count" == "$second_count" ]]; then
        assert_pass "Idempotent: both runs produced $first_count agent files"
    else
        assert_fail "Non-idempotent: first=$first_count, second=$second_count agent files"
    fi
}

test_typescript_expert_agent_installed() {
    # Purpose: Verify a specific well-known agent is installed correctly
    # This ensures key agents like typescript-expert are available after setup

    if ! command -v node &>/dev/null || [[ ! -f "$CLI_PATH" ]]; then
        assert_pass "Skipped: CLI not available"
        return
    fi

    node "$CLI_PATH" setup --yes --all --skip-commands --skip-hooks >/dev/null 2>&1 || true

    # Check for typescript expert in various possible locations
    local found=false
    local candidate
    for candidate in \
        ".claude/agents/typescript-expert.md" \
        ".claude/agents/typescript/typescript-expert.md" \
        ".claude/agents/typescript/expert.md"; do
        if [[ -f "$candidate" ]] && grep -q "^name: typescript-expert$" "$candidate"; then
            found=true
            break
        fi
    done

    if $found; then
        assert_pass "TypeScript expert agent installed correctly"
    else
        assert_fail "TypeScript expert agent not found or missing name field"
    fi
}

test_agents_directory_permissions() {
    # Purpose: Verify agent directory has correct read/execute permissions
    # This ensures Claude Code can read agent definitions

    if ! command -v node &>/dev/null || [[ ! -f "$CLI_PATH" ]]; then
        assert_pass "Skipped: CLI not available"
        return
    fi

    node "$CLI_PATH" setup --yes --all --skip-commands --skip-hooks >/dev/null 2>&1 || true

    if [[ -d ".claude/agents" ]] && [[ -r ".claude/agents" ]] && [[ -x ".claude/agents" ]]; then
        assert_pass "Agents directory has correct permissions"
    else
        assert_fail "Agents directory missing or has wrong permissions"
    fi
}

################################################################################
# Test Suite Execution                                                         #
################################################################################

# Register cleanup
trap tearDown EXIT

# Run the test suite
run_test_suite "Setup Command Agent Integration Tests"
