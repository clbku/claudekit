import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ensureDirectoryExists, expandHomePath, pathExists } from './filesystem.js';
import { Colors } from '../utils/colors.js';

const USER_CLAUDE_DIR = expandHomePath('~/.claude');
const STATUSLINE_FILENAME = 'statusline-command.sh';

export const STATUSLINE_SCRIPT = `#!/usr/bin/env bash
# Claude Code status line
# Segments: git branch+status - model - context% - input tokens - output tokens

input=$(cat)
cwd=$(echo "$input" | jq -r '.workspace.current_dir')

# --- format number as human-readable (e.g. 24802 → 24.8k) ---
fmt_num() {
  local n=$1
  if [ "$n" -ge 1000000 ]; then
    awk "BEGIN {printf \\"%.1fM\\", $n/1000000}"
  elif [ "$n" -ge 1000 ]; then
    awk "BEGIN {printf \\"%.1fk\\", $n/1000}"
  else
    echo "$n"
  fi
}

# --- git branch + status ---
git_info=""
git_dir=$(git -C "$cwd" rev-parse --git-dir 2>/dev/null)
if [ -n "$git_dir" ]; then
  branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null || git -C "$cwd" --no-optional-locks rev-parse --short HEAD 2>/dev/null)

  if [ "\${#branch}" -gt 32 ]; then
    branch="\${branch:0:12}...\${branch: -12}"
  fi

  staged=$(git -C "$cwd" --no-optional-locks diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
  unstaged=$(git -C "$cwd" --no-optional-locks diff --numstat 2>/dev/null | wc -l | tr -d ' ')
  untracked=$(git -C "$cwd" --no-optional-locks ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
  ahead=$(git -C "$cwd" --no-optional-locks rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo "0")
  behind=$(git -C "$cwd" --no-optional-locks rev-list --count 'HEAD..@{upstream}' 2>/dev/null || echo "0")

  status_parts=""
  [ "$staged" -gt 0 ] && status_parts="\${status_parts}+\${staged}"
  [ "$unstaged" -gt 0 ] && status_parts="\${status_parts}!\${unstaged}"
  [ "$untracked" -gt 0 ] && status_parts="\${status_parts}?\${untracked}"
  [ "$ahead" -gt 0 ] && status_parts="\${status_parts}^\${ahead}"
  [ "$behind" -gt 0 ] && status_parts="\${status_parts}v\${behind}"

  if [ -n "$status_parts" ]; then
    git_info="\${branch} \${status_parts}"
  else
    git_info="\${branch}"
  fi
fi

# --- model name ---
model=$(echo "$input" | jq -r '.model.display_name // empty')

# --- context window usage ---
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# --- input/output tokens ---
in_tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
out_tokens=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')

# --- assemble ---
parts=""

# Git (green clean, yellow dirty)
if [ -n "$git_info" ]; then
  if [ -n "$status_parts" ]; then
    parts+="\\033[33m\${git_info}\\033[0m"
  else
    parts+="\\033[32m\${git_info}\\033[0m"
  fi
fi

# Model (cyan)
if [ -n "$model" ]; then
  [ -n "$parts" ] && parts+=" \\033[38;5;240m-\\033[0m "
  parts+="\\033[36m\${model}\\033[0m"
fi

# Context window (color-coded)
if [ -n "$used" ]; then
  [ -n "$parts" ] && parts+=" \\033[38;5;240m-\\033[0m "
  used_int=\${used%.*}
  if [ "$used_int" -gt 80 ]; then
    parts+="\\033[31mctx:\${used%%.*}%\\033[0m"
  elif [ "$used_int" -gt 50 ]; then
    parts+="\\033[33mctx:\${used%%.*}%\\033[0m"
  else
    parts+="\\033[32mctx:\${used%%.*}%\\033[0m"
  fi
fi

# Input tokens (blue)
in_fmt=$(fmt_num "$in_tokens")
[ -n "$parts" ] && parts+=" \\033[38;5;240m-\\033[0m "
parts+="\\033[38;5;117min:\${in_fmt}\\033[0m"

# Output tokens (magenta)
out_fmt=$(fmt_num "$out_tokens")
[ -n "$parts" ] && parts+=" \\033[38;5;240m-\\033[0m "
parts+="\\033[38;5;176mout:\${out_fmt}\\033[0m"

printf '%b' "\${parts}"
`;

export interface StatuslineInstallOptions {
  quiet?: boolean | undefined;
  force?: boolean | undefined;
}

export async function installStatusline(options: StatuslineInstallOptions = {}): Promise<void> {
  const scriptPath = path.join(USER_CLAUDE_DIR, STATUSLINE_FILENAME);
  const settingsPath = path.join(USER_CLAUDE_DIR, 'settings.json');

  await ensureDirectoryExists(USER_CLAUDE_DIR);

  // Check if script already exists
  if (await pathExists(scriptPath)) {
    if (options.force !== true) {
      if (options.quiet !== true) {
        console.log(
          Colors.warn(`\n${STATUSLINE_FILENAME} already exists at ${USER_CLAUDE_DIR}`)
        );
        console.log(Colors.dim('Use --force to overwrite, or remove the existing file first.'));
      }
      return;
    }
    if (options.quiet !== true) {
      console.log(Colors.dim(`Overwriting existing ${STATUSLINE_FILENAME}`));
    }
  }

  // Write script
  await fs.writeFile(scriptPath, STATUSLINE_SCRIPT, 'utf-8');
  await fs.chmod(scriptPath, 0o755);

  if (options.quiet !== true) {
    console.log(Colors.success(`  ✓ Wrote ${STATUSLINE_FILENAME} to ${USER_CLAUDE_DIR}`));
  }

  // Update settings.json
  let settings: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    settings = JSON.parse(content) as Record<string, unknown>;
  } catch {
    // No existing settings — will create new
  }

  const absoluteScriptPath = scriptPath;
  const statusLineConfig = {
    type: 'command',
    command: `bash ${absoluteScriptPath}`,
  };

  const existing = settings['statusLine'] as Record<string, unknown> | undefined;
  const isSameConfig =
    existing !== undefined &&
    existing['type'] === statusLineConfig.type &&
    existing['command'] === statusLineConfig.command;

  if (!isSameConfig) {
    settings['statusLine'] = statusLineConfig;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    if (options.quiet !== true) {
      console.log(Colors.success(`  ✓ Updated settings.json with statusLine config`));
    }
  } else if (options.quiet !== true) {
    console.log(Colors.dim('  statusLine config already up-to-date in settings.json'));
  }
}
