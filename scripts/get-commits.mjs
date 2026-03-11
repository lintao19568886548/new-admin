#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_START_COMMIT = 'ad55a3cc97c9936bb6a24ed5fae96ca552535aa8';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_FILE = resolve(SCRIPT_DIR, 'commit_log.txt');

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT_FILE,
    start: DEFAULT_START_COMMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--') {
      continue;
    }

    if (arg === '--start' || arg === '--from') {
      if (!next) {
        throw new Error(`${arg} requires a value.`);
      }
      options.start = next;
      index += 1;
      continue;
    }

    if (arg === '--output' || arg === '--out') {
      if (!next) {
        throw new Error(`${arg} requires a value.`);
      }
      options.output = resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log(
    'Usage: node scripts/get-commits.mjs [--start <commit>] [--output <path>]',
  );
  console.log('');
  console.log(`Defaults:`);
  console.log(`  --start  ${DEFAULT_START_COMMIT}`);
  console.log(`  --output ${DEFAULT_OUTPUT_FILE}`);
}

function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    return;
  }

  const range = `${options.start}^..HEAD`;
  const gitArgs = [
    'log',
    '--no-merges',
    range,
    '--pretty=format:* %h %s (%an, %ar)%n%n%b%n==================================================%n',
  ];

  console.log(`Generating commit log and writing to ${options.output}...`);
  console.log('-------------------------------------------------');

  const result = spawnSync('git', gitArgs, { encoding: 'utf8' });

  if (result.error) {
    console.error('');
    console.error('ERROR: Failed to execute git command.');
    console.error('----------------- ERROR -----------------');
    console.error(result.error.message);
    console.error('-----------------------------------------');
    process.exit(1);
  }

  if (result.status === 0) {
    writeFileSync(options.output, result.stdout ?? '', { encoding: 'utf8' });
    console.log(`Successfully generated commit log at: ${options.output}`);
  } else {
    console.error('');
    console.error('ERROR: Git command failed. See details below.');
    console.error('----------------- GIT OUTPUT -----------------');
    if (result.stderr) {
      console.error(result.stderr.trimEnd());
    }
    if (!result.stderr && result.stdout) {
      console.error(result.stdout.trimEnd());
    }
    console.error('----------------------------------------------');
    process.exit(result.status ?? 1);
  }

  console.log('-------------------------------------------------');
  console.log('Done.');
}

main();
