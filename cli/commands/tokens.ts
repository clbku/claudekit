import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}

interface UsageData {
  input_tokens?: number;
  output_tokens?: number;
}

interface ContentBlock {
  type?: string;
  [key: string]: unknown;
}

interface TranscriptMessage {
  usage?: UsageData;
  content?: ContentBlock[];
  [key: string]: unknown;
}

interface TranscriptEntry {
  type?: string;
  message?: TranscriptMessage;
  [key: string]: unknown;
}

interface FileCandidate {
  path: string;
  mtime: number;
}

const JSONL_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

async function collectCandidates(dir: string): Promise<FileCandidate[]> {
  const candidates: FileCandidate[] = [];
  try {
    const files = await fs.readdir(dir);
    const jsonlFiles = files.filter((f) => JSONL_PATTERN.test(f));
    for (const file of jsonlFiles) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      candidates.push({ path: filePath, mtime: stat.mtime.getTime() });
    }
  } catch {
    // directory not found or not readable
  }
  return candidates;
}

async function findCurrentTranscript(): Promise<string | null> {
  const transcriptPath = process.env['CLAUDE_TRANSCRIPT_PATH'];
  if (transcriptPath !== null && transcriptPath !== undefined && transcriptPath !== '') {
    return transcriptPath;
  }

  // Try current project's encoded directory first
  const encodedProjectName = process.cwd().replace(/\//g, '-');
  const projectTranscriptDir = path.join(
    os.homedir(), '.claude', 'projects', encodedProjectName
  );
  const projectCandidates = await collectCandidates(projectTranscriptDir);
  if (projectCandidates.length > 0) {
    projectCandidates.sort((a, b) => b.mtime - a.mtime);
    return projectCandidates[0]?.path ?? null;
  }

  // Fallback: search all project directories
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const allCandidates: FileCandidate[] = [];
  try {
    const entries = await fs.readdir(claudeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        allCandidates.push(...(await collectCandidates(path.join(claudeDir, entry.name))));
      }
    }
  } catch {
    // claude projects directory not found
  }

  // Try ~/.claude/transcripts/
  const homeTranscriptsDir = path.join(os.homedir(), '.claude', 'transcripts');
  allCandidates.push(...(await collectCandidates(homeTranscriptsDir)));

  if (allCandidates.length === 0) {
    return null;
  }

  allCandidates.sort((a, b) => b.mtime - a.mtime);
  return allCandidates[0]?.path ?? null;
}

function parseTranscript(content: string): TokenUsage {
  const lines = content.split('\n').filter((line) => line.trim());
  let inputTokens = 0;
  let outputTokens = 0;
  let toolCalls = 0;

  for (const line of lines) {
    try {
      const entry: TranscriptEntry = JSON.parse(line);

      if (entry.type === 'assistant' && entry.message) {
        const usage = entry.message.usage;
        if (usage) {
          inputTokens += usage.input_tokens ?? 0;
          outputTokens += usage.output_tokens ?? 0;
        }

        if (Array.isArray(entry.message.content)) {
          for (const block of entry.message.content) {
            if (block.type === 'tool_use') {
              toolCalls++;
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return { inputTokens, outputTokens, toolCalls };
}

export async function tokens(): Promise<void> {
  const transcriptFile = await findCurrentTranscript();

  if (transcriptFile === null) {
    console.error('No transcript found. Run this command from within a Claude Code session.');
    process.exit(1);
  }

  try {
    const content = await fs.readFile(transcriptFile, 'utf-8');
    const usage = parseTranscript(content);
    console.log(`In:${usage.inputTokens} Out:${usage.outputTokens} ToolCalls:${usage.toolCalls}`);
  } catch (error) {
    console.error(
      `Failed to read transcript: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
