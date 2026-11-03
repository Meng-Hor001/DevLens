#!/usr/bin/env node
import { runCli } from './command.js';

runCli(process.argv.slice(2)).catch((error: NodeJS.ErrnoException) => {
  const message = error.code === 'ENOENT' ? 'Project or output parent directory does not exist.' : error.code === 'EEXIST' ? 'Output already exists. Choose a new filename; DevLens never overwrites files.' : error.code === 'EACCES' ? 'Permission denied reading the project or writing the output.' : error.message;
  console.error(`\nDevLens: ${message}`.replace(/[\x00-\x1f\x7f-\x9f]/g, '')); process.exitCode = 1;
});
