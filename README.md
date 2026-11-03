# DevLens CLI

DevLens v0.2 scans a local repository, opens an interactive terminal dashboard, and optionally exports a validated project graph. Runs on Windows, Linux and macOS with Node.js 20+. Building from source also requires pnpm.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm build
node cli/dist/index.js /path/to/next-app
node cli/dist/index.js /path/to/next-app --output /tmp/devlens.json
```

Use a new output filename each time: DevLens refuses to overwrite existing files. Without `--output`, the scan writes nothing. Output paths are relative to your current directory, not the scanned project. Prefer an output location outside that project.

The `cli` package exposes the `devlens` executable when installed. It has not been published to npm; `npx devlens` is not verified to install this implementation.

## One-command installation

Requires Node.js 20+ and npm; no npm publication is needed. The public latest release checked on November 3, 2026 is **v0.1.0**. Publish the v0.2.0 release below before using these URLs to install the new terminal tables. Until then, install the local v0.2.0 archive using the commands in “Distribute to another machine”.

**macOS / Linux:**

```sh
curl -fsSL https://github.com/Meng-Hor001/DevLens/releases/latest/download/install.sh | sh
```

The installer uses `~/.local` without sudo. If `~/.local/bin` is not on your PATH, add `export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc` or `~/.bashrc` and reopen your terminal. Then run `devlens .`.

**Windows PowerShell:**

```powershell
irm https://github.com/Meng-Hor001/DevLens/releases/latest/download/install.ps1 | iex
```

The installer uses `%LOCALAPPDATA%\DevLens` and adds it to your user PATH and current PowerShell session. Run `devlens.cmd .`. Administrator privileges and execution-policy changes are not required.

Both commands download and execute the hosted installer. You can inspect the scripts in [scripts/install.sh](scripts/install.sh) and [scripts/install.ps1](scripts/install.ps1) first. Installation downloads runtime dependencies from npm. Rerun the command to install the latest release.

The installers allow the requested remote package for that npm command (`--allow-remote=root`), including on npm 12. If an older hosted installer fails with `EALLOWREMOTE`, install directly on macOS / Linux:

```sh
npm install --global --allow-remote=root --prefix "$HOME/.local" https://github.com/Meng-Hor001/DevLens/releases/latest/download/devlens.tgz
```

### Publish the installer downloads

Commit and push this code, including `.github/workflows`, to `Meng-Hor001/DevLens`. With the current package version `0.2.0`, create and push a matching tag:

```sh
git tag v0.2.0
git push origin v0.2.0
```

The release workflow first requires checks and archive/installer smoke tests on Linux, Windows and macOS. Archive paths are derived from the package version. It then packages the CLI and publishes `devlens.tgz`, `install.sh` and `install.ps1` as GitHub release assets. Wait for it to finish successfully before sharing the installation commands. The repository and assets must be public for unauthenticated downloads. For later releases, update the package and CLI versions and push a new matching tag.

For installer testing or a custom location, set `DEVLENS_PACKAGE_URL` to a package archive URL or local path and `DEVLENS_INSTALL_DIR` to the desired install prefix.

## Analysis features

- Text-file scanning with built-in exclusions, nested `.gitignore` rules, file metadata and a 1 MiB limit.
- Languages ranked by file count (percentages rounded to one decimal).
- React, Next.js, Express, NestJS, Tailwind CSS, Redux, Prisma and Docker detection.
- Dependency declarations and versions from dependencies, devDependencies and peerDependencies, categorized by purpose. Unknown packages use `other`.
- Static imports, re-exports, literal require/dynamic import calls, relative paths and tsconfig/jsconfig aliases.
- Zod-validated project/file/dependency nodes and contains/imports/depends_on edges.
- `--help`, `--version`, `--output`, `--port`, `--no-browser`, actionable errors and exit codes.

The dependency count counts declarations across all scanned package manifests and sections. `uniqueDependencies` counts distinct declared/imported package names. Imports count distinct internal file-to-file edges; external imports create dependency edges. Node built-ins are omitted.

## Terminal dashboard

Run DevLens in an interactive terminal:

```sh
pnpm build
node cli/dist/index.js .
# After installation:
devlens /path/to/project
```

The dashboard runs inside the terminal. It opens no browser and starts no server by default. Piped output prints the scan summary and exits.

- **1 Overview:** a Metric / Value table with counts, language percentages, frameworks and scrollable parser warnings.
- **2 Dependencies:** library versions, categories and manifests; `/` filters, `c` cycles categories, `s` changes the sort column, and `r` reverses sorting.
- **3 Graph:** expandable folder tree; Enter on a file shows outgoing imports and incoming importers. Select a relationship and press Enter to follow it.
- **4 Search:** `/` starts a filename/path filter; Enter finishes editing, then Enter opens the selected file in Graph.

Use Tab or 1–4 to switch pages; arrows or j/k to move; PageUp/PageDown to scroll; Esc to go back or clear filters; q or Ctrl+C to quit. All four pages use bordered tables with fixed column headers. Long values end with `~` when truncated to fit the terminal. Resize to at least 60 columns by 16 rows. The terminal is restored when the dashboard closes. Rerun DevLens to refresh the snapshot.

The earlier browser dashboard remains available explicitly:

```sh
node cli/dist/index.js . --web
node cli/dist/index.js . --web --port 4546 --no-browser
```

Only `--web` starts the read-only local server. `--port` requires `--web`; `--no-browser` suppresses automatic browser opening in web mode.

## Privacy and limits

Scanning is local, makes no network calls, does not execute project/config code, and does not change source files. All `.env` and `.env.*` files (including examples for v0.1) and symlinks are excluded. Source contents remain in memory and are not exported. Individual parser errors become warnings.

Binary assets and files over 1 MiB are excluded; imports targeting them can produce unresolved-local-import warnings. Only literal import specifiers can be analyzed. Compiler configs extending excluded installed packages may warn. Dependency categories are heuristic. The dashboard is a snapshot: rerun the CLI after changing project files.

## Formatting

Use Prettier for consistent code formatting:

```sh
pnpm format        # Format source and project files
pnpm format:check  # Check formatting without changing files
```

The shared configuration uses two-space indentation, single quotes, semicolons, and a 100-character print width. Generated builds, dependencies, and the lockfile are excluded.

## Verify

```sh
pnpm check
```

This checks formatting, typechecks, builds both entry points, and runs the automated tests. The real-project acceptance test is opt-in and skipped unless project paths are supplied:

```sh
DEVLENS_ACCEPTANCE_PROJECTS='["/path/to/app-one","/path/to/app-two","/path/to/app-three"]' pnpm check
```

That acceptance check expects 3–5 Next.js/Tailwind App Router projects with root or `src` app layouts importing `globals.css` and `StoreProvider.tsx`, matching the four projects validated here. Adapt those explicit expectations for other layouts. No projects are downloaded or modified.

See [v0.2 completion and remaining verification](docs/scope-v0.2-status.md) and [v0.1 acceptance results](docs/scope-status.md).

## Distribute to another machine

Build an installable archive on the development machine:

```sh
pnpm package
```

Copy `release/devlens-0.2.0.tgz` to the receiving machine. The same archive works on Windows, Linux and macOS. The receiving machine needs Node.js 20+ and npm.

### Windows (PowerShell or Command Prompt)

Run from the directory containing the archive:

```powershell
npm.cmd install --global .\devlens-0.2.0.tgz
devlens.cmd --version
devlens.cmd "C:\Users\YourName\Projects\my app"
devlens.cmd "C:\Users\YourName\Projects\my app" --output "C:\Users\YourName\Documents\graph.json"
```

Use your actual project and output paths, and choose an output filename that does not already exist. npm creates Windows command launchers automatically. Using `.cmd` also works when PowerShell blocks `.ps1` scripts; no execution-policy change is needed. If the command is not found, run `npm.cmd prefix --global` and add the returned directory to your user `Path` environment variable, then reopen the terminal.

To uninstall, run `npm.cmd uninstall --global devlens`.

To run from source in PowerShell, use `pnpm.cmd install --frozen-lockfile`, `pnpm.cmd build`, then `node cli/dist/index.js "C:\path\to\project"`. Use `pnpm.cmd package` to build the archive on Windows.

### Linux and macOS

Run from the directory containing the archive:

```sh
npm install --global ./devlens-0.2.0.tgz --prefix "$HOME/.local"
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
