# DevLens CLI

DevLens v0.1 scans a local repository and exports a validated project graph. Runs on Windows, Linux and macOS with Node.js 20+. Building from source also requires pnpm.

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

These URLs become available after the first GitHub release containing the installer assets is published. Requires Node.js 20+ and npm; no npm publication is needed.

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

### Publish the installer downloads

Commit and push this code, including `.github/workflows`, to `Meng-Hor001/DevLens`. With the current package version `0.1.0`, create and push a matching tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The release workflow checks and packages the CLI, then publishes `devlens.tgz`, `install.sh` and `install.ps1` as GitHub release assets. Wait for it to finish successfully before sharing the installation commands. The repository and assets must be public for unauthenticated downloads. For later releases, update the package and CLI versions and push a new matching tag.

For installer testing or a custom location, set `DEVLENS_PACKAGE_URL` to a package archive URL or local path and `DEVLENS_INSTALL_DIR` to the desired install prefix.

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

This typechecks, builds both entry points, and runs the automated tests. The real-project acceptance test is opt-in and skipped unless project paths are supplied:

```sh
DEVLENS_ACCEPTANCE_PROJECTS='["/path/to/app-one","/path/to/app-two","/path/to/app-three"]' pnpm check
```

That acceptance check expects 3–5 Next.js/Tailwind App Router projects with root or `src` app layouts importing `globals.css` and `StoreProvider.tsx`, matching the four projects validated here. Adapt those explicit expectations for other layouts. No projects are downloaded or modified.

See [scope completion and acceptance results](docs/scope-status.md). Later roadmap commands and the dashboard are not implemented in v0.1.

## Distribute to another machine

Build an installable archive on the development machine:

```sh
pnpm package
```

Copy `release/devlens-0.1.0.tgz` to the receiving machine. The same archive works on Windows, Linux and macOS. The receiving machine needs Node.js 20+ and npm.

### Windows (PowerShell or Command Prompt)

Run from the directory containing the archive:

```powershell
npm.cmd install --global .\devlens-0.1.0.tgz
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
