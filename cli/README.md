# DevLens

Local repository analysis CLI for Node.js 20+.

```sh
devlens /path/to/project
devlens /path/to/project --output /tmp/devlens.json
devlens --help
```

Prints language percentages, detected frameworks, dependency versions/categories and import counts. The optional JSON export contains a validated project graph and parser warnings. Use a new output filename: existing files are never overwritten.

No network calls or project code execution. Environment files, symlinks, binary files and files over 1 MiB are excluded. Nested .gitignore rules are respected. Source contents are not included in exports. Image imports may produce warnings because binary assets are excluded.

`--port` and `--no-browser` are reserved for the future dashboard. This v0.1 package does not serve a dashboard.
