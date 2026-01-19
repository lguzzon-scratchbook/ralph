#!/usr/bin/env node
// Ralph Wiggum - Long-running AI agent loop
// Usage: node ralph.js [max_iterations]

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAX_ITERATIONS = parseInt(process.argv[2], 10) || 10;
const PROJECT_DIR = process.cwd();
const PRD_FILE = path.join(PROJECT_DIR, 'prd.json');
const PROGRESS_FILE = path.join(PROJECT_DIR, 'progress.txt');
const ARCHIVE_DIR = path.join(PROJECT_DIR, '.ralph-archive');
const LAST_BRANCH_FILE = path.join(PROJECT_DIR, '.ralph-last-branch');
const SCRIPT_DIR = path.dirname(__filename);
const PROMPT_FILE = path.join(SCRIPT_DIR, 'prompt.md');

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function getBranchName() {
  try {
    if (fs.existsSync(PRD_FILE)) {
      const content = fs.readFileSync(PRD_FILE, 'utf8');
      const prd = JSON.parse(content);
      return prd.branchName || '';
    }
  } catch (e) {
    // Ignore errors
  }
  return '';
}

function archivePreviousRun(currentBranch, lastBranch) {
  const date = new Date().toISOString().split('T')[0];
  const folderName = lastBranch.replace(/^ralph\//, '');
  const archiveFolder = path.join(ARCHIVE_DIR, `${date}-${folderName}`);

  console.log(`Archiving previous run: ${lastBranch}`);
  fs.mkdirSync(archiveFolder, { recursive: true });

  if (fs.existsSync(PRD_FILE)) {
    fs.copyFileSync(PRD_FILE, path.join(archiveFolder, 'prd.json'));
  }
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.copyFileSync(PROGRESS_FILE, path.join(archiveFolder, 'progress.txt'));
  }
  console.log(`   Archived to: ${archiveFolder}`);

  fs.writeFileSync(PROGRESS_FILE, `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`);
}

function initProgressFile() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n---\n`);
  }
}

async function runDroidExec() {
  return new Promise((resolve) => {
    const child = spawn('droid', ['exec', '--skip-permissions-unsafe', '-f', PROMPT_FILE, '--output-format', 'text'], {
      cwd: PROJECT_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({ output: stdout + stderr, code });
    });

    child.on('error', (err) => {
      resolve({ output: stderr + err.message, code: 1 });
    });
  });
}

async function main() {
  // Archive previous run if branch changed
  if (fs.existsSync(PRD_FILE) && fs.existsSync(LAST_BRANCH_FILE)) {
    const currentBranch = getBranchName();
    const lastBranch = fs.readFileSync(LAST_BRANCH_FILE, 'utf8').trim();

    if (currentBranch && lastBranch && currentBranch !== lastBranch) {
      archivePreviousRun(currentBranch, lastBranch);
    }
  }

  // Track current branch
  const currentBranch = getBranchName();
  if (currentBranch) {
    fs.writeFileSync(LAST_BRANCH_FILE, currentBranch);
  }

  // Initialize progress file if it doesn't exist
  initProgressFile();

  console.log(`Starting Ralph - Max iterations: ${MAX_ITERATIONS}`);

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Ralph Iteration ${i} of ${MAX_ITERATIONS}`);
    console.log('═══════════════════════════════════════════════════════');

    const { output } = await runDroidExec();

    if (output.includes('<promise>COMPLETE</promise>')) {
      console.log('');
      console.log('Ralph completed all tasks!');
      console.log(`Completed at iteration ${i} of ${MAX_ITERATIONS}`);
      process.exit(0);
    }

    console.log(`Iteration ${i} complete. Continuing...`);
    await sleep(2);
  }

  console.log('');
  console.log(`Ralph reached max iterations (${MAX_ITERATIONS}) without completing all tasks.`);
  console.log(`Check ${PROGRESS_FILE} for status.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
