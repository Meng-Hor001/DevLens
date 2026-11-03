#!/bin/sh
set -eu

# Keep the installer in a function so a truncated download cannot start it.
install_devlens() {
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo 'DevLens requires Node.js 20+ and npm. Install them from https://nodejs.org and rerun this command.' >&2
    return 1
  fi
  if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
    echo 'DevLens requires Node.js 20 or newer.' >&2
    return 1
  fi

  devlens_prefix="${DEVLENS_INSTALL_DIR:-$HOME/.local}"
  devlens_package="${DEVLENS_PACKAGE_URL:-https://github.com/Meng-Hor001/DevLens/releases/latest/download/devlens.tgz}"
  mkdir -p "$devlens_prefix"
  # npm 12 blocks remote tarballs by default; allow the requested root package.
  npm install --global --allow-remote=root --prefix "$devlens_prefix" "$devlens_package" || return 1
  "$devlens_prefix/bin/devlen" --version || return 1
  printf '\nDevLens installed in %s/bin\n' "$devlens_prefix"
  case ":$PATH:" in
    *":$devlens_prefix/bin:"*) printf 'Run: devlen .\n' ;;
    *) printf 'Add this directory to PATH in your shell profile, then reopen your terminal:\n%s/bin\n' "$devlens_prefix" ;;
  esac
}

install_devlens
