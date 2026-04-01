#!/usr/bin/env bash
set -euo pipefail

################################################################################
# Unit Tests for Socket Firewall Install Hook                                  #
# Tests the sfw-install hook's package manager detection and warning system    #
################################################################################

# Import test framework
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
source "$SCRIPT_DIR/../../test-framework.sh"

# Test configuration
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_PATH="$PROJECT_ROOT/dist/hooks-cli.cjs"

################################################################################
# Setup and Teardown                                                          #
################################################################################

setUp() {
    # Ensure claudekit CLI is built
    cd "$PROJECT_ROOT"
    if [[ ! -f "$CLI_PATH" ]]; then
        npm run build >/dev/null 2>&1
    fi
}

tearDown() {
    : # No cleanup needed for these tests
}

################################################################################
# Helper Functions                                                             #
################################################################################

# Run sfw-install hook with JSON payload
run_sfw_install() {
    local command="$1"
    local payload="{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$command\"}}"

    echo "$payload" | node "$CLI_PATH" run sfw-install 2>/dev/null || true
}

# Check if hook response contains specific decision
check_permission_decision() {
    local output="$1"
    local expected_decision="$2"

    if echo "$output" | grep -q "\"permissionDecision\":\"$expected_decision\""; then
        return 0
    else
        return 1
    fi
}

# Check if hook allows (no output or allow decision)
check_allows() {
    local output="$1"
    # Empty output means allow, or explicit allow decision
    if [[ -z "$output" ]] || echo "$output" | grep -q "\"permissionDecision\":\"allow\""; then
        return 0
    else
        return 1
    fi
}

# Check if output contains sfw recommendation
check_sfw_recommendation() {
    local output="$1"

    if echo "$output" | grep -q "sfw"; then
        return 0
    else
        return 1
    fi
}

################################################################################
# Package Manager Detection Tests                                              #
################################################################################

test_detect_npm_install() {
    # Purpose: Verify hook detects npm install commands
    # This ensures npm package installations are caught

    local output
    output=$(run_sfw_install "npm install lodash")

    if check_permission_decision "$output" "deny" && check_sfw_recommendation "$output"; then
        assert_pass "Detected npm install command"
    else
        assert_fail "Should detect npm install, got: $output"
    fi
}

test_detect_npm_ci() {
    # Purpose: Verify hook detects npm ci commands
    # This ensures CI installations are also protected

    local output
    output=$(run_sfw_install "npm ci")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected npm ci command"
    else
        assert_fail "Should detect npm ci, got: $output"
    fi
}

test_detect_npm_add() {
    # Purpose: Verify hook detects npm add commands (alias for install)

    local output
    output=$(run_sfw_install "npm add express")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected npm add command"
    else
        assert_fail "Should detect npm add, got: $output"
    fi
}

test_detect_yarn_add() {
    # Purpose: Verify hook detects yarn add commands

    local output
    output=$(run_sfw_install "yarn add react")

    if check_permission_decision "$output" "deny" && check_sfw_recommendation "$output"; then
        assert_pass "Detected yarn add command"
    else
        assert_fail "Should detect yarn add, got: $output"
    fi
}

test_detect_yarn_install() {
    # Purpose: Verify hook detects yarn install (no package specified)

    local output
    output=$(run_sfw_install "yarn install")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected yarn install command"
    else
        assert_fail "Should detect yarn install, got: $output"
    fi
}

test_detect_pnpm_add() {
    # Purpose: Verify hook detects pnpm add commands

    local output
    output=$(run_sfw_install "pnpm add typescript")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected pnpm add command"
    else
        assert_fail "Should detect pnpm add, got: $output"
    fi
}

test_detect_bun_add() {
    # Purpose: Verify hook detects bun add commands

    local output
    output=$(run_sfw_install "bun add zod")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected bun add command"
    else
        assert_fail "Should detect bun add, got: $output"
    fi
}

test_detect_pip_install() {
    # Purpose: Verify hook detects pip install commands

    local output
    output=$(run_sfw_install "pip install requests")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected pip install command"
    else
        assert_fail "Should detect pip install, got: $output"
    fi
}

test_detect_pip3_install() {
    # Purpose: Verify hook detects pip3 install commands

    local output
    output=$(run_sfw_install "pip3 install numpy")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected pip3 install command"
    else
        assert_fail "Should detect pip3 install, got: $output"
    fi
}

test_detect_uv_pip_install() {
    # Purpose: Verify hook detects uv pip install commands

    local output
    output=$(run_sfw_install "uv pip install flask")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected uv pip install command"
    else
        assert_fail "Should detect uv pip install, got: $output"
    fi
}

test_detect_cargo_add() {
    # Purpose: Verify hook detects cargo add commands

    local output
    output=$(run_sfw_install "cargo add serde")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected cargo add command"
    else
        assert_fail "Should detect cargo add, got: $output"
    fi
}

test_detect_cargo_install() {
    # Purpose: Verify hook detects cargo install commands

    local output
    output=$(run_sfw_install "cargo install ripgrep")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected cargo install command"
    else
        assert_fail "Should detect cargo install, got: $output"
    fi
}

test_detect_go_get() {
    # Purpose: Verify hook detects go get commands

    local output
    output=$(run_sfw_install "go get github.com/gin-gonic/gin")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected go get command"
    else
        assert_fail "Should detect go get, got: $output"
    fi
}

test_detect_gem_install() {
    # Purpose: Verify hook detects gem install commands

    local output
    output=$(run_sfw_install "gem install rails")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected gem install command"
    else
        assert_fail "Should detect gem install, got: $output"
    fi
}

test_detect_bundle_install() {
    # Purpose: Verify hook detects bundle install commands

    local output
    output=$(run_sfw_install "bundle install")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected bundle install command"
    else
        assert_fail "Should detect bundle install, got: $output"
    fi
}

test_detect_composer_install() {
    # Purpose: Verify hook detects composer install commands

    local output
    output=$(run_sfw_install "composer install")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected composer install command"
    else
        assert_fail "Should detect composer install, got: $output"
    fi
}

################################################################################
# Non-Install Command Tests (Should Pass Through)                             #
################################################################################

test_allow_npm_run() {
    # Purpose: Verify hook allows npm run commands (not installs)
    # This ensures normal development workflow is not disrupted

    local output
    output=$(run_sfw_install "npm run test")

    if check_allows "$output"; then
        assert_pass "Allowed npm run test"
    else
        assert_fail "Should allow npm run test, got: $output"
    fi
}

test_allow_npm_exec() {
    # Purpose: Verify hook allows npm exec commands

    local output
    output=$(run_sfw_install "npm exec prettier")

    if check_allows "$output"; then
        assert_pass "Allowed npm exec"
    else
        assert_fail "Should allow npm exec, got: $output"
    fi
}

test_allow_npm_create() {
    # Purpose: Verify hook allows npm create commands

    local output
    output=$(run_sfw_install "npm create vite@latest")

    if check_allows "$output"; then
        assert_pass "Allowed npm create"
    else
        assert_fail "Should allow npm create, got: $output"
    fi
}

test_allow_yarn_run() {
    # Purpose: Verify hook allows yarn run commands

    local output
    output=$(run_sfw_install "yarn run build")

    if check_allows "$output"; then
        assert_pass "Allowed yarn run build"
    else
        assert_fail "Should allow yarn run, got: $output"
    fi
}

test_allow_pnpm_run() {
    # Purpose: Verify hook allows pnpm run commands

    local output
    output=$(run_sfw_install "pnpm run lint")

    if check_allows "$output"; then
        assert_pass "Allowed pnpm run lint"
    else
        assert_fail "Should allow pnpm run, got: $output"
    fi
}

test_allow_help_commands() {
    # Purpose: Verify hook allows --help flags

    local output
    output=$(run_sfw_install "npm install --help")

    if check_allows "$output"; then
        assert_pass "Allowed npm install --help"
    else
        assert_fail "Should allow --help commands, got: $output"
    fi
}

test_allow_version_commands() {
    # Purpose: Verify hook allows --version flags

    local output
    output=$(run_sfw_install "npm --version")

    if check_allows "$output"; then
        assert_pass "Allowed npm --version"
    else
        assert_fail "Should allow --version commands, got: $output"
    fi
}

################################################################################
# SFW Prefixed Commands Tests (Should Pass Through)                            #
################################################################################

test_allow_sfw_npm_install() {
    # Purpose: Verify hook allows commands already prefixed with sfw
    # This ensures no double-warning for protected commands

    local output
    output=$(run_sfw_install "sfw npm install lodash")

    if check_allows "$output"; then
        assert_pass "Allowed sfw npm install (already protected)"
    else
        assert_fail "Should allow sfw prefixed commands, got: $output"
    fi
}

test_allow_sfw_pip_install() {
    # Purpose: Verify hook allows sfw pip commands

    local output
    output=$(run_sfw_install "sfw pip install requests")

    if check_allows "$output"; then
        assert_pass "Allowed sfw pip install"
    else
        assert_fail "Should allow sfw pip, got: $output"
    fi
}

test_allow_sfw_yarn_add() {
    # Purpose: Verify hook allows sfw yarn commands

    local output
    output=$(run_sfw_install "sfw yarn add react")

    if check_allows "$output"; then
        assert_pass "Allowed sfw yarn add"
    else
        assert_fail "Should allow sfw yarn, got: $output"
    fi
}

test_allow_sfw_cargo_add() {
    # Purpose: Verify hook allows sfw cargo commands

    local output
    output=$(run_sfw_install "sfw cargo add serde")

    if check_allows "$output"; then
        assert_pass "Allowed sfw cargo add"
    else
        assert_fail "Should allow sfw cargo, got: $output"
    fi
}

################################################################################
# Non-Bash Tool Tests                                                          #
################################################################################

test_ignore_non_bash_tools() {
    # Purpose: Verify hook ignores non-Bash tool calls
    # This ensures the hook only processes Bash commands

    local payload='{"tool_name":"Read","tool_input":{"file_path":"package.json"}}'
    local output
    output=$(echo "$payload" | node "$CLI_PATH" run sfw-install 2>/dev/null || true)

    if check_allows "$output"; then
        assert_pass "Ignored Read tool (not Bash)"
    else
        assert_fail "Should ignore non-Bash tools, got: $output"
    fi
}

test_ignore_write_tool() {
    # Purpose: Verify hook ignores Write tool calls

    local payload='{"tool_name":"Write","tool_input":{"file_path":"test.txt"}}'
    local output
    output=$(echo "$payload" | node "$CLI_PATH" run sfw-install 2>/dev/null || true)

    if check_allows "$output"; then
        assert_pass "Ignored Write tool (not Bash)"
    else
        assert_fail "Should ignore Write tool, got: $output"
    fi
}

################################################################################
# Response Format Tests                                                        #
################################################################################

test_deny_response_format() {
    # Purpose: Verify the deny response has correct PreToolUse format
    # This ensures Claude Code can properly interpret the response

    local output
    output=$(run_sfw_install "npm install lodash")

    # Check for required PreToolUse fields
    if echo "$output" | grep -q '"hookEventName":"PreToolUse"' && \
       echo "$output" | grep -q '"permissionDecision":"deny"' && \
       echo "$output" | grep -q '"permissionDecisionReason":'; then
        assert_pass "Deny response has correct PreToolUse format"
    else
        assert_fail "Deny response format incorrect, got: $output"
    fi
}

test_warning_contains_installation_instructions() {
    # Purpose: Verify warning messages include sfw installation instructions
    # This ensures users know how to install sfw

    local output
    output=$(run_sfw_install "npm install lodash")

    if echo "$output" | grep -q "npm install -g sfw"; then
        assert_pass "Warning includes sfw installation instructions"
    else
        assert_fail "Warning should include installation instructions, got: $output"
    fi
}

test_warning_contains_security_risks() {
    # Purpose: Verify warning messages mention security risks
    # This ensures users understand why installation is flagged

    local output
    output=$(run_sfw_install "npm install lodash")

    if echo "$output" | grep -qi "malicious\|supply chain\|vulnerab"; then
        assert_pass "Warning mentions security risks"
    else
        assert_fail "Warning should mention security risks, got: $output"
    fi
}

test_warning_shows_ecosystem() {
    # Purpose: Verify warning messages show the detected ecosystem
    # This helps users understand which package manager was detected

    local output
    output=$(run_sfw_install "pip install requests")

    if echo "$output" | grep -q "Python"; then
        assert_pass "Warning shows Python ecosystem for pip"
    else
        assert_fail "Warning should show ecosystem, got: $output"
    fi
}

test_warning_shows_javascript_ecosystem() {
    # Purpose: Verify JavaScript ecosystem is correctly identified

    local output
    output=$(run_sfw_install "npm install lodash")

    if echo "$output" | grep -q "JavaScript"; then
        assert_pass "Warning shows JavaScript ecosystem for npm"
    else
        assert_fail "Warning should show JavaScript ecosystem, got: $output"
    fi
}

test_warning_shows_rust_ecosystem() {
    # Purpose: Verify Rust ecosystem is correctly identified

    local output
    output=$(run_sfw_install "cargo add serde")

    if echo "$output" | grep -q "Rust"; then
        assert_pass "Warning shows Rust ecosystem for cargo"
    else
        assert_fail "Warning should show Rust ecosystem, got: $output"
    fi
}

################################################################################
# Edge Case Tests                                                              #
################################################################################

test_empty_command() {
    # Purpose: Verify hook handles empty commands gracefully

    local payload='{"tool_name":"Bash","tool_input":{"command":""}}'
    local output
    output=$(echo "$payload" | node "$CLI_PATH" run sfw-install 2>/dev/null || true)

    if check_allows "$output"; then
        assert_pass "Handled empty command gracefully"
    else
        assert_fail "Should handle empty command, got: $output"
    fi
}

test_missing_command_field() {
    # Purpose: Verify hook handles missing command field gracefully

    local payload='{"tool_name":"Bash","tool_input":{}}'
    local output
    output=$(echo "$payload" | node "$CLI_PATH" run sfw-install 2>/dev/null || true)

    if check_allows "$output"; then
        assert_pass "Handled missing command field gracefully"
    else
        assert_fail "Should handle missing command, got: $output"
    fi
}

test_complex_command_with_install() {
    # Purpose: Verify hook detects install in complex commands

    local output
    output=$(run_sfw_install "cd /tmp && npm install && npm run build")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected npm install in complex command"
    else
        assert_fail "Should detect install in complex command, got: $output"
    fi
}

test_command_with_multiple_package_managers() {
    # Purpose: Verify hook detects first package manager in command

    local output
    output=$(run_sfw_install "npm install lodash && pip install requests")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected package install in multi-manager command"
    else
        assert_fail "Should detect install, got: $output"
    fi
}

test_case_sensitivity() {
    # Purpose: Verify command detection is case-insensitive where appropriate

    # npm should be detected regardless of case in package name
    local output
    output=$(run_sfw_install "npm install LODASH")

    if check_permission_decision "$output" "deny"; then
        assert_pass "Detected npm install with uppercase package name"
    else
        assert_fail "Should detect install regardless of case, got: $output"
    fi
}

################################################################################
# Test Suite Execution                                                         #
################################################################################

# Register cleanup
trap tearDown EXIT

# Run setup
setUp

# Run the test suite
run_test_suite "Socket Firewall Install Hook Unit Tests"
