/**
 * Security Scan Hook
 * Scans changed files for common security anti-patterns:
 * - Hardcoded secrets and credentials
 * - Command injection vectors
 * - Weak cryptographic usage
 * - Path traversal patterns
 * - Insecure deserialization
 * - SQL injection patterns
 */

import type { HookContext, HookResult } from './base.js';
import { BaseHook } from './base.js';

interface SecurityFinding {
  line: number;
  code: string;
  rule: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
}

// Rules that check original code (catch content inside string literals)
const CONTENT_RULES: Array<{
  pattern: RegExp;
  rule: string;
  severity: SecurityFinding['severity'];
  description: string;
}> = [
  // Hardcoded secrets - must check original code since values are in string literals
  {
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/i,
    rule: 'hardcoded-password',
    severity: 'critical',
    description: 'Hardcoded password detected',
  },
  {
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    rule: 'hardcoded-api-key',
    severity: 'critical',
    description: 'Hardcoded API key detected',
  },
  {
    pattern: /(?:secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    rule: 'hardcoded-secret',
    severity: 'critical',
    description: 'Hardcoded secret/token detected',
  },
  {
    pattern: /(?:private[_-]?key)\s*[:=]\s*['"]-----BEGIN/i,
    rule: 'hardcoded-private-key',
    severity: 'critical',
    description: 'Hardcoded private key detected',
  },
  // Weak crypto (algorithm names are string literals)
  {
    pattern: /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/,
    rule: 'weak-hash',
    severity: 'high',
    description: 'Weak hash algorithm (MD5/SHA1) used for cryptographic purpose',
  },
  {
    pattern: /createCipheriv\s*\(\s*['"](?:aes-128|des|rc4|bf)['"]/i,
    rule: 'weak-cipher',
    severity: 'high',
    description: 'Weak cipher algorithm detected',
  },
];

// Rules that check cleaned code (strings/comments removed to avoid false positives)
const CODE_RULES: Array<{
  pattern: RegExp;
  rule: string;
  severity: SecurityFinding['severity'];
  description: string;
}> = [
  // Command injection
  {
    pattern: /(?:exec|execSync|spawn)\s*\(\s*(?:`[^`]*\$\{|["'][^"']*\+|["'][^"']*\$\{)/,
    rule: 'command-injection',
    severity: 'critical',
    description: 'Potential command injection via string interpolation/concatenation in exec/spawn',
  },
  // Insecure deserialization
  {
    pattern: /new\s+Function\s*\(|(?<!\.)eval\s*\(/,
    rule: 'code-injection',
    severity: 'critical',
    description: 'Potential code injection via eval() or new Function()',
  },
  // SQL injection patterns
  {
    pattern: /(?:query|execute|raw)\s*\(\s*(?:`[^`]*\$\{|["'][^"']*\+|["'][^"']*\$\{)/,
    rule: 'sql-injection',
    severity: 'high',
    description: 'Potential SQL injection via string interpolation/concatenation',
  },
  // Path traversal
  {
    pattern: /(?:readFile|writeFile|createReadStream|createWriteStream)\s*\(\s*(?:`[^`]*\$\{|req\.|params\.|query\.|body\.)/,
    rule: 'path-traversal',
    severity: 'high',
    description: 'Potential path traversal via user-controlled input in file operations',
  },
  // Disabled TLS verification
  {
    pattern: /rejectUnauthorized\s*:\s*false/,
    rule: 'tls-bypass',
    severity: 'high',
    description: 'TLS certificate verification disabled (rejectUnauthorized: false)',
  },
];

// File extensions to scan
const SCAN_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.rb', '.go', '.rs',
  '.java', '.php',
];

// Patterns that indicate test/example files (skip these)
const SKIP_PATTERNS = [
  /\.test\./i,
  /\.spec\./i,
  /\/test\//i,
  /\/tests?\//i,
  /\/__tests__\//i,
  /\/__mocks__\//i,
  /\/fixtures\//i,
  /\.example\./i,
  /\.sample\./i,
  /\.d\.ts$/i,
];

export class SecurityScanHook extends BaseHook {
  name = 'security-scan';

  static metadata = {
    id: 'security-scan',
    displayName: 'Security Pattern Scanner',
    description: 'Scans changed files for security anti-patterns (hardcoded secrets, injection, weak crypto)',
    category: 'validation' as const,
    triggerEvent: 'PostToolUse' as const,
    matcher: 'Write|Edit|MultiEdit',
  };

  async execute(context: HookContext): Promise<HookResult> {
    const { filePath } = context;

    if (this.shouldSkipFile(filePath, SCAN_EXTENSIONS)) {
      return { exitCode: 0 };
    }

    if (filePath === undefined) {
      return { exitCode: 0 };
    }

    // Skip test and example files
    if (SKIP_PATTERNS.some(pattern => pattern.test(filePath))) {
      return { exitCode: 0 };
    }

    this.progress(`🔒 Security scanning ${filePath}`);

    const content = await this.readFile(filePath);
    if (content === '') {
      return { exitCode: 0 };
    }

    const findings = this.scanContent(content);

    if (findings.length === 0) {
      this.success('No security issues detected');
      return { exitCode: 0 };
    }

    // Report findings grouped by severity
    const critical = findings.filter(f => f.severity === 'critical');
    const high = findings.filter(f => f.severity === 'high');
    const medium = findings.filter(f => f.severity === 'medium');

    const details = [
      ...critical.map(f => `🔴 L${f.line}: [${f.rule}] ${f.description}\n   ${f.code}`),
      ...high.map(f => `🟠 L${f.line}: [${f.rule}] ${f.description}\n   ${f.code}`),
      ...medium.map(f => `🟡 L${f.line}: [${f.rule}] ${f.description}\n   ${f.code}`),
    ].join('\n\n');

    // Block on critical findings, warn on high/medium
    if (critical.length > 0) {
      this.error(
        `Security: ${critical.length} critical issue${critical.length > 1 ? 's' : ''} detected`,
        details,
        [
          'Remove hardcoded secrets — use environment variables instead',
          'Use parameterized queries for database operations',
          'Replace eval()/new Function() with safer alternatives',
          'Use child_process.execFile() instead of exec() for user input',
        ]
      );
      return { exitCode: 2 };
    }

    // Warn but don't block for high/medium
    const totalHigh = high.length;
    const totalMedium = medium.length;
    this.warning(
      `Security: ${totalHigh} high, ${totalMedium} medium issue${(totalHigh + totalMedium) > 1 ? 's' : ''} found:\n\n${details}`
    );
    return { exitCode: 0 };
  }

  private scanContent(content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const originalLines = content.split('\n');

    // Phase 1: Check original lines for content-based rules (hardcoded secrets)
    for (let i = 0; i < originalLines.length; i++) {
      const line = originalLines[i];
      if (line === undefined || line === '') { continue; }

      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      for (const rule of CONTENT_RULES) {
        if (rule.pattern.test(line)) {
          findings.push({
            line: i + 1,
            code: trimmed,
            rule: rule.rule,
            severity: rule.severity,
            description: rule.description,
          });
        }
      }
    }

    // Phase 2: Check cleaned lines for code-structure rules (injection, eval, etc.)
    const cleanedContent = this.removeStringsAndComments(content);
    const cleanedLines = cleanedContent.split('\n');

    for (let i = 0; i < cleanedLines.length; i++) {
      const cleanedLine = cleanedLines[i];
      const originalLine = originalLines[i];

      if (cleanedLine === undefined || originalLine === undefined || originalLine === '') {
        continue;
      }

      const trimmed = originalLine.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      for (const rule of CODE_RULES) {
        if (rule.pattern.test(cleanedLine)) {
          // Avoid duplicate findings on the same line
          const alreadyFound = findings.some(f => f.line === i + 1 && f.rule === rule.rule);
          if (!alreadyFound) {
            findings.push({
              line: i + 1,
              code: trimmed,
              rule: rule.rule,
              severity: rule.severity,
              description: rule.description,
            });
          }
        }
      }
    }

    return findings;
  }

  private removeStringsAndComments(content: string): string {
    let result = '';
    let i = 0;

    while (i < content.length) {
      const char = content[i];
      const nextChar = content[i + 1];

      // Single line comments
      if (char === '/' && nextChar === '/') {
        const endOfLine = content.indexOf('\n', i);
        if (endOfLine === -1) {
          result += ' '.repeat(content.length - i);
          break;
        }
        result += `${' '.repeat(endOfLine - i)}\n`;
        i = endOfLine + 1;
        continue;
      }

      // Multi-line comments
      if (char === '/' && nextChar === '*') {
        const endComment = content.indexOf('*/', i + 2);
        if (endComment === -1) {
          result += ' '.repeat(content.length - i);
          break;
        }
        const commentContent = content.substring(i, endComment + 2);
        result += commentContent.replace(/[^\n]/g, ' ');
        i = endComment + 2;
        continue;
      }

      // String literals
      if (char === '"' || char === "'" || char === '`') {
        const quote = char;
        result += ' ';
        i++;
        while (i < content.length) {
          const current = content[i];
          if (current === '\\') {
            result += '  ';
            i += 2;
          } else if (current === quote) {
            result += ' ';
            i++;
            break;
          } else if (current === '\n') {
            result += '\n';
            i++;
          } else {
            result += ' ';
            i++;
          }
        }
        continue;
      }

      result += char;
      i++;
    }

    return result;
  }
}
