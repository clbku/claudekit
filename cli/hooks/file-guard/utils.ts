/**
 * Shared utilities for file-guard service classes
 */

import * as path from 'node:path';
import picomatch from 'picomatch';

/**
 * Convert a glob pattern to a RegExp using picomatch.
 * Handles all standard glob syntax: *, **, ?, [abc], {a,b}, negation, etc.
 */
export const globToRegExp = (glob: string, options?: Record<string, unknown>): RegExp => {
  const flags = (options?.['flags'] as string) || '';
  const re = picomatch.makeRe(glob, {
    ...(options ?? {}),
  });
  // picomatch.makeRe returns a RegExp with its own flags; re-apply user flags if needed
  if (flags && re.flags !== flags) {
    return new RegExp(re.source, flags);
  }
  return re;
};

/**
 * Expand ~ to home directory path
 */
export const untildify = (str: string): string => {
  if (str.startsWith('~')) {
    const home = process.env['HOME'];
    if (home !== null && home !== undefined && home !== '') {
      return path.join(home, str.slice(1));
    }
  }
  return str;
};