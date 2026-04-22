import { Logger } from '../utils/logger.js';
import { execCommand } from '../hooks/utils.js';

async function getCurrentVersion(): Promise<string> {
  // Try reading from claudekit's own package.json
  try {
    const result = await execCommand('claudekit', ['--version'], { timeout: 5000 });
    if (result.exitCode === 0) {
      return result.stdout.trim();
    }
  } catch {
    // Fallback: try reading package.json directly
  }

  // Fallback: read package.json from the installed location
  try {
    const result = await execCommand('npm', ['list', '-g', 'claudekit-dev', '--json', '--depth=0'], {
      timeout: 10000,
    });
    if (result.exitCode === 0) {
      const data = JSON.parse(result.stdout) as { dependencies?: Record<string, { version: string }> };
      const dep = data.dependencies?.['claudekit-dev'];
      if (dep) {
        return dep.version;
      }
    }
  } catch {
    // Final fallback
  }

  throw new Error('Could not determine current claudekit version');
}

interface UpgradeOptions {
  check?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
}

function parseSemver(version: string): [number, number, number] {
  const cleaned = version.replace(/^v/, '');
  const parts = cleaned.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareVersions(current: string, latest: string): -1 | 0 | 1 {
  const [cMajor, cMinor, cPatch] = parseSemver(current);
  const [lMajor, lMinor, lPatch] = parseSemver(latest);

  if (cMajor !== lMajor) {
    return cMajor < lMajor ? -1 : 1;
  }
  if (cMinor !== lMinor) {
    return cMinor < lMinor ? -1 : 1;
  }
  if (cPatch !== lPatch) {
    return cPatch < lPatch ? -1 : 1;
  }
  return 0;
}

async function getLatestVersion(): Promise<string> {
  const result = await execCommand('npm', ['view', 'claudekit-dev', 'version'], {
    timeout: 15000,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to fetch latest version from npm.\n${result.stderr}`.trim()
    );
  }

  const version = result.stdout.trim();
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`Unexpected version format from npm: ${version}`);
  }
  return version;
}

async function getGlobalInstallCommand(): Promise<string[]> {
  const managers = ['pnpm', 'yarn', 'npm'] as const;
  for (const manager of managers) {
    try {
      const result = await execCommand(manager, ['--version'], { timeout: 5000 });
      if (result.exitCode === 0) {
        switch (manager) {
          case 'pnpm':
            return ['pnpm', 'add', '-g', 'claudekit-dev@latest'];
          case 'yarn':
            return ['yarn', 'global', 'add', 'claudekit-dev@latest'];
          case 'npm':
            return ['npm', 'install', '-g', 'claudekit-dev@latest'];
        }
      }
    } catch {
      continue;
    }
  }
  return ['npm', 'install', '-g', 'claudekit-dev@latest'];
}

export async function upgrade(options: UpgradeOptions = {}): Promise<void> {
  const logger = new Logger();

  if (options.verbose === true) {
    logger.setLevel('debug');
  } else if (options.quiet === true) {
    logger.setLevel('error');
  }

  const currentVersion = await getCurrentVersion();

  logger.info('Checking for updates...');

  let latestVersion: string;
  try {
    latestVersion = await getLatestVersion();
  } catch (error) {
    logger.error(
      `Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`
    );
    logger.info('Check your internet connection and try again.');
    process.exit(1);
  }

  const comparison = compareVersions(currentVersion, latestVersion);

  if (comparison === 0) {
    logger.info(`Already up to date (v${currentVersion})`);
    return;
  }

  if (comparison > 0) {
    logger.info(`Current (v${currentVersion}) is newer than npm latest (v${latestVersion})`);
    return;
  }

  // Newer version available
  logger.info(`Current: v${currentVersion} → Latest: v${latestVersion}`);

  if (options.check === true) {
    logger.info(`Update available! Run 'claudekit upgrade' to install.`);
    process.exit(1);
  }

  if (options.dryRun === true) {
    logger.info('Dry run mode: would upgrade via package manager');
    return;
  }

  const installCmd = await getGlobalInstallCommand();
  const cmd = installCmd[0] ?? 'npm';
  const args = installCmd.slice(1);
  logger.info(`Upgrading via ${cmd}...`);

  try {
    const result = await execCommand(cmd, args, {
      timeout: 120_000,
    });

    if (result.exitCode !== 0) {
      logger.error(`Upgrade failed:\n${result.stderr}`.trim());
      logger.info('Try running manually: npm install -g claudekit-dev');
      process.exit(1);
    }

    logger.success(`Successfully upgraded to v${latestVersion}!`);
    logger.info("Run 'claudekit sync' to update your project components.");
  } catch (error) {
    logger.error(
      `Upgrade failed: ${error instanceof Error ? error.message : String(error)}`
    );
    logger.info('Try running manually: npm install -g claudekit-dev');
    process.exit(1);
  }
}

export { compareVersions, parseSemver };
