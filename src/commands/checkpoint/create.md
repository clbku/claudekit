---
description: Create a git stash checkpoint with optional description
category: workflow
allowed-tools: Bash(git stash:*), Bash(git add:*), Bash(git status:*)
argument-hint: "[optional description]"
---

## Create a checkpoint

Create a git stash checkpoint to save your current working state.

## Current status
!`git status --short`

## Task

Create a git stash checkpoint while keeping all current changes in the working directory. Steps:

1. If no description provided in $ARGUMENTS, use current timestamp as "YYYY-MM-DD HH:MM:SS"
2. Collect changed/untracked files and exclude sensitive files:
   - Get all changed files: `git status --porcelain`
   - Parse each line (format: `XY filename`), extract the filename (skip first 3 characters)
   - Exclude files matching sensitive patterns: `.env`, `*.pem`, `*.key`, `credentials.*`, `secrets.*`, `**/id_rsa*`, `.aws/**`, `.ssh/**`, `*.token`, `*.p12`, `*.pfx`, `.netrc`, `.git-credentials`, `token.*`, `secrets.*`, `api-keys.*`, `*.gpg`, `*.keystore`, `wallet.*`, `seed.txt`, and similar credential/key/secret files
   - If only sensitive files changed (no safe files remain), inform the user and stop
3. Create a stash object without modifying the working directory:
   - Stage only the safe files: `git add -- <safe-file-list>`
   - Create the stash object: `git stash create "claude-checkpoint: $ARGUMENTS"`
   - This returns a commit SHA that we need to capture
4. Store the stash object in the stash list:
   - `git stash store -m "claude-checkpoint: $ARGUMENTS" <SHA>`
5. Reset the index to unstage files: `git reset`
6. Confirm the checkpoint was created and show what was saved (and note any files that were excluded)

Note: Using `git stash create` + `git stash store` creates a checkpoint without touching your working directory. Sensitive files (credentials, keys, secrets) are automatically excluded from checkpoints for security.

Example: If user runs `/checkpoint before major refactor`, it creates a stash checkpoint while leaving all your files exactly as they are.