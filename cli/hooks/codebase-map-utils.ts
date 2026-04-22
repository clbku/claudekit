/**
 * Shared utilities for codebase-map functionality
 * Used by both codebase-map and codebase-context hooks
 */

import { checkToolAvailable, detectPackageManager, execCommand } from './utils.js';

export interface CodebaseMapConfig {
  include?: string[];
  exclude?: string[];
  format?: 'auto' | 'json' | 'dsl' | 'graph' | 'markdown' | 'tree' | string;
}

export interface CodebaseMapOptions {
  include?: string[] | undefined;
  exclude?: string[] | undefined;
  format?: string | undefined;
  projectRoot: string;
}

export interface CodebaseMapResult {
  success: boolean;
  output?: string;
  error?: Error;
}

/**
 * Generate a codebase map for the project
 */
export async function generateCodebaseMap(options: CodebaseMapOptions): Promise<CodebaseMapResult> {
  // Check if codebase-map is installed
  if (!(await checkToolAvailable('codebase-map', 'package.json', options.projectRoot))) {
    return {
      success: false,
      error: new Error(
        'codebase-map CLI not found. Install it from: https://github.com/carlrannaberg/codebase-map'
      ),
    };
  }

  try {
    // Detect package manager to resolve the command properly
    const pm = await detectPackageManager(options.projectRoot);
    const cmd = pm.exec;
    const scanArgs = [...pm.execArgs, 'codebase-map', 'scan'];

    // First, scan the project to create/update the index (scan everything for comprehensive index)
    await execCommand(cmd, scanArgs, {
      cwd: options.projectRoot,
    });

    // Then format and get the result with filtering
    const formatArgs: string[] = [...pm.execArgs, 'codebase-map', 'format', '--format', options.format ?? 'auto'];

    // Add include patterns if specified
    if (options.include && options.include.length > 0) {
      for (const pattern of options.include) {
        formatArgs.push('--include', pattern);
      }
    }

    // Add exclude patterns if specified
    if (options.exclude && options.exclude.length > 0) {
      for (const pattern of options.exclude) {
        formatArgs.push('--exclude', pattern);
      }
    }

    const result = await execCommand(cmd, formatArgs, {
      cwd: options.projectRoot,
    });

    return { success: true, output: result.stdout.trim() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Update codebase map for a specific file
 */
export async function updateCodebaseMap(
  filePath: string,
  projectRoot: string
): Promise<boolean> {
  if (!(await checkToolAvailable('codebase-map', 'package.json', projectRoot))) {
    return false;
  }

  try {
    const pm = await detectPackageManager(projectRoot);
    await execCommand(pm.exec, [...pm.execArgs, 'codebase-map', 'update', filePath], {
      cwd: projectRoot,
    });
    return true;
  } catch {
    // Silent failure for updates to avoid disrupting workflow
    return false;
  }
}
