/**
 * Hook Utilities
 * Common utilities for hook implementation
 */

import { spawn } from 'node:child_process';
import type { SpawnOptions } from 'node:child_process';
import { setImmediate } from 'node:timers';
import fs from 'fs-extra';
import * as path from 'node:path';
import { Logger } from '../utils/logger.js';

const logger = new Logger('utils');

// Standard input reader with TTY detection and timeout
export async function readStdin(timeoutMs: number = 100): Promise<string> {
  // If stdin is a TTY (interactive), return empty immediately
  // This prevents hanging when run manually without piped input
  if (process.stdin.isTTY) {
    return '';
  }

  return new Promise((resolve, reject) => {
    let data = '';
    let resolved = false;

    // Set timeout for piped input
    const timer = setTimeout(() => {
      resolveOnce(data); // Return whatever we have so far
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);

      // Remove all listeners to prevent memory leaks
      process.stdin.removeAllListeners('data');
      process.stdin.removeAllListeners('end');
      process.stdin.removeAllListeners('error');

      // Properly close stdin to allow process to exit
      // Use setImmediate to avoid potential issues with immediate destruction
      setImmediate(() => {
        if (process.stdin.readable && !process.stdin.destroyed) {
          process.stdin.pause();
          process.stdin.unpipe();
          process.stdin.destroy();
        }
      });
    };

    const resolveOnce = (result: string): void => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(result);
      }
    };

    const rejectOnce = (error: Error): void => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(error);
      }
    };

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolveOnce(data);
    });

    process.stdin.on('error', (error) => {
      rejectOnce(error);
    });

    // Important: Set stdin to flowing mode to trigger events or timeout
    process.stdin.resume();
  });
}

// Project root discovery
export async function findProjectRoot(startDir: string = process.cwd()): Promise<string> {
  try {
    const result = await execCommand('git', ['rev-parse', '--show-toplevel'], { cwd: startDir });
    return result.stdout.trim();
  } catch {
    return process.cwd();
  }
}

// Package manager detection
export interface PackageManager {
  name: 'npm' | 'yarn' | 'pnpm';
  exec: string;
  /** Arguments to pass to exec when running a tool (e.g., ['dlx'] for pnpm dlx) */
  execArgs: string[];
  run: string;
  test: string;
}

export async function detectPackageManager(dir: string): Promise<PackageManager> {
  if (await fs.pathExists(path.join(dir, 'pnpm-lock.yaml'))) {
    return { name: 'pnpm', exec: 'pnpm', execArgs: ['dlx'], run: 'pnpm run', test: 'pnpm test' };
  }
  if (await fs.pathExists(path.join(dir, 'yarn.lock'))) {
    return { name: 'yarn', exec: 'yarn', execArgs: ['dlx'], run: 'yarn', test: 'yarn test' };
  }
  if (await fs.pathExists(path.join(dir, 'package.json'))) {
    // Check packageManager field
    try {
      const pkg = (await fs.readJson(path.join(dir, 'package.json'))) as {
        packageManager?: string;
      };
      if (pkg.packageManager !== undefined && typeof pkg.packageManager === 'string') {
        if (pkg.packageManager.startsWith('pnpm') === true) {
          return { name: 'pnpm', exec: 'pnpm', execArgs: ['dlx'], run: 'pnpm run', test: 'pnpm test' };
        }
        if (pkg.packageManager.startsWith('yarn') === true) {
          return { name: 'yarn', exec: 'yarn', execArgs: ['dlx'], run: 'yarn', test: 'yarn test' };
        }
      }
    } catch {
      // Ignore errors reading package.json
      // This is expected when package.json doesn't exist or is malformed
    }
  }
  return { name: 'npm', exec: 'npx', execArgs: [], run: 'npm run', test: 'npm test' };
}

// Command execution wrapper
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** True when the process was killed due to timeout */
  timedOut?: boolean;
  /** Signal used to terminate the process, if any (e.g., SIGTERM) */
  signal?: string | null;
  /** Whether the process was killed */
  killed?: boolean;
  /** Elapsed time in milliseconds for the executed command */
  durationMs?: number;
}

/**
 * Get spawn options with environment variables for proper process management
 * @param options - The base spawn options
 * @param command - Optional command string to determine if test-specific env vars are needed
 */
export function getExecOptions(options: SpawnOptions = {}, command?: string): SpawnOptions {
  // Only add vitest-specific env vars when running test commands
  const isTestCommand = command !== undefined &&
    (command.includes('test') || command.includes('vitest'));

  // Start with process.env but exclude vitest vars for non-test commands
  const processEnv = { ...process.env };
  if (!isTestCommand) {
    // Remove any vitest env vars that might be set from parent process
    delete processEnv['VITEST_POOL_TIMEOUT'];
    delete processEnv['VITEST_POOL_FORKS'];
    delete processEnv['VITEST_WATCH'];
  }

  const baseEnv = {
    ...processEnv,
    ...(options.env as Record<string, string | undefined> | undefined),
    // Ensure CI-like behavior for process cleanup
    CI: process.env['CI'] ?? 'false',
  };

  const baseOptions: SpawnOptions = {
    ...options,
    env: baseEnv,
    shell: false,
  };

  if (isTestCommand) {
    return {
      ...baseOptions,
      env: {
        ...baseEnv,
        // Force vitest to exit after tests complete (prevents hanging workers)
        VITEST_POOL_TIMEOUT: '30000',
        // Use single fork configuration to prevent multiple hanging workers
        VITEST_POOL_FORKS: '1',
        // Disable watch mode explicitly to ensure processes terminate
        VITEST_WATCH: 'false',
      },
    };
  }

  return baseOptions;
}

export async function execCommand(
  command: string,
  args: string[] = [],
  options: { cwd?: string; timeout?: number } = {}
): Promise<ExecResult> {
  const start = Date.now();
  const timeout = options.timeout ?? 30000;

  return await new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn(command, args, getExecOptions({
      cwd: options.cwd ?? process.cwd(),
    }, command));

    if (child.stdout !== null) {
      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    }
    if (child.stderr !== null) {
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      // Fallback SIGKILL after 5 seconds if SIGTERM didn't work
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');

      const killed = child.killed;
      const timedOut = killed && (signal === 'SIGTERM' || signal === 'SIGKILL');

      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        durationMs,
        timedOut,
        signal: signal ?? null,
        killed: killed ?? false,
      });
    });

    child.on('error', (_err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode: 1,
        durationMs,
        timedOut: false,
        signal: null,
        killed: false,
      });
    });
  });
}

// Error formatting
export function formatError(title: string, details: string, instructions: string[]): string {
  const instructionsList = instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n');

  return `BLOCKED: ${title}\n\n${details}\n\nMANDATORY INSTRUCTIONS:\n${instructionsList}`;
}

/**
 * Validate that a tool name is safe to execute.
 * Rejects names containing shell metacharacters, spaces, or path traversal.
 */
function isValidToolName(tool: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(tool);
}

// Make function available for testing
export { isValidToolName };

// Tool availability checking
export async function checkToolAvailable(
  tool: string,
  configFile: string,
  projectRoot: string
): Promise<boolean> {
  // Validate tool name to prevent command injection
  if (!isValidToolName(tool)) {
    if (process.env['CLAUDEKIT_DEBUG'] === 'true') {
      console.error(`[DEBUG] Rejected unsafe tool name: ${tool}`);
    }
    return false;
  }

  // Check config file exists
  if (!(await fs.pathExists(path.join(projectRoot, configFile)))) {
    return false;
  }

  // Check tool is executable
  const pm = await detectPackageManager(projectRoot);
  const result = await execCommand(pm.exec, [...pm.execArgs, tool, '--version'], {
    cwd: projectRoot,
    timeout: 10000,
  });

  return result.exitCode === 0;
}

/**
 * Execute a command and return the output.
 * Parses the command string into command + args to avoid shell injection.
 */
export async function executeCommand(
  command: string,
  cwd?: string
): Promise<{ stdout: string; stderr: string }> {
  // Parse command string into executable and arguments
  const parts = command.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error('Empty command');
  }
  const cmd = parts[0] as string;
  const args = parts.slice(1);

  try {
    const result = await execCommand(cmd, args, cwd !== undefined && cwd !== '' ? { cwd } : {});
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(`Command failed: ${command}`));
    throw error;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await fs.pathExists(filePath);
  } catch {
    return false;
  }
}

/**
 * Read JSON file
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  return await fs.readJson(filePath);
}

/**
 * Write JSON file
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeJson(filePath, data, { spaces: 2 });
}

/**
 * Find files matching a pattern
 */
export async function findFiles(pattern: string, directory: string): Promise<string[]> {
  const result = await execCommand('find', ['.', '-name', pattern], { cwd: directory });
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((file) => path.join(directory, file));
}

/**
 * Get file modification time
 */
export async function getFileModTime(filePath: string): Promise<Date> {
  const stats = await fs.stat(filePath);
  return stats.mtime;
}

/**
 * Create directory if it doesn't exist
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

/**
 * Parse hook payload from stdin
 */
export async function parseStdinPayload(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        const payload = JSON.parse(data);
        resolve(payload);
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });

    process.stdin.on('error', reject);
  });
}

/**
 * Extract file paths from hook payload
 */
export function extractFilePaths(payload: unknown): string[] {
  const paths: string[] = [];

  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return paths;
  }

  const obj = payload as Record<string, unknown>;

  // Check common payload structures
  if (typeof obj['file_path'] === 'string') {
    paths.push(obj['file_path']);
  }

  if (
    obj['tool_input'] !== null &&
    obj['tool_input'] !== undefined &&
    typeof obj['tool_input'] === 'object'
  ) {
    const toolInput = obj['tool_input'] as Record<string, unknown>;
    if (typeof toolInput['file_path'] === 'string') {
      paths.push(toolInput['file_path']);
    }
  }

  if (obj['edits'] !== null && obj['edits'] !== undefined && Array.isArray(obj['edits'])) {
    obj['edits'].forEach((edit: unknown) => {
      if (edit !== null && edit !== undefined && typeof edit === 'object') {
        const editObj = edit as Record<string, unknown>;
        if (typeof editObj['file_path'] === 'string') {
          paths.push(editObj['file_path']);
        }
      }
    });
  }

  return [...new Set(paths)]; // Remove duplicates
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format TypeScript errors with proper indentation
 */
export function formatTypeScriptErrors(result: ExecResult, command?: string): string {
  const header = '████ TypeScript Validation Failed ████\n\n';
  const message = 'TypeScript compilation errors must be fixed:\n\n';
  const output = result.stderr || result.stdout;
  const indentedOutput = output
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  const step2 =
    command !== undefined && command !== null && command.length > 0
      ? `2. Run '${command}' to verify fixes`
      : '2. Run type checking command to verify fixes';

  const actions = `

REQUIRED ACTIONS:
1. Fix all TypeScript errors shown above
${step2}
3. Make necessary corrections
4. The validation will run again automatically`;

  return header + message + indentedOutput + actions;
}

/**
 * Format ESLint errors with proper indentation
 */
export function formatESLintErrors(result: ExecResult): string {
  const header = '████ ESLint Validation Failed ████\n\n';
  const message = 'ESLint errors must be fixed:\n\n';
  const output = result.stdout || result.stderr;
  const indentedOutput = output
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  const actions =
    '\n\nREQUIRED ACTIONS:\n' +
    '1. Fix all ESLint errors shown above\n' +
    '2. Run lint command to verify fixes\n' +
    '3. Make necessary corrections\n' +
    '4. The validation will run again automatically';

  return header + message + indentedOutput + actions;
}

/**
 * Format Biome errors with proper indentation
 */
export function formatBiomeErrors(result: ExecResult): string {
  const header = '████ Biome Validation Failed ████\n\n';
  const message = 'Biome errors must be fixed:\n\n';
  const output = result.stdout || result.stderr;
  const indentedOutput = output
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  const actions =
    '\n\nREQUIRED ACTIONS:\n' +
    '1. Fix all Biome errors shown above\n' +
    "2. Run 'npx biome check --write' to apply fixes and verify issues are resolved\n" +
    '3. Common Biome fixes:\n' +
    '   - Import organization issues\n' +
    '   - Formatting inconsistencies\n' +
    '   - Code style violations\n' +
    '   - Suspicious patterns\n' +
    '4. The validation will run again automatically';

  return header + message + indentedOutput + actions;
}

/**
 * Format test errors with proper indentation
 */
export function formatTestErrors(result: ExecResult): string {
  const header = '████ Test Suite Failed ████\n\n';
  const message = 'Test failures must be fixed:\n\n';
  const output = result.stdout + result.stderr;
  const indentedOutput = output
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  const actions =
    '\n\nREQUIRED ACTIONS:\n' +
    '1. Fix all test failures shown above\n' +
    '2. Run test command to verify fixes\n' +
    '3. Make necessary corrections\n' +
    '4. The validation will run again automatically';

  return header + message + indentedOutput + actions;
}

/**
 * Extension Configuration Utilities
 * Common utilities for handling file extension configuration in hooks
 */

export interface ExtensionConfigurable {
  extensions?: string[] | undefined;
}

/**
 * Normalize extension format - removes leading/trailing dots and whitespace
 */
function normalizeExtension(ext: string): string {
  return ext.trim().replace(/^\.+|\.+$/g, '');
}

/**
 * Escape special regex characters in extension strings
 */
function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create regex pattern for matching file extensions
 */
export function createExtensionPattern(extensions: string[]): RegExp {
  const normalized = extensions.map(normalizeExtension).filter(Boolean);
  const escaped = normalized.map(escapeRegexChars);
  return new RegExp(`\\.(${escaped.join('|')})$`);
}

/**
 * Check if a file should be processed based on extension configuration
 */
export function shouldProcessFileByExtension(
  filePath: string | undefined,
  config: ExtensionConfigurable,
  defaultExtensions: string[] = ['js', 'jsx', 'ts', 'tsx']
): boolean {
  if (filePath === undefined || filePath === '') {
    return false;
  }

  const allowedExtensions = config.extensions || defaultExtensions;
  const pattern = createExtensionPattern(allowedExtensions);
  return pattern.test(filePath);
}
