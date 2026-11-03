import { cp, mkdir, rm } from 'node:fs/promises';
for (const target of ['cli/dist/web', 'dist/web']) {
  // Remove assets from previous builds so releases contain only the current dashboard.
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp('apps/web/dist', target, { recursive: true });
}
