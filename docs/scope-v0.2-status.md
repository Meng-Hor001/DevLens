# v0.2 Local Dashboard UI status — 2026-11-03

**Updated direction:** the user requested a terminal UI instead of a browser dashboard. `devlens .` now opens the TUI; the browser implementation described below is available with `--web`. See the README for terminal controls. This report records the earlier browser-scope acceptance.

Source: `DevLens Scope v0.2 Local Dashboard UI.pdf` (five pages, dated Nov 3, 2026).

The feature implementation is present. Full release acceptance remains pending browser testing, especially on a real project with at least 1,000 scanned files. Do not call v0.2 fully verified yet.

## What was already implemented at the start of this review

The working tree already contained the Hono server, CLI integration, shared Analysis schema, React/Vite/Tailwind dashboard, React Flow graph with Dagre worker layout, and build asset copying. These changes were uncommitted. This review preserved them and added dashboard regression checks, API acceptance checks on four existing projects, and corrected outdated documentation.

## Current CLI table update

Options 1–4 now render bordered, terminal-width-aware tables with persistent column headers:

| Option         | Columns                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| 1 Overview     | Metric, Value (counts, languages, frameworks, warnings)                        |
| 2 Dependencies | Name, Version, Category, Manifest / section                                    |
| 3 Graph        | Folder / file, Type / state; file inspection uses Relationship, File / library |
| 4 Search       | File path, Imports (including external dependencies), Imported by              |

Sorting, filters, scrolling, folder expansion and following file relationships remain available. Cells are sanitized and clipped with `~`; the minimum terminal size is 60 × 16. Table rendering checks cover all pages at 60, 80 and 120 columns, empty results, long names and control characters.

The PDF specifies browser launch by default; this repository uses the terminal by default and exposes the PDF's browser workflow with `--web`, retaining the requested CLI options 1–4. This is an intentional difference from the literal PDF flow.

## Scope checklist

| Scope point                                      | Implementation | Verification                                                                                                                                                                                 |
| ------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Local Hono server and GET /api/graph          | Complete       | Exact snapshot response tested; real HTTP response confirmed                                                                                                                                 |
| 2. Overview                                      | Complete       | Counts, languages, frameworks, dependencies, imports and warnings present; browser QA pending                                                                                                |
| 3. Dependencies                                  | Complete       | Name/version/category sorting and category/name filtering present; browser QA pending                                                                                                        |
| 4. Graph                                         | Complete       | React Flow zoom/pan, inspector, neighbor highlighting, folder expansion, 300-node cap/show more, Dagre worker; 1,200-file synthetic model test passes; real large-project browser QA pending |
| 5. Search                                        | Complete       | Live filename/path filtering and graph selection present; browser QA pending                                                                                                                 |
| 6. Packaged dashboard and CLI integration        | Complete       | Build includes HTML/CSS/JS and layout worker; archive installed independently and served successfully                                                                                        |
| 7. Test 3–5 real projects, including a large one | Partial        | Four real Next.js projects passed scan/API checks; interactive UI checks and a real 1,000+ file project remain                                                                               |

Additional requirements:

- `--port` and `--no-browser`: automated invocation checks pass; installed CLI served on custom port 4546 without opening a browser.
- Busy port: actual CLI exits with `Port 4545 is already in use. Try --port 4546.`
- Loopback/read-only: socket inspection confirmed `127.0.0.1:4545`; mutation methods return 405; foreign host/origin checks pass; arbitrary source-file requests return 404.
- Loading/error/empty states: implemented in the dashboard; missing/empty project errors tested in the CLI. Browser rendering remains unverified.
- JSON consistency: independently installed package's `/api/graph` matched its `--output` JSON exactly.
- Distribution: temporary archive installed with npm outside the repo; binary, HTML and entry assets served successfully. Public npm publication and public `npx devlens .` availability are not claimed.

## Checks run

`pnpm check` passed formatting, typechecking, Vite/dashboard build, both CLI builds and the existing automated tests. After adding the table regression checks, all 24 tests passed with the four local project paths supplied, and typechecking passed again. Browser availability was retried during this update; the browser access host remains unavailable.

Real-project acceptance exercised these existing repositories without modifying them:

- `/home/menghor/Documents/front-end/clone/psardigital-admin`
- `/home/menghor/Documents/front-end/qubase-admin`
- `/home/menghor/Documents/front-end/phasar-digital/psardigital-ui`
- `/home/menghor/Documents/front-end/clone/qubase-frontend`

The automated acceptance checks compare dependencies with manifests, validate graph/schema and language counts, check known imports, and assert the dashboard endpoint returns the exact analysis and packaged HTML responds successfully.

The synthetic 1,200-file graph test verifies grouping, aggregation, node limits, show-more limits and search selection beyond the cap. It does **not** establish browser frame rate or real-project layout performance.

## Remaining release acceptance

Browser automation could not start: the browser access host was unavailable. In a browser:

1. Run `node cli/dist/index.js /path/to/next-app --web` and confirm automatic browser opening.
2. Verify Overview against the exported JSON; sort/filter Dependencies; search for a file and inspect its graph neighbors.
3. Expand/collapse folders, zoom/pan, and use show more on a real project with at least 1,000 eligible files. Confirm the UI stays responsive during worker layout.
4. Repeat the four-page walkthrough on the other real projects, and verify loading/error/retry presentation.

## Updated roadmap

The new PDF supersedes the older v0.1 report's roadmap: v0.3 layer classification/component relationships/graph filters; v0.4 API detection; v0.5 database/ERD; v0.6 Docker/richer architecture; v0.7 Project Doctor/health score. These are outside this task.
