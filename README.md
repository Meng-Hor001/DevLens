# DevLens CLI

DevLens v0.1 scans a local repository and exports a validated project graph. Requires Node.js 20+ and pnpm.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm build
node cli/dist/index.js /path/to/next-app
node cli/dist/index.js /path/to/next-app --output /tmp/devlens.json
```

Use a new output filename each time: DevLens refuses to overwrite existing files. Without `--output`, the scan writes nothing. Output paths are relative to your current directory, not the scanned project. Prefer an output location outside that project.

The `cli` package exposes the `devlens` executable when installed. It has not been published to npm; `npx devlens` is not verified to install this implementation.

## v0.1 features

- Text-file scanning with built-in exclusions, nested `.gitignore` rules, file metadata and a 1 MiB limit.
- Languages ranked by file count (percentages rounded to one decimal).
- React, Next.js, Express, NestJS, Tailwind CSS, Redux, Prisma and Docker detection.
- Dependency declarations and versions from dependencies, devDependencies and peerDependencies, categorized by purpose. Unknown packages use `other`.
- Static imports, re-exports, literal require/dynamic import calls, relative paths and tsconfig/jsconfig aliases.
- Zod-validated project/file/dependency nodes and contains/imports/depends_on edges.
- `--help`, `--version`, `--output`, `--port`, `--no-browser`, actionable errors and exit codes.

The dependency count counts declarations across all scanned package manifests and sections. `uniqueDependencies` counts distinct declared/imported package names. Imports count distinct internal file-to-file edges; external imports create dependency edges. Node built-ins are omitted.

## Privacy and limits

Scanning is local, makes no network calls, does not execute project/config code, and does not change source files. All `.env` and `.env.*` files (including examples for v0.1) and symlinks are excluded. Source contents remain in memory and are not exported. Individual parser errors become warnings.

Binary assets and files over 1 MiB are excluded; imports targeting them can produce unresolved-local-import warnings. Only literal import specifiers can be analyzed. Compiler configs extending excluded installed packages may warn. Dependency categories are heuristic. Dashboard flags are accepted but do not start a server in this release.

## Verify

```sh
pnpm check
```

This typechecks, builds both entry points, and runs 11 automated tests. The real-project acceptance test is opt-in and skipped unless project paths are supplied:

```sh
DEVLENS_ACCEPTANCE_PROJECTS='["/path/to/app-one","/path/to/app-two","/path/to/app-three"]' pnpm check
```

That acceptance check expects 3–5 Next.js/Tailwind App Router projects with root or `src` app layouts importing `globals.css` and `StoreProvider.tsx`, matching the four projects validated here. Adapt those explicit expectations for other layouts. No projects are downloaded or modified.

See [scope completion and acceptance results](docs/scope-status.md). Later roadmap commands and the dashboard are not implemented in v0.1.

## Distribute to another Linux machine

Build an installable archive on the development machine:

```sh
pnpm package
```

Copy `release/devlens-0.1.0.tgz` to the receiving machine. With Node.js 20+ and npm installed, run from the directory containing the archive:

```sh
npm install --global ./devlens-0.1.0.tgz --prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
devlens --version
devlens /path/to/project
```

Add `export PATH="$HOME/.local/bin:$PATH"` to `~/.bashrc` (Bash) or `~/.zshrc` (Zsh) for future terminals. The receiving machine does not need pnpm, TypeScript, or the source repository. Installation downloads runtime dependencies from npm; subsequent scans remain local. This archive does not bundle Node.js.

To uninstall:

```sh
npm uninstall --global devlens --prefix "$HOME/.local"
```

Public installation by package name requires publishing under an npm package name you own. Until then, distribute the archive directly or host it as a release asset; npm also supports installation from an HTTPS tarball URL.
