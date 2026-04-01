import { Logger } from '../utils/logger.js';
import { createProgressReporter } from '../utils/progress.js';
import * as path from 'node:path';
import fs from 'fs-extra';

interface AddOptions {
  template?: string;
  path?: string;
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
}

/**
 * Add a new command to the project
 */
export async function add(type: string, name: string, options: AddOptions = {}): Promise<void> {
  const logger = new Logger();
  const progressReporter = createProgressReporter({
    quiet: options.quiet,
    verbose: options.verbose,
  });

  if (options.verbose === true) {
    logger.setLevel('debug');
  } else if (options.quiet === true) {
    logger.setLevel('error');
  }

  logger.debug(`Adding ${type} "${name}" with options:`, options);

  try {
    progressReporter.start(`Adding ${type} "${name}"...`);

    // Validate type
    if (type !== 'command') {
      throw new Error(
        `Invalid type "${type}". Only 'command' is supported (hooks are now embedded in claudekit).`
      );
    }

    // Validate name doesn't contain path separators
    if (name.includes('/') || name.includes('\\')) {
      throw new Error('Name must not contain path separators');
    }

    // Determine target directory
    const targetDir = '.claude/commands';
    const targetPath =
      options.path !== undefined && options.path !== ''
        ? options.path
        : path.join(targetDir, `${name}.md`);

    // Validate path is within target directory
    const resolvedPath = path.resolve(targetPath);
    const resolvedTargetDir = path.resolve(targetDir);
    if (!resolvedPath.startsWith(resolvedTargetDir + path.sep) && resolvedPath !== resolvedTargetDir) {
      console.error(`Error: Path must be within ${targetDir}`);
      process.exit(1);
    }

    logger.debug(`Target path: ${targetPath}`);

    // Check if file already exists
    progressReporter.update('Checking for existing files...');
    if (await fs.pathExists(targetPath)) {
      throw new Error(`${type} "${name}" already exists at ${targetPath}`);
    }

    // Create directory if needed
    progressReporter.update('Creating directory structure...');
    await fs.ensureDir(path.dirname(targetPath));

    // Create file based on template
    progressReporter.update(`Generating command template...`);
    const content = generateCommandTemplate(name, options.template);

    progressReporter.update(`Writing ${type} file...`);
    await fs.writeFile(targetPath, content, 'utf8');

    progressReporter.succeed(`Successfully added ${type} "${name}"`);
  } catch (error) {
    progressReporter.fail(`Failed to add ${type} "${name}"`);
    throw error;
  }
}

// Hook template function removed - hooks are now embedded

function generateCommandTemplate(name: string, _template?: string): string {
  // Basic command template
  // TODO: Implement template support
  return `---
description: ${name} command
allowed-tools: Read, Bash
---

# ${name}

Describe what this command does here.

## Usage

\`\`\`
/claudekit ${name} [arguments]
\`\`\`

## Steps

1. First, do this...
2. Then, do that...
3. Finally, report results...

## Arguments

- \`$ARGUMENTS\`: User-provided arguments

## Example

\`\`\`
/claudekit ${name} example-argument
\`\`\`
`;
}
