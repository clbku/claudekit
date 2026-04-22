/**
 * Integration tests for codebase-map hooks
 * Tests coordination between the hooks and shared utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { CodebaseMapHook } from '../../cli/hooks/codebase-map.js';
import type { HookContext } from '../../cli/hooks/base.js';
import * as utils from '../../cli/hooks/utils.js';
import * as claudekitConfig from '../../cli/utils/claudekit-config.js';
import * as fs from 'node:fs/promises';

// Mock modules before imports
vi.mock('node:util', () => ({
  promisify: (fn: unknown): unknown => fn,
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('../../cli/hooks/utils.js');
vi.mock('../../cli/utils/claudekit-config.js');
vi.mock('node:fs/promises');
// Don't mock session-utils - let it use real implementation with mocked fs

const TEST_PROJECT_ROOT = '/test/project';

function createSessionStartContext(sessionId: string): HookContext {
  return {
    filePath: undefined,
    projectRoot: TEST_PROJECT_ROOT,
    payload: {
      hook_event_name: 'UserPromptSubmit',
      session_id: sessionId,
    },
    packageManager: 'npm' as unknown as HookContext['packageManager'],
  };
}

function createUserPromptContext(sessionId: string, prompt: string = 'test prompt'): HookContext {
  return {
    filePath: undefined,
    projectRoot: TEST_PROJECT_ROOT,
    payload: {
      hook_event_name: 'UserPromptSubmit',
      session_id: sessionId,
      prompt,
    },
    packageManager: 'npm' as unknown as HookContext['packageManager'],
  };
}

describe('Codebase Hooks Integration', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let mockExecCommand: Mock;
  let mockCheckToolAvailable: Mock;
  let mockGetHookConfig: Mock;
  let mockFsAccess: Mock;
  let mockFsReadFile: Mock;
  let mockFsWriteFile: Mock;
  let mockFsMkdir: Mock;
  let mockFsReaddir: Mock;

  beforeEach(async () => {
    // Get the auto-mocked execCommand from utils
    mockExecCommand = vi.mocked(utils.execCommand);
    mockCheckToolAvailable = vi.mocked(utils.checkToolAvailable);
    mockGetHookConfig = vi.mocked(claudekitConfig.getHookConfig);
    mockFsAccess = vi.mocked(fs.access);
    mockFsReadFile = vi.mocked(fs.readFile);
    mockFsWriteFile = vi.mocked(fs.writeFile);
    mockFsMkdir = vi.mocked(fs.mkdir);
    mockFsReaddir = vi.mocked(fs.readdir);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Default mock behavior
    mockCheckToolAvailable.mockResolvedValue(true);
    mockGetHookConfig.mockReturnValue({});
    mockFsAccess.mockRejectedValue(new Error('File not found'));
    mockFsMkdir.mockResolvedValue(undefined);
    mockFsWriteFile.mockResolvedValue(undefined);
    mockExecCommand.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    mockFsReaddir.mockResolvedValue([]);
    vi.mocked(utils.detectPackageManager).mockResolvedValue({
      name: 'npm',
      exec: 'npx',
      execArgs: [],
      run: 'npm run',
      test: 'npm test',
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Hook Coordination', () => {
    it('should coordinate between SessionStart and UserPromptSubmit hooks', async () => {
      const sessionId = '12345678-1234-1234-1234-123456789012';
      const mapOutput = '# Project Structure\ncli/index.ts > cli/utils';

      mockExecCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // scan
        .mockResolvedValueOnce({ exitCode: 0, stdout: mapOutput, stderr: '' }); // format

      // First run: SessionStart hook generates map
      const mapHook = new CodebaseMapHook();
      const mapResult = await mapHook.execute(createSessionStartContext(sessionId));

      expect(mapResult.exitCode).toBe(0);

      // Reset mocks for second hook
      consoleLogSpy.mockClear();
      mockExecCommand.mockClear();
      mockExecCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // scan
        .mockResolvedValueOnce({ exitCode: 0, stdout: mapOutput, stderr: '' }); // format

      // Second run: UserPromptSubmit hook on first prompt
      const contextHook = new CodebaseMapHook();
      const firstPromptResult = await contextHook.execute(
        createUserPromptContext(sessionId, 'first prompt')
      );

      expect(firstPromptResult.exitCode).toBe(0);
      expect(firstPromptResult.jsonResponse).toBeDefined();
      const jsonResponse = firstPromptResult.jsonResponse as {
        hookSpecificOutput: {
          hookEventName: string;
          additionalContext: string;
        };
      };
      expect(jsonResponse?.hookSpecificOutput?.additionalContext).toContain(
        '📍 Codebase Map (loaded once per session):'
      );
      expect(mockFsWriteFile).toHaveBeenCalledWith(
        expect.stringContaining(`codebase-map-session-${sessionId}.json`),
        expect.stringContaining('"contextProvided": true')
      );

      // Third run: UserPromptSubmit hook on second prompt (should skip)
      consoleLogSpy.mockClear();
      mockExecCommand.mockClear();

      // Mock that session file exists
      mockFsAccess.mockResolvedValueOnce(undefined);
      mockFsReadFile.mockResolvedValueOnce(
        JSON.stringify({
          contextProvided: true,
          timestamp: new Date().toISOString(),
          sessionId,
        })
      );

      const secondPromptResult = await contextHook.execute(
        createUserPromptContext(sessionId, 'second prompt')
      );

      expect(secondPromptResult.exitCode).toBe(0);
      expect(mockExecCommand).not.toHaveBeenCalled(); // Should not regenerate map
      expect(consoleLogSpy).not.toHaveBeenCalled(); // Should not output again
    });

    it('should handle different sessions independently', async () => {
      const session1 = '11111111-1111-1111-1111-111111111111';
      const session2 = '22222222-2222-2222-2222-222222222222';
      const mapOutput = 'test map';

      mockExecCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: mapOutput, stderr: '' });

      // First session
      const contextHook = new CodebaseMapHook();
      await contextHook.execute(createUserPromptContext(session1));

      expect(mockFsWriteFile).toHaveBeenCalledWith(
        expect.stringContaining(`codebase-map-session-${session1}.json`),
        expect.any(String)
      );

      // Reset for second session
      mockExecCommand.mockClear();
      mockExecCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: mapOutput, stderr: '' });

      // Second session should also generate map
      await contextHook.execute(createUserPromptContext(session2));

      expect(mockFsWriteFile).toHaveBeenCalledWith(
        expect.stringContaining(`codebase-map-session-${session2}.json`),
        expect.any(String)
      );
    });

    it('should share configuration between hooks using same codebase-map tool', async () => {
      const customConfig = {
        include: ['src/**'],
        exclude: ['**/*.test.ts'],
        format: 'json',
      };

      mockGetHookConfig.mockImplementation((hookId: string) => {
        if (hookId === 'codebase-map') {
          return customConfig;
        }
        return {};
      });

      mockExecCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: '{"files": []}', stderr: '' });

      const mapHook = new CodebaseMapHook();
      await mapHook.execute(createSessionStartContext('33333333-3333-3333-3333-333333333333'));

      // Check that filtering was applied via execCommand args
      expect(mockExecCommand).toHaveBeenCalledWith('npx', ['codebase-map', 'scan'], expect.any(Object));
      expect(mockExecCommand).toHaveBeenCalledWith(
        'npx',
        ['codebase-map', 'format', '--format', 'json', '--include', 'src/**', '--exclude', '**/*.test.ts'],
        expect.any(Object)
      );

      // Reset and test context hook
      mockExecCommand.mockClear();
      mockExecCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: '{"files": []}', stderr: '' });

      const contextHook = new CodebaseMapHook();
      await contextHook.execute(createUserPromptContext('44444444-4444-4444-4444-444444444444'));

      // Should use same filtering configuration
      expect(mockExecCommand).toHaveBeenCalledWith('npx', ['codebase-map', 'scan'], expect.any(Object));
      expect(mockExecCommand).toHaveBeenCalledWith(
        'npx',
        ['codebase-map', 'format', '--format', customConfig.format, '--include', 'src/**', '--exclude', '**/*.test.ts'],
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle codebase-map tool not being installed gracefully', async () => {
      mockCheckToolAvailable.mockResolvedValue(false);

      const mapHook = new CodebaseMapHook();
      const mapResult = await mapHook.execute(createSessionStartContext('55555555-5555-5555-5555-555555555555'));

      expect(mapResult.exitCode).toBe(0); // Should not block
      expect(mockExecCommand).not.toHaveBeenCalled();

      const contextHook = new CodebaseMapHook();
      const contextResult = await contextHook.execute(createUserPromptContext('66666666-6666-6666-6666-666666666666'));

      expect(contextResult.exitCode).toBe(0); // Should not block
      expect(mockExecCommand).not.toHaveBeenCalled();
    });

    it('should handle execution failures independently', async () => {
      mockExecCommand.mockRejectedValue(new Error('Command failed'));

      // SessionStart hook failure
      const mapHook = new CodebaseMapHook();
      const mapResult = await mapHook.execute(createSessionStartContext('77777777-7777-7777-7777-777777777777'));

      expect(mapResult.exitCode).toBe(0); // Should not block session

      // UserPromptSubmit hook failure
      const contextHook = new CodebaseMapHook();
      const contextResult = await contextHook.execute(createUserPromptContext('88888888-8888-8888-8888-888888888888'));

      expect(contextResult.exitCode).toBe(0); // Should not block prompt
    });

    it('should handle corrupted session files gracefully', async () => {
      const sessionId = '99999999-9999-9999-9999-999999999999';

      // Mock corrupted session file
      mockFsAccess.mockResolvedValueOnce(undefined);
      mockFsReadFile.mockResolvedValueOnce('invalid json {');

      mockExecCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: 'map output', stderr: '' });

      const contextHook = new CodebaseMapHook();
      const result = await contextHook.execute(createUserPromptContext(sessionId));

      expect(result.exitCode).toBe(0);
      expect(mockExecCommand).toHaveBeenCalled(); // Should treat as new session
      expect(result.jsonResponse).toBeDefined();
      const jsonResponse = result.jsonResponse as {
        hookSpecificOutput: {
          hookEventName: string;
          additionalContext: string;
        };
      };
      expect(jsonResponse?.hookSpecificOutput?.additionalContext).toContain('📍 Codebase Map');
    });
  });

  describe('Session Management', () => {
    it('should write session files and clean up old ones', async () => {
      const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      mockExecCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: 'output', stderr: '' });

      const contextHook = new CodebaseMapHook();
      await contextHook.execute(createUserPromptContext(sessionId));

      // Wait for async cleanup to be called
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify session file was written with correct pattern
      expect(mockFsWriteFile).toHaveBeenCalledWith(
        expect.stringContaining(`codebase-map-session-${sessionId}.json`),
        expect.stringContaining('"contextProvided": true')
      );

      // Verify cleanup operations were attempted (readdir called)
      expect(mockFsReaddir).toHaveBeenCalled();
    });
  });
});
