---
description: OWASP Top 10 security audit - dependency scanning, vulnerability detection, and secure coding analysis
allowed-tools: Task, Read, Bash(git:*), Bash(npm audit:*), Bash(npm outdated:*), Bash(npx snyk:*), Bash(grep:*), Bash(find:*), Bash(ls:*), Bash(cat:*), Bash(head:*), Bash(wc:*)
argument-hint: '[scope] - e.g., "recent changes", "src/api", "*.ts files", "dependencies"'
---

# Security Review

## Current Repository State

!`git --no-pager log --oneline -5 && echo "---" && git status --short`

## Phase 1: Dependency Audit

First, check for known vulnerabilities in dependencies:

```bash
!`npm audit --json 2>/dev/null | head -80`
!`npm outdated 2>/dev/null | head -20`
```

If `npm audit` reports vulnerabilities, categorize them:
- **Critical/High**: Must fix before merging
- **Moderate**: Should fix, document exceptions
- **Low**: Note for future cleanup

## Phase 2: Determine Review Scope

Based on **$ARGUMENTS**:

- **No arguments or "full"**: Scan entire codebase for security issues
- **"recent changes" or "diff"**: Analyze only files changed in recent commits (use `git diff`)
- **Specific directory/file**: Focus scan on that scope
- **"dependencies" or "deps"**: Focus only on dependency vulnerabilities

If scope is "recent changes" or "diff":
```bash
!`git --no-pager diff --name-only HEAD~5..HEAD 2>/dev/null || git --no-pager diff --name-only --cached`
```

## Phase 3: Security Analysis

Launch the `security-expert` agent with appropriate scope and context:

```
Subagent: security-expert
Description: OWASP Top 10 security audit
Prompt: Perform a comprehensive OWASP Top 10 security audit on: $ARGUMENTS

CONTEXT:
- Dependency audit results from Phase 1 above
- Repository state and recent changes from Phase 2

INSTRUCTIONS:
1. Run dependency audit commands (npm audit, npm outdated) if not already done
2. Scan code patterns for OWASP Top 10 vulnerabilities:
   - A01: Broken Access Control
   - A02: Cryptographic Failures
   - A03: Injection (SQL, Command, NoSQL, Template, Path Traversal)
   - A04: Insecure Design
   - A05: Security Misconfiguration
   - A06: Vulnerable and Outdated Components
   - A07: Authentication Failures
   - A08: Software and Data Integrity Failures
   - A09: Security Logging Failures
   - A10: Server-Side Request Forgery (SSRF)
3. Check for additional patterns: XSS, CSRF, file upload issues, prototype pollution
4. Review configuration files for security misconfigurations
5. Analyze authentication/authorization implementation

SEVERITY GUIDELINES:
- Only report findings with >80% confidence of exploitability
- Provide concrete exploit scenarios, not theoretical risks
- Include file path and line number for every finding
- Classify as Critical (P0), High (P1), Medium (P2), or Low (P3)

OUTPUT FORMAT:
Structure findings as a Security Audit Report with:
- Executive Summary (findings count by severity)
- Dependency Audit table
- Each finding with: File, Category, Description, Exploit Scenario, Evidence, Remediation
- Secure Coding Recommendations
```

## Phase 4: Consolidate Report

After the agent completes, consolidate the security audit into this format:

```
🔒 Security Audit Report

## Executive Summary
Security posture: [Assessment]
Findings: [X Critical, Y High, Z Medium, W Low]
Scope: [what was reviewed]

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| Critical | ... | ... | ... |

## Code Vulnerabilities

### 🔴 Critical
1. **[OWASP Category] Finding Title**
   - File: `path:line`
   - Exploit: [scenario]
   - Fix: [recommendation with code]

### 🟠 High
...

### 🟡 Medium
...

## Security Score
┌──────────────────────────┬───────┬─────────────────────┐
│ Category                 │ Score │ Status              │
├──────────────────────────┼───────┼─────────────────────┤
│ Dependency Security      │ X/10  │ [notes]             │
│ Input Validation         │ X/10  │ [notes]             │
│ Authentication           │ X/10  │ [notes]             │
│ Cryptography             │ X/10  │ [notes]             │
│ Configuration            │ X/10  │ [notes]             │
│ Access Control           │ X/10  │ [notes]             │
│ Logging & Monitoring     │ X/10  │ [notes]             │
└──────────────────────────┴───────┴─────────────────────┘

## Recommendations
1. [Priority action items]
```

If no vulnerabilities are found, report:
```
🔒 Security Audit Report - No Issues Found

✅ No security vulnerabilities detected in [scope].
✅ Dependency audit passed.
✅ OWASP Top 10 scan clean.
```
