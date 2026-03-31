/**
 * Shared utilities for codebase-map functionality
 * Used by both codebase-map and codebase-context hooks
 */

import { checkToolAvailable, execCommand } from './utils.js';

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
    // First, scan the project to create/update the index (scan everything for comprehensive index)
    await execCommand('codebase-map', ['scan'], {
      cwd: options.projectRoot,
    });

    // Then format and get the result with filtering — build args array to avoid shell injection
    const formatArgs: string[] = ['format', '--format', options.format ?? 'auto'];

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

    // Debug output to show exact command being run
    if (process.env['DEBUG'] === 'true') {
      console.error('Running codebase-map command:', 'codebase-map', formatArgs.join(' '));
    }

    const result = await execCommand('codebase-map', formatArgs, {
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
    await execCommand('codebase-map', ['update', filePath], {
      cwd: projectRoot,
    });
    return true;
  } catch {
    // Silent failure for updates to avoid disrupting workflow
    return false;
  }
}
