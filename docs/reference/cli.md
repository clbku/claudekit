# CLI Reference

Command-line tools provided by claudekit for setup, management, and validation.

## Core Commands

### `claudekit setup`
Initialize claudekit in your project with interactive configuration.

```bash
claudekit setup [options]

Options:
  -f, --force               Overwrite existing .claude directory
  -y, --yes                 Automatic yes to prompts (use defaults)
  --all                     Install all features including all 24+ agents
  --skip-agents             Skip subagent installation
  --commands <list>         Comma-separated list of command IDs to install
  --hooks <list>            Comma-separated list of hook IDs to install  
  --agents <list>           Comma-separated list of agent IDs to install
  --user                    Install in user directory (~/.claude) instead of project
  --project <path>          Target directory for project installation
  --select-individual       Use legacy individual component selection
```

**Examples:**
```bash
# Interactive setup (recommended)
claudekit setup

# Install everything with defaults
claudekit setup --all --yes

# Install specific components
claudekit setup --commands git:commit,spec:create --hooks typecheck-changed

# Install for user globally
claudekit setup --user
```

### `claudekit add <type> <name>`
Add a hook or command to your project.

```bash
claudekit add hook <name>     # Add a specific hook
claudekit add command <name>  # Add a specific command
```

### `claudekit remove <type> <name>`
Remove a hook or command from your project.

```bash
claudekit remove hook <name>     # Remove a hook
claudekit remove command <name>  # Remove a command
```

### `claudekit update <type> <name>`
Update a hook or command to the latest version.

```bash
claudekit update hook <name>     # Update a hook
claudekit update command <name>  # Update a command
```

### `claudekit list`
List installed hooks, commands, and configuration.

```bash
claudekit list [type]    # List: hooks, commands, agents, or all (default: all)
claudekit list agents    # List available agents with token counts
claudekit list commands  # List available commands with token counts
```

### `claudekit show <type> <id>`
Display agent or command prompts for external use.

```bash
claudekit show agent <id>              # Show agent prompt
claudekit show command <id>            # Show command prompt
claudekit show agent <id> -f json      # Output as JSON with metadata
claudekit show command <id> -f json    # Output as JSON with metadata
```

### `claudekit status <subcommand>`
Check status of integrated tools.

```bash
claudekit status stm    # Check Simple Task Master status
```

### `claudekit list`
List available components.

```bash
claudekit list [type]     # hooks, commands, agents, or all
claudekit list agents     # List agents with token counts
claudekit list commands   # List commands with token counts
```

### `claudekit doctor`
Run project validation checks to diagnose installation and configuration issues.

```bash
claudekit doctor [options]

Options:
  -q, --quiet         Only show errors
  -v, --verbose       Show detailed validation information
  --prerequisites     Check development prerequisites

Examples:
  claudekit doctor             # Check installation
  claudekit doctor --verbose   # Show detailed results
  claudekit doctor --quiet     # Only show problems
```

## Hook Management

### `claudekit-hooks`
Manage and execute the embedded hooks system.

```bash
claudekit-hooks <command> [options]

Commands:
  run <hook>              Run a specific hook
  list                    List all available hooks
  stats                   Show hook execution statistics
  recent [limit]          Show recent hook executions (default: 20)
  profile [hook]          Profile hook performance (time and output)
  disable <hook-name>     Disable hook for current session
  enable <hook-name>      Re-enable hook for current session
  status [hook-name]      Show hook status (enabled/disabled)

Options:
  --config <path>  Path to config file (default: .claudekit/config.json)
  --debug          Enable debug logging
  
Profile Options:
  -i, --iterations <n>  Number of iterations for averaging (default: 1)
```

**Examples:**
```bash
# Run a specific hook
claudekit-hooks run typecheck-changed

# List all available hooks
claudekit-hooks list

# Show execution statistics
claudekit-hooks stats

# View recent executions
claudekit-hooks recent 10

# Profile all configured hooks
claudekit-hooks profile

# Profile specific hook with multiple iterations
claudekit-hooks profile typecheck-changed --iterations 5
```

**Testing Hooks Directly:**
```bash
# Test TypeScript validation
echo '{"tool_input": {"file_path": "/path/to/file.ts"}}' | claudekit-hooks run typecheck-changed

# Test ESLint validation
echo '{"tool_input": {"file_path": "/path/to/file.js"}}' | claudekit-hooks run lint-changed

# Test auto-checkpoint (no input needed)
claudekit-hooks run create-checkpoint
```

## Linting Commands

```bash
claudekit lint-agents [directory] [options]

Options:
  -q, --quiet      Suppress suggestions, show only errors
  -v, --verbose    Show all files including valid ones

Examples:
  claudekit lint-agents              # Lint .claude/agents
  claudekit lint-agents src/agents   # Lint specific directory
```

**What it checks:**
- Required frontmatter fields (name, description)
- Tools field validation (empty fields, proper syntax, valid tool names)
- Proper markdown structure
- File naming conventions
- Configuration best practices (warns about empty tools fields that grant no permissions)

### `claudekit lint-commands`
Validate slash command markdown files.

```bash
claudekit lint-commands [directory] [options]

Options:
  -q, --quiet      Suppress suggestions, show only errors
  -v, --verbose    Show all files including valid ones

Examples:
  claudekit lint-commands               # Lint .claude/commands
  claudekit lint-commands src/commands  # Lint specific directory
  claudekit lint-commands -v            # Show all files
```

**What it checks:**
- Required frontmatter (description, allowed-tools)
- Tool permission syntax
- Command structure and conventions
- Security restrictions

## Global Installation

When installed globally (`npm install -g claudekit-dev`), commands are available system-wide:

```bash
# Available from any directory
claudekit setup
claudekit doctor
claudekit-hooks list
```

## Configuration Files

### Project Configuration
`.claude/settings.json` - Project-specific hook configuration
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{"type": "command", "command": "claudekit-hooks run typecheck-changed"}]
      }
    ]
  }
}
```

### User Configuration
`~/.claude/settings.json` - User-level environment variables
```json
{
  "env": {
    "BASH_DEFAULT_TIMEOUT_MS": "600000",
    "CUSTOM_VAR": "value"
  }
}
```

## Environment Variables

### Timeout Configuration
```bash
# Set default bash timeout (milliseconds)
export BASH_DEFAULT_TIMEOUT_MS=600000  # 10 minutes

# Set maximum allowed timeout
export BASH_MAX_TIMEOUT_MS=1200000     # 20 minutes
```

### Debug Mode
```bash
# Enable debug logging
export CLAUDEKIT_DEBUG=1

# Run with debug output
CLAUDEKIT_DEBUG=1 claudekit-hooks run typecheck-changed
```

## Common Workflows

### Initial Setup
```bash
# 1. Install claudekit globally
npm install -g claudekit-dev

# 2. Navigate to your project
cd my-project

# 3. Run interactive setup
claudekit setup

# 4. Validate installation
claudekit doctor
```

### Adding to Existing Project
```bash
# Add specific hooks or commands
claudekit add hook typecheck-changed
claudekit add command git:commit

# Or re-run setup with specific flags
claudekit setup --hooks typecheck-changed,lint-changed
```

### Debugging Issues
```bash
# Check installation status
claudekit doctor --verbose

# View recent hook executions
claudekit-hooks recent

# Test specific hook
echo '{"tool_input": {"file_path": "test.ts"}}' | claudekit-hooks run typecheck-changed --debug
```

## Tips and Best Practices

1. **Start with recommended defaults**: Use `claudekit setup` without flags for guided setup
2. **Test hooks before enabling**: Use `claudekit-hooks run` to test individual hooks
3. **Monitor performance**: Use `claudekit-hooks stats` to identify slow hooks
4. **Keep hooks fast**: Hooks should complete quickly to avoid disrupting workflow
5. **Use project-level settings**: Keep user settings minimal (environment vars only)
6. **Regular validation**: Run `claudekit doctor` after updates

## Troubleshooting

### Installation Issues
```bash
# Force reinstall
claudekit setup --force

# Check for conflicts
claudekit doctor --verbose
```

### Hook Not Triggering
```bash
# Check hook is configured
cat .claude/settings.json

# Test hook directly
claudekit-hooks run <hook-name> --debug

# Check recent executions
claudekit-hooks recent
```

### Performance Problems
```bash
# View execution statistics
claudekit-hooks stats

# Identify slow hooks
claudekit-hooks recent --verbose
```

## See Also

- [Slash Commands Reference](commands.md) - Claude Code slash commands
- [Hooks Reference](hooks.md) - Hook system documentation
- [Configuration Guide](../getting-started/configuration.md) - Detailed configuration options