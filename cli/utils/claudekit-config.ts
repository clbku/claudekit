import { promises as fs, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateClaudekitConfig, type ClaudekitConfig } from '../types/claudekit-config.js';

let cachedConfig: ClaudekitConfig | null = null;
let configLoaded = false;

/**
 * Asynchronously initializes the claudekit config cache.
 * Call this early (e.g., in CLI startup) to avoid blocking later.
 * After init, getHookConfig/loadClaudekitConfig return cached value synchronously.
 */
export async function initClaudekitConfig(projectRoot: string = process.cwd()): Promise<void> {
  try {
    const configPath = join(projectRoot, '.claudekit', 'config.json');
    try {
      await fs.access(configPath);
    } catch {
      cachedConfig = {};
      configLoaded = true;
      return;
    }

    const configData = await fs.readFile(configPath, 'utf-8');
    const parsedData = JSON.parse(configData);
    const validated = validateClaudekitConfig(parsedData);

    if (validated.valid && validated.data) {
      cachedConfig = validated.data;
    } else {
      cachedConfig = {};
      if (process.env['DEBUG'] === 'true') {
        console.error('Claudekit config validation errors:', validated.errors);
      }
    }
  } catch (error) {
    cachedConfig = {};
    if (process.env['DEBUG'] === 'true') {
      console.error('Failed to load claudekit config:', error);
    }
  }
  configLoaded = true;
}

/**
 * Loads and validates the claudekit configuration from .claudekit/config.json.
 * Returns cached value if initClaudekitConfig was called, otherwise reads synchronously.
 * @param projectRoot The project root directory (defaults to cwd)
 * @returns The validated configuration or empty object if not found/invalid
 */
export function loadClaudekitConfig(projectRoot: string = process.cwd()): ClaudekitConfig {
  if (configLoaded && cachedConfig !== null) {
    return cachedConfig;
  }

  // Fallback: synchronous read (blocking, but only on first call if init wasn't called)
  try {
    const configPath = join(projectRoot, '.claudekit', 'config.json');
    if (!existsSync(configPath)) {
      return {};
    }

    const configData = readFileSync(configPath, 'utf-8');
    const parsedData = JSON.parse(configData);
    const validated = validateClaudekitConfig(parsedData);

    if (validated.valid && validated.data) {
      cachedConfig = validated.data;
    }

    if (process.env['DEBUG'] === 'true' && validated.errors) {
      console.error('Claudekit config validation errors:', validated.errors);
    }
  } catch (error) {
    if (process.env['DEBUG'] === 'true') {
      console.error('Failed to load claudekit config:', error);
    }
  }

  configLoaded = true;
  return cachedConfig ?? {};
}

/**
 * Gets hook-specific configuration
 * @param hookId The hook identifier (e.g., 'self-review')
 * @param projectRoot The project root directory
 * @returns The hook configuration or undefined if not found
 */
export function getHookConfig<T = unknown>(hookId: string, projectRoot?: string): T | undefined {
  const config = loadClaudekitConfig(projectRoot);
  return config.hooks?.[hookId as keyof typeof config.hooks] as T;
}
