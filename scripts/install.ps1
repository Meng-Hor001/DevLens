$ErrorActionPreference = 'Stop'

function Install-DevLens {
    if (!(Get-Command node -ErrorAction SilentlyContinue) -or !(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'DevLens requires Node.js 20+ and npm. Install them from https://nodejs.org and rerun this command.'
    }
    & node -e 'process.exit(parseInt(process.versions.node) >= 20 ? 0 : 1)'
    if ($LASTEXITCODE -ne 0) { throw 'DevLens requires Node.js 20 or newer.' }

    $installDir = if ($env:DEVLENS_INSTALL_DIR) { $env:DEVLENS_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'DevLens' }
    $packageUrl = if ($env:DEVLENS_PACKAGE_URL) { $env:DEVLENS_PACKAGE_URL } else { 'https://github.com/Meng-Hor001/DevLens/releases/latest/download/devlens.tgz' }
    # npm 12 blocks remote tarballs by default; allow the requested root package.
    & npm.cmd install --global --allow-remote=root --prefix $installDir $packageUrl
    if ($LASTEXITCODE -ne 0) { throw 'DevLens installation failed.' }
    & (Join-Path $installDir 'devlen.cmd') --version
    if ($LASTEXITCODE -ne 0) { throw 'DevLens verification failed.' }

    $userPath = [string][Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -notcontains $installDir) {
        [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $installDir).TrimStart(';'), 'User')
    }
    if (($env:Path -split ';') -notcontains $installDir) { $env:Path = "$installDir;$env:Path" }
    Write-Host 'DevLens installed. Run: devlen.cmd .'
    Write-Host 'New terminals will also have DevLens on PATH.'
}

Install-DevLens
