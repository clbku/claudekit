/**
 * Socket Firewall (sfw) Install Hook
 * Detects package installation commands and warns/recommends using sfw for security
 *
 * sfw wraps package managers to block malicious dependencies in real-time.
 * Learn more: https://github.com/SocketDev/sfw-free
 */

import { BaseHook } from './base.js';
import type { HookContext, HookResult } from './base.js';
import { execSync } from 'node:child_process';

// Package managers and their install commands
const PACKAGE_MANAGERS: Record<string, {
  installPatterns: RegExp[];
  ecosystem: string;
}> = {
  npm: {
    installPatterns: [
      /\bnpm\s+(install|i|add|ci|update|upgrade)\b/,
    ],
    ecosystem: 'JavaScript/TypeScript',
  },
  yarn: {
    installPatterns: [
      /\byarn\s+(add|install|upgrade)\b/,
    ],
    ecosystem: 'JavaScript/TypeScript',
  },
  pnpm: {
    installPatterns: [
      /\bpnpm\s+(add|install|update|upgrade)\b/,
    ],
    ecosystem: 'JavaScript/TypeScript',
  },
  bun: {
    installPatterns: [
      /\bbun\s+(add|install|update|upgrade)\b/,
    ],
    ecosystem: 'JavaScript/TypeScript',
  },
  pip: {
    installPatterns: [
      /\bpip3?\s+install\b/,
    ],
    ecosystem: 'Python',
  },
  uv: {
    installPatterns: [
      /\buv\s+pip\s+install\b/,
      /\buv\s+add\b/,
    ],
    ecosystem: 'Python',
  },
  cargo: {
    installPatterns: [
      /\bcargo\s+(install|add|update)\b/,
      /\bcargo\s+fetch\b/,
    ],
    ecosystem: 'Rust',
  },
  go: {
    installPatterns: [
      /\bgo\s+(get|install|mod\s+(download|tidy))\b/,
    ],
    ecosystem: 'Go',
  },
  gem: {
    installPatterns: [
      /\bgem\s+install\b/,
      /\bbundle\s+install\b/,
    ],
    ecosystem: 'Ruby',
  },
  composer: {
    installPatterns: [
      /\bcomposer\s+(install|update|require)\b/,
    ],
    ecosystem: 'PHP',
  },
};

export class SfwInstallHook extends BaseHook {
  name = 'sfw-install';

  static metadata = {
    id: 'sfw-install',
    displayName: 'Socket Firewall Install Protection',
    description: 'Warns about package installation commands and recommends using sfw for security',
    category: 'validation' as const,
    triggerEvent: 'PreToolUse' as const,
    matcher: 'Bash',
    dependencies: [],
  };

  private sfwAvailable: boolean | null = null;

  async execute(context: HookContext): Promise<HookResult> {
    const { payload } = context;

    // Only process Bash commands
    if (payload.tool_name !== 'Bash') {
      return { exitCode: 0 };
    }

    const toolInput = payload.tool_input as Record<string, unknown> | undefined;
    const command = toolInput?.['command'];

    if (command === undefined || command === null || typeof command !== 'string' || command === '') {
      return { exitCode: 0 };
    }

    // Skip if command already uses sfw
    if (/\bsfw\s+/.test(command)) {
      return { exitCode: 0 };
    }

    // Skip help/version flags (these just show info, don't actually install)
    // Check for --help, --version, -h as standalone flags
    if (/(?:^|\s)(?:--help|--version|-h)(?:\s|$)/.test(command)) {
      return { exitCode: 0 };
    }

    // Detect package installation commands
    const detectedManager = this.detectPackageManager(command);
    if (detectedManager === null) {
      // No install command detected - allow
      return { exitCode: 0 };
    }

    // Check if sfw is available
    const sfwInstalled = await this.checkSfwAvailable();

    if (sfwInstalled) {
      // sfw is installed - recommend wrapping the command
      return this.recommendSfw(command, detectedManager);
    } else {
      // sfw is not installed - warn about security risk
      return this.warnAboutSecurity(command, detectedManager);
    }
  }

  private detectPackageManager(command: string): string | null {
    for (const [manager, config] of Object.entries(PACKAGE_MANAGERS)) {
      for (const pattern of config.installPatterns) {
        if (pattern.test(command)) {
          return manager;
        }
      }
    }
    return null;
  }

  private async checkSfwAvailable(): Promise<boolean> {
    if (this.sfwAvailable !== null) {
      return this.sfwAvailable;
    }

    try {
      execSync('which sfw', { stdio: 'pipe', timeout: 2000 });
      this.sfwAvailable = true;
    } catch {
      this.sfwAvailable = false;
    }

    return this.sfwAvailable;
  }

  private recommendSfw(originalCommand: string, manager: string): HookResult {
    const wrappedCommand = originalCommand.replace(
      new RegExp(`\\b${manager}\\b`),
      `sfw ${manager}`
    );

    const managerConfig = PACKAGE_MANAGERS[manager];
    const ecosystem = managerConfig?.ecosystem ?? 'unknown';

    return {
      exitCode: 0,
      jsonResponse: {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `🔒 **Security Recommendation: Use Socket Firewall (sfw)**

Detected **${manager}** package installation for **${ecosystem}** ecosystem.

**Why use sfw?**
- Real-time blocking of malicious packages
- Zero configuration required
- Free and open source by Socket Security

**Recommended command:**
\`\`\`bash
${wrappedCommand}
\`\`\`

**To always use sfw**, set up shell aliases:
\`\`\`bash
# Add to ~/.bashrc or ~/.zshrc
alias npm='sfw npm'
alias yarn='sfw yarn'
alias pnpm='sfw pnpm'
alias pip='sfw pip'
alias cargo='sfw cargo'
\`\`\`

Or simply prefix your command with \`sfw\`:
\`\`\`bash
sfw ${originalCommand}
\`\`\`

To skip this warning and run without sfw, you can proceed.`,
        },
      },
    };
  }

  private warnAboutSecurity(originalCommand: string, manager: string): HookResult {
    const managerConfig = PACKAGE_MANAGERS[manager] ?? { ecosystem: 'unknown' };
    const ecosystem = managerConfig.ecosystem;

    return {
      exitCode: 0,
      jsonResponse: {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `⚠️ **Security Warning: Package Installation Without Protection**

Detected **${manager}** package installation for **${ecosystem}** ecosystem.

**Risk:** Installing packages without security scanning can expose your project to:
- Malicious code injection
- Supply chain attacks
- Known vulnerabilities (CVEs)

**Solution: Install Socket Firewall (sfw)**

\`\`\`bash
# Install via npm (recommended)
npm install -g sfw

# Or download binary directly
# macOS/Linux:
curl -L https://github.com/SocketDev/sfw-free/releases/latest/download/sfw-linux-x86_64 -o sfw
chmod +x sfw
sudo mv sfw /usr/local/bin/

# Windows (PowerShell):
# Download from: https://github.com/SocketDev/sfw-free/releases
\`\`\`

**After installation**, prefix your command with \`sfw\`:
\`\`\`bash
sfw ${originalCommand}
\`\`\`

To proceed without sfw (not recommended), you can continue.`,
        },
      },
    };
  }
}
