import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Logger } from '../utils/logger.js';
import { findComponentsDirectory } from '../lib/paths.js';
import {
  copyFileWithBackup,
  needsUpdate,
  pathExists,
  safeRemove,
} from '../lib/filesystem.js';

interface SyncOptions {
  dryRun?: boolean;
  project?: string;
  verbose?: boolean;
  quiet?: boolean;
}

interface SyncResult {
  updated: string[];
  removed: string[];
  unchanged: number;
}

async function scanMarkdownFiles(dir: string, baseDir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  if (!(await pathExists(dir))) {
    return files;
  }

  async function scan(current: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      // Handle symlinks — readdir withFileTypes reports symlinks separately
      if (entry.isSymbolicLink()) {
        // Follow symlink to check if it resolves to a file
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            const relative = path.relative(baseDir, fullPath);
            files.set(relative, fullPath);
          } else if (stat.isDirectory()) {
            await scan(fullPath);
          }
        } catch {
          // Broken symlink — skip
        }
      } else if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const relative = path.relative(baseDir, fullPath);
        files.set(relative, fullPath);
      }
    }
  }

  await scan(dir);
  return files;
}

function formatPath(relPath: string): string {
  const dir = path.dirname(relPath);
  const name = path.basename(relPath, '.md');
  if (dir === '.') {
    return name;
  }
  return `${dir}/${name}`;
}

async function hasFrontmatter(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.trimStart().startsWith('---');
  } catch {
    return false;
  }
}

export async function sync(options: SyncOptions = {}): Promise<void> {
  const logger = new Logger();

  if (options.verbose === true) {
    logger.setLevel('debug');
  } else if (options.quiet === true) {
    logger.setLevel('error');
  }

  const projectDir = path.resolve(options.project ?? process.cwd());
  const claudeDir = path.join(projectDir, '.claude');

  if (!(await pathExists(claudeDir))) {
    logger.error('No .claude directory found. Run "claudekit setup" first.');
    process.exit(1);
  }

  let srcDir: string;
  try {
    srcDir = await findComponentsDirectory();
  } catch {
    logger.error('Could not locate claudekit components. Is claudekit installed?');
    process.exit(1);
  }

  logger.info('Syncing project components...\n');

  const result: SyncResult = {
    updated: [],
    removed: [],
    unchanged: 0,
  };

  for (const componentType of ['commands', 'agents'] as const) {
    const sourceDir = path.join(srcDir, componentType);
    const installedDir = path.join(claudeDir, componentType);

    const sourceFiles = await scanMarkdownFiles(sourceDir, sourceDir);
    const installedFiles = await scanMarkdownFiles(installedDir, installedDir);

    // Only update files that are already installed — do NOT add new ones
    for (const [relPath, instPath] of installedFiles) {
      const srcPath = sourceFiles.get(relPath);

      if (srcPath === undefined) {
        // Installed file no longer exists in source — candidate for removal
        const isComponent = await hasFrontmatter(instPath);
        if (!isComponent) {
          logger.debug(`  Skipping removal of non-component file: ${relPath}`);
          continue;
        }

        if (options.dryRun === true) {
          logger.info(`  - ${componentType}/${formatPath(relPath).padEnd(30)} (removed)`);
          result.removed.push(`${componentType}/${relPath}`);
        } else {
          try {
            await safeRemove(instPath);
            logger.info(`  - ${componentType}/${formatPath(relPath).padEnd(30)} (removed)`);
            result.removed.push(`${componentType}/${relPath}`);
          } catch (error) {
            logger.error(
              `  ✗ Failed to remove ${componentType}/${relPath}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
        continue;
      }

      // Both exist — check if content changed
      const hasChanges = await needsUpdate(srcPath, instPath);
      if (hasChanges) {
        if (options.dryRun === true) {
          logger.info(`  ~ ${componentType}/${formatPath(relPath).padEnd(30)} (updated)`);
          result.updated.push(`${componentType}/${relPath}`);
        } else {
          try {
            await copyFileWithBackup(srcPath, instPath);
            logger.info(`  ~ ${componentType}/${formatPath(relPath).padEnd(30)} (updated)`);
            result.updated.push(`${componentType}/${relPath}`);
          } catch (error) {
            logger.error(
              `  ✗ Failed to update ${componentType}/${relPath}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      } else {
        result.unchanged++;
      }
    }
  }

  const totalChanges = result.updated.length + result.removed.length;

  logger.info('');
  if (totalChanges === 0) {
    logger.info(`All components are up to date (${result.unchanged} unchanged).`);
  } else {
    logger.info(
      `Done! ${result.updated.length} updated, ${result.removed.length} removed, ${result.unchanged} unchanged.`
    );
  }

  if (options.dryRun === true && totalChanges > 0) {
    logger.info('\n(Dry run — no changes were made)');
  }

  if (result.updated.length > 0 || result.removed.length > 0) {
    logger.info("\nTo add new components, run 'claudekit setup' or 'claudekit add'.");
  }
}
