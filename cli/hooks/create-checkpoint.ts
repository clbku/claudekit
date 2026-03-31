import type { HookContext, HookResult } from './base.js';
import { BaseHook } from './base.js';
import { getHookConfig } from '../utils/claudekit-config.js';
import { DEFAULT_PATTERNS } from './sensitive-patterns.js';
import { globToRegExp } from './file-guard/utils.js';

interface CreateCheckpointConfig {
  prefix?: string;
  maxCheckpoints?: number;
}

/** Pre-compiled regex from sensitive patterns for fast matching */
const SENSITIVE_REGEXES = DEFAULT_PATTERNS.map(
  (p) => globToRegExp(p, { flags: 'i', extended: true, globstar: true }),
);

function isSensitiveFile(filePath: string): boolean {
  return SENSITIVE_REGEXES.some((re) => re.test(filePath));
}

export class CreateCheckpointHook extends BaseHook {
  name = 'create-checkpoint';

  static metadata = {
    id: 'create-checkpoint',
    displayName: 'Create Checkpoint',
    description: 'Git auto-checkpoint on stop',
    category: 'git' as const,
    triggerEvent: ['Stop', 'SubagentStop'] as const,
    matcher: '*',
    dependencies: ['git'],
  };

  private loadConfig(projectRoot: string): CreateCheckpointConfig {
    return getHookConfig<CreateCheckpointConfig>('create-checkpoint', projectRoot) || {};
  }

  async execute(context: HookContext): Promise<HookResult> {
    const { projectRoot } = context;
    const config = this.loadConfig(projectRoot);
    const prefix = config.prefix ?? 'claude';
    const maxCheckpoints = config.maxCheckpoints ?? 10;

    // Check if there are any changes to checkpoint
    const { stdout: statusOutput } = await this.execCommand(
      'git',
      ['status', '--porcelain'],
      { cwd: projectRoot },
    );

    if (!statusOutput.trim()) {
      return { exitCode: 0, suppressOutput: true };
    }

    // Collect all changed/untracked files and filter out sensitive ones
    const allFiles = statusOutput
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim()); // "XY filename" → "filename"

    const safeFiles = allFiles.filter((f) => !isSensitiveFile(f));

    if (safeFiles.length === 0) {
      // Only sensitive files changed — skip checkpoint entirely
      return { exitCode: 0, suppressOutput: true };
    }

    // Create checkpoint with timestamp
    const timestamp = new Date().toISOString();
    const message = `${prefix}-checkpoint: Auto-save at ${timestamp}`;

    // Stage only safe files (not git add -A)
    await this.execCommand('git', ['add', '--', ...safeFiles], { cwd: projectRoot });

    // Create stash object without modifying working directory
    const { stdout: stashSha } = await this.execCommand(
      'git',
      ['stash', 'create', message],
      { cwd: projectRoot },
    );

    if (stashSha.trim()) {
      // Store the stash in the stash list
      await this.execCommand(
        'git',
        ['stash', 'store', '-m', message, stashSha.trim()],
        { cwd: projectRoot },
      );

      // Reset index to unstage files
      await this.execCommand('git', ['reset'], { cwd: projectRoot });

      // Clean up old checkpoints if needed
      await this.cleanupOldCheckpoints(prefix, maxCheckpoints, projectRoot);
    }

    return {
      exitCode: 0,
      suppressOutput: true,
      jsonResponse: { suppressOutput: true },
    };
  }

  private async cleanupOldCheckpoints(
    prefix: string,
    maxCount: number,
    projectRoot: string,
  ): Promise<void> {
    const { stdout } = await this.execCommand('git', ['stash', 'list'], {
      cwd: projectRoot,
    });

    const checkpoints = stdout
      .split('\n')
      .filter((line) => line.includes(`${prefix}-checkpoint`))
      .map((line, index) => ({ line, index }));

    if (checkpoints.length > maxCount) {
      const toRemove = checkpoints.slice(maxCount);
      for (const checkpoint of toRemove.reverse()) {
        await this.execCommand('git', ['stash', 'drop', `stash@{${checkpoint.index}}`], {
          cwd: projectRoot,
        });
      }
    }
  }
}
