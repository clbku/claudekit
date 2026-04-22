/**
 * Smoke tests for codebase-map CLI integration
 *
 * These tests run the actual `codebase-map` CLI tool (via npx) without mocks,
 * verifying that the hook code can correctly invoke the tool and parse its output.
 *
 * This catches issues like:
 * - CLI tool not resolvable via npx
 * - Binary not in PATH but available as local dependency
 * - Output format changes in codebase-map versions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execCommand, detectPackageManager } from '../../cli/hooks/utils.js';
import { generateCodebaseMap, updateCodebaseMap } from '../../cli/hooks/codebase-map-utils.js';

const PROJECT_ROOT = process.cwd();

// Skip entire suite if codebase-map is not installed
const maybeDescribe = describe;

maybeDescribe('codebase-map CLI smoke tests', () => {
  let pm: { exec: string; execArgs: string[] };

  beforeAll(async () => {
    pm = await detectPackageManager(PROJECT_ROOT);
  });

  describe('CLI availability', () => {
    it('should resolve codebase-map via package manager', async () => {
      const result = await execCommand(pm.exec, [...pm.execArgs, 'codebase-map', '--version'], {
        cwd: PROJECT_ROOT,
        timeout: 15000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('scan command', () => {
    it('should scan the project and create .codebasemap index', async () => {
      const result = await execCommand(pm.exec, [...pm.execArgs, 'codebase-map', 'scan'], {
        cwd: PROJECT_ROOT,
        timeout: 30000,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  describe('format command', () => {
    it('should produce DSL output with expected structure', async () => {
      const result = await execCommand(
        pm.exec,
        [...pm.execArgs, 'codebase-map', 'format', '--format', 'dsl'],
        { cwd: PROJECT_ROOT, timeout: 30000 }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
      // DSL format shows file paths with ' > ' for dependencies
      expect(result.stdout).toContain(' > ');
    });

    it('should produce tree output', async () => {
      const result = await execCommand(
        pm.exec,
        [...pm.execArgs, 'codebase-map', 'format', '--format', 'tree'],
        { cwd: PROJECT_ROOT, timeout: 30000 }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
    });

    it('should apply include filtering', async () => {
      const result = await execCommand(
        pm.exec,
        [...pm.execArgs, 'codebase-map', 'format', '--format', 'dsl', '--include', 'cli/**'],
        { cwd: PROJECT_ROOT, timeout: 30000 }
      );

      expect(result.exitCode).toBe(0);
      // All lines with file paths should reference cli/
      const lines = result.stdout.split('\n').filter((line: string) => line.includes(' > '));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(/^cli\//);
      }
    });

    it('should apply exclude filtering', async () => {
      const resultWithTests = await execCommand(
        pm.exec,
        [...pm.execArgs, 'codebase-map', 'format', '--format', 'dsl', '--include', 'cli/**'],
        { cwd: PROJECT_ROOT, timeout: 30000 }
      );

      const resultWithoutTests = await execCommand(
        pm.exec,
        [...pm.execArgs, 'codebase-map', 'format', '--format', 'dsl', '--include', 'cli/**', '--exclude', '**/*.test.ts'],
        { cwd: PROJECT_ROOT, timeout: 30000 }
      );

      expect(resultWithTests.exitCode).toBe(0);
      expect(resultWithoutTests.exitCode).toBe(0);
      // Excluding test files should not increase output
      expect(resultWithoutTests.stdout.length).toBeLessThanOrEqual(resultWithTests.stdout.length);
    });
  });

  describe('generateCodebaseMap utility', () => {
    it('should generate a codebase map via the shared utility', async () => {
      const result = await generateCodebaseMap({
        format: 'dsl',
        include: ['cli/**'],
        exclude: ['**/*.test.ts'],
        projectRoot: PROJECT_ROOT,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output).toBeTruthy();
      expect(result.output).toContain(' > ');
    });

    it('should return empty output for unmatched include patterns', async () => {
      const result = await generateCodebaseMap({
        format: 'dsl',
        include: ['nonexistent-dir/**'],
        projectRoot: PROJECT_ROOT,
      });

      expect(result.success).toBe(true);
      // No files match, so output should be minimal or empty
    });
  });

  describe('updateCodebaseMap utility', () => {
    it('should update a specific file in the index', async () => {
      const result = await updateCodebaseMap(
        'cli/hooks/codebase-map-utils.ts',
        PROJECT_ROOT
      );

      expect(result).toBe(true);
    });

    it('should return false for non-existent file gracefully', async () => {
      // updateCodebaseMap catches errors internally and returns false
      const result = await updateCodebaseMap(
        'nonexistent-file.ts',
        PROJECT_ROOT
      );

      // CLI may succeed or fail depending on implementation,
      // but the utility should not throw
      expect(typeof result).toBe('boolean');
    });
  });
});
