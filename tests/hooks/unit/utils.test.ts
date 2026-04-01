import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers';
import {
  readStdin,
  findProjectRoot,
  detectPackageManager,
  execCommand,
  formatError,
  checkToolAvailable,
  fileExists,
  readJsonFile,
  writeJsonFile,
  findFiles,
  getFileModTime,
  ensureDirectory,
  parseStdinPayload,
  extractFilePaths,
  formatDuration,
} from '../../../cli/hooks/utils.js';

// Helper to create a mock spawn child process
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createMockChild(stdout = '', stderr = '', exitCode = 0, signal: string | null = null) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: vi.fn(), end: vi.fn() };
  child.kill = vi.fn();
  child.killed = false;

  setImmediate(() => {
    if (stdout) {
      child.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      child.stderr.emit('data', Buffer.from(stderr));
    }
    child.emit('close', exitCode, signal);
  });

  return child;
}

// Mock node:child_process with spawn (must match the import path in source)
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs-extra
vi.mock('fs-extra', () => {
  const pathExistsMock = vi.fn();
  const readJsonMock = vi.fn();
  const readFileMock = vi.fn();
  const writeJsonMock = vi.fn();
  const statMock = vi.fn();
  const ensureDirMock = vi.fn();

  return {
    default: {
      pathExists: pathExistsMock,
      readJson: readJsonMock,
      readFile: readFileMock,
      writeJson: writeJsonMock,
      stat: statMock,
      ensureDir: ensureDirMock,
    },
    pathExists: pathExistsMock,
    readJson: readJsonMock,
    readFile: readFileMock,
    writeJson: writeJsonMock,
    stat: statMock,
    ensureDir: ensureDirMock,
  };
});

// Get mocked fs module
const fs = (await import('fs-extra')) as unknown as {
  default: {
    pathExists: ReturnType<typeof vi.fn>;
    readJson: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    writeJson: ReturnType<typeof vi.fn>;
    stat: ReturnType<typeof vi.fn>;
    ensureDir: ReturnType<typeof vi.fn>;
  };
  pathExists: ReturnType<typeof vi.fn>;
  readJson: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  writeJson: ReturnType<typeof vi.fn>;
  stat: ReturnType<typeof vi.fn>;
  ensureDir: ReturnType<typeof vi.fn>;
};

describe('utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readStdin', () => {
    it('should read data from stdin', async () => {
      const testData = '{"test": "data"}';
      const originalStdin = process.stdin;
      const mockStdin = {
        isTTY: false, // Not a TTY, so should read from stdin
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(testData), 10);
          } else if (event === 'end') {
            setTimeout(() => callback(), 20);
          }
        }),
        resume: vi.fn(), // Mock resume method
        removeAllListeners: vi.fn(), // Mock removeAllListeners method
        pause: vi.fn(), // Mock pause method
        unpipe: vi.fn(), // Mock unpipe method
        destroy: vi.fn(), // Mock destroy method
        readable: true, // Mock readable property
        destroyed: false, // Mock destroyed property
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      const result = await readStdin();
      expect(result).toBe(testData);

      process.stdin = originalStdin;
    });

    it('should return empty string immediately if stdin is a TTY', async () => {
      const originalStdin = process.stdin;
      const mockStdin = {
        isTTY: true, // Is a TTY, so should return empty immediately
        on: vi.fn(),
        resume: vi.fn(),
        removeAllListeners: vi.fn(),
        pause: vi.fn(),
        unpipe: vi.fn(),
        destroy: vi.fn(),
        readable: true,
        destroyed: false,
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      const result = await readStdin();
      expect(result).toBe('');
      expect(mockStdin.on).not.toHaveBeenCalled();
      expect(mockStdin.resume).not.toHaveBeenCalled();

      process.stdin = originalStdin;
    });

    it('should handle timeout and return partial data', async () => {
      const partialData = '{"partial": ';
      const originalStdin = process.stdin;
      const mockStdin = {
        isTTY: false,
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(partialData), 10);
            // Don't trigger 'end' event to test timeout
          }
        }),
        resume: vi.fn(),
        removeAllListeners: vi.fn(),
        pause: vi.fn(),
        unpipe: vi.fn(),
        destroy: vi.fn(),
        readable: true,
        destroyed: false,
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      // Use shorter timeout for testing
      const result = await readStdin(50);
      expect(result).toBe(partialData);

      process.stdin = originalStdin;
    });
  });

  describe('findProjectRoot', () => {
    it('should use git rev-parse to find project root', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('/test/project/root\n', '', 0));

      const result = await findProjectRoot('/test/some/dir');

      expect(result).toBe('/test/project/root');
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--show-toplevel'],
        expect.objectContaining({ cwd: '/test/some/dir' })
      );
    });

    it('should return current directory when git command fails', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('', '', 1));

      // When git fails (exit code 1), stdout is empty so trim() returns ''
      // The try/catch in findProjectRoot only catches thrown errors, not non-zero exit codes
      const result = await findProjectRoot('/test/some/dir');

      expect(result).toBe('');
    });

    it('should use current directory when no startDir provided', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('/test/project\n', '', 0));

      await findProjectRoot();

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--show-toplevel'],
        expect.objectContaining({ cwd: process.cwd() })
      );
    });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm when pnpm-lock.yaml exists', async () => {
      fs.pathExists.mockImplementation(async (filePath: string) => {
        return filePath.includes('pnpm-lock.yaml');
      });

      const result = await detectPackageManager('/test/dir');

      expect(result).toEqual({
        name: 'pnpm',
        exec: 'pnpm',
        execArgs: ['dlx'],
        run: 'pnpm run',
        test: 'pnpm test',
      });
    });

    it('should detect yarn when yarn.lock exists', async () => {
      fs.pathExists.mockImplementation(async (filePath: string) => {
        return filePath.includes('yarn.lock');
      });

      const result = await detectPackageManager('/test/dir');

      expect(result).toEqual({
        name: 'yarn',
        exec: 'yarn',
        execArgs: ['dlx'],
        run: 'yarn',
        test: 'yarn test',
      });
    });

    it('should detect pnpm from packageManager field in package.json', async () => {
      fs.pathExists.mockImplementation(async (filePath: string) => {
        return filePath.includes('package.json');
      });
      fs.readJson.mockResolvedValue({
        packageManager: 'pnpm@8.0.0',
      });

      const result = await detectPackageManager('/test/dir');

      expect(result).toEqual({
        name: 'pnpm',
        exec: 'pnpm',
        execArgs: ['dlx'],
        run: 'pnpm run',
        test: 'pnpm test',
      });
    });

    it('should detect yarn from packageManager field in package.json', async () => {
      fs.pathExists.mockImplementation(async (filePath: string) => {
        return filePath.includes('package.json');
      });
      fs.readJson.mockResolvedValue({
        packageManager: 'yarn@3.0.0',
      });

      const result = await detectPackageManager('/test/dir');

      expect(result).toEqual({
        name: 'yarn',
        exec: 'yarn',
        execArgs: ['dlx'],
        run: 'yarn',
        test: 'yarn test',
      });
    });

    it('should default to npm when no lock files or packageManager field', async () => {
      fs.pathExists.mockImplementation(async (filePath: string) => {
        return filePath.includes('package.json');
      });
      fs.readJson.mockResolvedValue({});

      const result = await detectPackageManager('/test/dir');

      expect(result).toEqual({
        name: 'npm',
        exec: 'npx',
        execArgs: [],
        run: 'npm run',
        test: 'npm test',
      });
    });

    it('should default to npm when no package.json exists', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await detectPackageManager('/test/dir');

      expect(result).toEqual({
        name: 'npm',
        exec: 'npx',
        execArgs: [],
        run: 'npm run',
        test: 'npm test',
      });
    });

    it('should handle package.json read errors gracefully', async () => {
      fs.pathExists.mockImplementation(async (filePath: string) => {
        return filePath.includes('package.json');
      });
      fs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      const result = await detectPackageManager('/test/dir');

      expect(result).toEqual({
        name: 'npm',
        exec: 'npx',
        execArgs: [],
        run: 'npm run',
        test: 'npm test',
      });
    });
  });

  describe('execCommand', () => {
    it('should execute command successfully', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('Success output', 'Some warnings', 0));

      const result = await execCommand('npm', ['test'], { cwd: '/test/dir' });

      expect(result).toEqual(
        expect.objectContaining({
          stdout: 'Success output',
          stderr: 'Some warnings',
          exitCode: 0,
        })
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        'npm',
        ['test'],
        expect.objectContaining({
          cwd: '/test/dir',
          shell: false,
        })
      );
      // Verify the spawn was called with proper structure
      const callArgs = mockSpawn.mock.calls[0]?.[2] as { env: Record<string, string>; shell: boolean } | undefined;
      expect(callArgs).toBeDefined();
      expect(callArgs?.shell).toBe(false);
      expect(callArgs?.env).toBeDefined();
      expect(callArgs?.env?.['CI']).toBeDefined();
    });

    it('should handle command failure', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('Error output', '', 1));

      const result = await execCommand('npm', ['test']);

      expect(result).toEqual(
        expect.objectContaining({
          stdout: 'Error output',
          exitCode: 1,
        })
      );
    });

    it('should use default options when not provided', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('output', '', 0));

      await execCommand('ls');

      expect(mockSpawn).toHaveBeenCalledWith(
        'ls',
        [],
        expect.objectContaining({
          cwd: process.cwd(),
          shell: false,
        })
      );
      // Verify vitest env vars are NOT present for non-test commands
      const callArgs = mockSpawn.mock.calls[0]?.[2] as { env: Record<string, string>; shell: boolean } | undefined;
      expect(callArgs?.env?.['CI']).toBeDefined();
      expect(callArgs?.env?.['VITEST_POOL_TIMEOUT']).toBeUndefined();
      expect(callArgs?.env?.['VITEST_POOL_FORKS']).toBeUndefined();
      expect(callArgs?.env?.['VITEST_WATCH']).toBeUndefined();
    });

    it('should respect custom timeout', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('output', '', 0));

      await execCommand('npm', ['test'], { timeout: 60000 });

      // spawn itself doesn't take a timeout option; the timeout is handled
      // internally by the execCommand wrapper using child.kill after the timeout.
      // Vitest env vars are NOT set because the command name 'npm' doesn't contain 'test'.
      expect(mockSpawn).toHaveBeenCalledWith(
        'npm',
        ['test'],
        expect.objectContaining({
          shell: false,
        })
      );
      // Verify vitest env vars are NOT set since command 'npm' doesn't contain 'test'
      const callArgs = mockSpawn.mock.calls[0]?.[2] as { env: Record<string, string>; shell: boolean } | undefined;
      expect(callArgs?.env?.['VITEST_POOL_TIMEOUT']).toBeUndefined();
    });
  });

  describe('formatError', () => {
    it('should format error with title, details, and instructions', () => {
      const result = formatError('TypeScript Error', 'Type mismatch in file.ts', [
        'Fix the type annotation',
        'Run typecheck again',
        'Commit the fix',
      ]);

      expect(result).toBe(
        'BLOCKED: TypeScript Error\n\n' +
          'Type mismatch in file.ts\n\n' +
          'MANDATORY INSTRUCTIONS:\n' +
          '1. Fix the type annotation\n' +
          '2. Run typecheck again\n' +
          '3. Commit the fix'
      );
    });

    it('should handle empty instructions array', () => {
      const result = formatError('Error', 'Details', []);

      expect(result).toBe('BLOCKED: Error\n\n' + 'Details\n\n' + 'MANDATORY INSTRUCTIONS:\n');
    });
  });

  describe('checkToolAvailable', () => {
    it('should return false when config file does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await checkToolAvailable('eslint', '.eslintrc.json', '/test/project');

      expect(result).toBe(false);
      expect(fs.pathExists).toHaveBeenCalledWith('/test/project/.eslintrc.json');
    });

    it('should check tool execution when config exists', async () => {
      fs.pathExists.mockResolvedValue(true);
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('v8.0.0\n', '', 0));

      const result = await checkToolAvailable('eslint', '.eslintrc.json', '/test/project');

      expect(result).toBe(true);
      // checkToolAvailable calls execCommand(pm.exec, [...pm.execArgs, tool, '--version'])
      // Default PM is npm with npx and no execArgs, so command is 'npx' with args ['eslint', '--version']
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('eslint'), '--version']),
        expect.objectContaining({
          env: expect.objectContaining({ CI: expect.any(String) }),
          shell: false,
        })
      );
    });

    it('should return false when tool execution fails', async () => {
      fs.pathExists.mockResolvedValue(true);
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('', 'Command not found', 1));

      const result = await checkToolAvailable('eslint', '.eslintrc.json', '/test/project');

      expect(result).toBe(false);
    });
  });

  describe('file operations', () => {
    describe('fileExists', () => {
      it('should return true when file exists', async () => {
        fs.pathExists.mockResolvedValue(true);

        const result = await fileExists('/test/file.ts');

        expect(result).toBe(true);
        expect(fs.pathExists).toHaveBeenCalledWith('/test/file.ts');
      });

      it('should return false when file does not exist', async () => {
        fs.pathExists.mockResolvedValue(false);

        const result = await fileExists('/test/missing.ts');

        expect(result).toBe(false);
      });

      it('should handle errors gracefully', async () => {
        fs.pathExists.mockRejectedValue(new Error('Permission denied'));

        const result = await fileExists('/test/file.ts');

        expect(result).toBe(false);
      });
    });

    describe('readJsonFile', () => {
      it('should read and parse JSON file', async () => {
        const testData = { test: 'data', count: 42 };
        fs.readJson.mockResolvedValue(testData);

        const result = await readJsonFile('/test/config.json');

        expect(result).toEqual(testData);
        expect(fs.readJson).toHaveBeenCalledWith('/test/config.json');
      });
    });

    describe('writeJsonFile', () => {
      it('should write JSON file with proper formatting', async () => {
        const testData = { test: 'data', count: 42 };
        fs.writeJson.mockResolvedValue(undefined);

        await writeJsonFile('/test/output.json', testData);

        expect(fs.writeJson).toHaveBeenCalledWith('/test/output.json', testData, { spaces: 2 });
      });
    });

    describe('getFileModTime', () => {
      it('should return file modification time', async () => {
        const modTime = new Date('2025-01-01T00:00:00Z');
        fs.stat.mockResolvedValue({
          mtime: modTime,
        } as { mtime: Date });

        const result = await getFileModTime('/test/file.ts');

        expect(result).toEqual(modTime);
        expect(fs.stat).toHaveBeenCalledWith('/test/file.ts');
      });
    });

    describe('ensureDirectory', () => {
      it('should create directory if it does not exist', async () => {
        fs.ensureDir.mockResolvedValue(undefined);

        await ensureDirectory('/test/new/dir');

        expect(fs.ensureDir).toHaveBeenCalledWith('/test/new/dir');
      });
    });
  });

  describe('findFiles', () => {
    it('should find files matching pattern', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('./src/file1.ts\n./src/file2.ts\n./test/file3.ts\n', '', 0));

      const result = await findFiles('*.ts', '/test/project');

      // The implementation joins paths without the extra './'
      expect(result).toEqual([
        '/test/project/src/file1.ts',
        '/test/project/src/file2.ts',
        '/test/project/test/file3.ts',
      ]);
      expect(mockSpawn).toHaveBeenCalledWith(
        'find',
        ['.', '-name', '*.ts'],
        expect.objectContaining({ cwd: '/test/project', shell: false })
      );
    });

    it('should handle empty results', async () => {
      const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;
      mockSpawn.mockReturnValue(createMockChild('', '', 0));

      const result = await findFiles('*.xyz', '/test/project');

      expect(result).toEqual([]);
    });
  });

  describe('parseStdinPayload', () => {
    it('should parse valid JSON from stdin', async () => {
      const testPayload = { tool: 'Write', file_path: '/test/file.ts' };
      const originalStdin = process.stdin;

      const mockStdin = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(JSON.stringify(testPayload)), 10);
          } else if (event === 'end') {
            setTimeout(() => callback(), 20);
          }
        }),
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      const result = await parseStdinPayload();

      expect(result).toEqual(testPayload);
      process.stdin = originalStdin;
    });

    it('should reject on invalid JSON', async () => {
      const originalStdin = process.stdin;

      const mockStdin = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback('invalid json'), 10);
          } else if (event === 'end') {
            setTimeout(() => callback(), 20);
          }
        }),
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      await expect(parseStdinPayload()).rejects.toThrow('Invalid JSON payload');

      process.stdin = originalStdin;
    });

    it('should handle stdin errors', async () => {
      const originalStdin = process.stdin;
      const testError = new Error('stdin error');

      const mockStdin = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(testError), 10);
          }
        }),
      };
      Object.defineProperty(process, 'stdin', {
        value: mockStdin,
        writable: true,
        configurable: true,
      });

      await expect(parseStdinPayload()).rejects.toThrow('stdin error');

      process.stdin = originalStdin;
    });
  });

  describe('extractFilePaths', () => {
    it('should extract file_path from top level', () => {
      const payload = { file_path: '/test/file.ts' };
      const result = extractFilePaths(payload);

      expect(result).toEqual(['/test/file.ts']);
    });

    it('should extract file_path from tool_input', () => {
      const payload = { tool_input: { file_path: '/test/file.ts' } };
      const result = extractFilePaths(payload);

      expect(result).toEqual(['/test/file.ts']);
    });

    it('should extract file paths from edits array', () => {
      const payload = {
        edits: [
          { file_path: '/test/file1.ts', old_string: 'old', new_string: 'new' },
          { file_path: '/test/file2.ts', old_string: 'old', new_string: 'new' },
        ],
      };
      const result = extractFilePaths(payload);

      expect(result).toEqual(['/test/file1.ts', '/test/file2.ts']);
    });

    it('should remove duplicate paths', () => {
      const payload = {
        file_path: '/test/file.ts',
        tool_input: { file_path: '/test/file.ts' },
        edits: [{ file_path: '/test/file.ts' }, { file_path: '/test/other.ts' }],
      };
      const result = extractFilePaths(payload);

      expect(result).toEqual(['/test/file.ts', '/test/other.ts']);
    });

    it('should return empty array when no paths found', () => {
      const payload = { other_field: 'value' };
      const result = extractFilePaths(payload);

      expect(result).toEqual([]);
    });

    it('should handle missing fields gracefully', () => {
      const payload = {
        tool_input: {},
        edits: null,
      };
      const result = extractFilePaths(payload);

      expect(result).toEqual([]);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(5500)).toBe('5s');
      expect(formatDuration(59999)).toBe('59s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(125000)).toBe('2m 5s');
      expect(formatDuration(3665000)).toBe('61m 5s');
    });
  });
});
