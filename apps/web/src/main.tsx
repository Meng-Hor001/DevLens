import { StrictMode, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnalysisSchema, type Analysis } from '../../../packages/core/src/index.js';
import './style.css';
const GraphView = lazy(() => import('./GraphView'));
type Page = 'Overview' | 'Dependencies' | 'Graph' | 'Search';
const pages: Page[] = ['Overview', 'Dependencies', 'Graph', 'Search'];
const glyphs = ['◫', '▤', '⌘', '⌕'];
const colors = ['#a3e4a0', '#83b9e9', '#d8b4fe', '#eec77e', '#ed9eac', '#82cfc4'];
const descriptions: Record<Page, string> = {
  Overview: 'A clear view of your codebase. All in one place.',
  Dependencies: 'Know the libraries your project is built on.',
  Graph: 'Explore how your files connect, one folder at a time.',
  Search: 'Find a file. Follow its connections.',
};
function readRoute(): { page: Page; focus?: string } {
  const [raw, query] = location.hash.slice(1).split('?');
  return {
    page: pages.find((p) => p.toLowerCase() === raw) ?? 'Overview',
    focus: new URLSearchParams(query).get('file') ?? undefined,
  };
}
function App() {
  const [route, setRoute] = useState(readRoute);
  const [data, setData] = useState<Analysis>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const handler = () => setRoute(readRoute());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setData(undefined);
    fetch('/api/graph', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Server returned ${response.status}.`);
        return AnalysisSchema.parse(await response.json());
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unknown error.');
      });
    return () => controller.abort();
  }, [attempt]);
  function select(id: string) {
    location.hash = `graph?file=${encodeURIComponent(id)}`;
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#overview" className="brand">
          <span className="brand-mark">◈</span> DevLens <span className="version">0.2</span>
        </a>
        <div className="project-switch">
          <span className="project-icon">⌑</span>
          <div>
            <strong>{data?.project.name ?? 'Your project'}</strong>
            <small>Local workspace</small>
          </div>
          <span className="live-dot" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {pages.map((page, i) => (
            <a
              key={page}
              href={`#${page.toLowerCase()}`}
              aria-current={route.page === page ? 'page' : undefined}
              className={route.page === page ? 'active' : ''}
            >
              <span>{glyphs[i]}</span>
              {page}
              {page === 'Dependencies' && data && <small>{data.summary.dependencies}</small>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-icon">◇</div>
          <strong>Your code stays yours.</strong>
          <p>
            Analyzed on your machine.
            <br />
            Nothing leaves this device.
          </p>
          <div className="local-badge">
            <span className="live-dot" /> LOCAL · READ ONLY
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace <span>/</span> <strong>{route.page}</strong>
          </div>
          <div className="connection">
            <span className="live-dot" /> Local snapshot <span className="mono">127.0.0.1</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">PROJECT INTELLIGENCE</div>
              <h1>
                {route.page === 'Overview'
                  ? 'Project overview'
                  : route.page === 'Graph'
                    ? 'Import graph'
                    : route.page === 'Search'
                      ? 'Find your files'
                      : 'Dependencies'}
              </h1>
              <p>{descriptions[route.page]}</p>
            </div>
            <span className="snapshot-label">◷ &nbsp; Scan snapshot</span>
          </div>
          {error ? (
            <section className="empty-state error" role="alert">
              <h2>Could not load this project</h2>
              <p>Keep DevLens running in your terminal, then retry.</p>
              <p className="mono">
                {error.length > 250 ? 'The server returned an invalid project graph.' : error}
              </p>
              <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>
            </section>
          ) : !data ? (
            <section className="empty-state" role="status">
              <div className="spinner" />
              <h2>Loading your project…</h2>
              <p>Reading the local scan snapshot.</p>
            </section>
          ) : !data.summary.files ? (
            <section className="empty-state">
              <h2>No files to explore</h2>
              <p>Scan a project containing eligible text files, then reopen this dashboard.</p>
            </section>
          ) : (
            <>
              {route.page === 'Overview' && <Overview data={data} />}{' '}
              {route.page === 'Dependencies' && <Dependencies data={data} />}{' '}
              {route.page === 'Graph' && (
                <Suspense fallback={<p role="status">Loading graph…</p>}>
                  <GraphView data={data} focus={route.focus} onSelect={select} />
                </Suspense>
              )}{' '}
              {route.page === 'Search' && <Search data={data} onSelect={select} />}
            </>
          )}
          <footer>
            <span>
              <span className="live-dot" /> No external requests. No source uploads.
            </span>
            <span>DevLens / Understand what you build.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Overview({ data }: { data: Analysis }) {
  const summary = data.summary;
  return (
    <>
      <section className="stats-grid" aria-label="Project statistics">
        {[
          ['Files scanned', summary.files, 'Eligible text files', '▱'],
          [
            'Dependencies',
            summary.dependencies,
            `${summary.uniqueDependencies} unique libraries`,
            '▤',
          ],
          ['Import relationships', summary.imports, 'Internal file connections', '⌘'],
          [
            'Parser warnings',
            data.warnings.length,
            data.warnings.length ? 'Review details below' : 'Looking good',
            '⚑',
          ],
        ].map(([label, value, detail, icon]) => (
          <article className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <span className="stat-icon">{icon}</span>
            </div>
            <strong>{Number(value).toLocaleString()}</strong>
            <small>
              <span className={label === 'Parser warnings' && value ? 'amber-dot' : 'live-dot'} />
              {detail}
            </small>
          </article>
        ))}
      </section>
      <div className="overview-grid">
        <section className="panel languages">
          <div className="panel-heading">
            <h2>Language breakdown</h2>
            <span className="tag">BY FILE COUNT</span>
          </div>
          <p className="muted">The shape of your codebase</p>
          <div className="language-bar">
            {summary.languages.map((l, i) => (
              <div
                key={l.name}
                title={`${l.name}: ${l.percentage}%`}
                style={{ width: `${l.percentage}%`, background: colors[i % colors.length] }}
              />
            ))}
          </div>
          <div className="language-list">
            {summary.languages.map((l, i) => (
              <div key={l.name}>
                <span>
                  <i style={{ background: colors[i % colors.length] }} />
                  {l.name}
                </span>
                <span className="muted">{l.count} files</span>
                <strong>{l.percentage}%</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Detected stack</h2>
            <span className="tag">{summary.frameworks.length} FOUND</span>
          </div>
          <p className="muted">Frameworks and tools in this project</p>
          <div className="framework-list">
            {summary.frameworks.length ? (
              summary.frameworks.map((framework, i) => (
                <div key={framework}>
                  <span className="framework-icon" style={{ color: colors[i % colors.length] }}>
                    {framework.slice(0, 1)}
                  </span>
                  <strong>{framework}</strong>
                  <span className="detected">
                    Detected <span className="live-dot" />
                  </span>
                </div>
              ))
            ) : (
              <p>No supported frameworks detected.</p>
            )}
          </div>
        </section>
      </div>
      <section className="explore-banner">
        <div className="banner-symbol">⌘</div>
        <div>
          <h2>See the bigger picture.</h2>
          <p>Trace imports, explore folders, and understand how your project fits together.</p>
        </div>
        <a className="primary-button" href="#graph">
          Explore graph <span>↗</span>
        </a>
      </section>
      <section className="panel warnings">
        <div className="panel-heading">
          <h2>
            Parser warnings <span className="count-badge">{data.warnings.length}</span>
          </h2>
          <span className="muted">{summary.skipped} files skipped</span>
        </div>
        {data.warnings.length ? (
          <div className="warning-list">
            {data.warnings.map((w, i) => (
              <div key={i}>
                <span className="warning-icon">!</span>
                <div>
                  <strong>{w.path}</strong>
                  <p>{w.message}</p>
                </div>
                <span className="tag">{w.parser}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="clear-state">
            <span>✓</span>
            <div>
              <strong>No parser warnings</strong>
              <p>Your project was analyzed without parser warnings.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
function Dependencies({ data }: { data: Analysis }) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: 'name' | 'version' | 'category'; ascending: boolean }>({
    key: 'name',
    ascending: true,
  });
  const rows = useMemo(
    () =>
      data.dependencies
        .filter(
          (d) =>
            (category === 'all' || d.category === category) &&
            d.name.toLowerCase().includes(query.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (sort.ascending ? 1 : -1) *
            a[sort.key].localeCompare(b[sort.key], undefined, { numeric: true }),
        ),
    [data, query, category, sort],
  );
  return (
    <section className="panel">
      <div className="filter-bar">
        <label className="search-input">
          <span>⌕</span>
          <input
            aria-label="Filter dependencies"
            placeholder="Find a dependency…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="category-filter">
          Category
          <select
            aria-label="Dependency category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {[...new Set(data.dependencies.map((d) => d.category))].sort().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-summary">
        {rows.length} dependency declarations{' '}
        <span className="muted">· Versions as declared in package manifests</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {(['name', 'version', 'category'] as const).map((key) => (
                <th
                  key={key}
                  aria-sort={
                    sort.key === key ? (sort.ascending ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <button
                    onClick={() =>
                      setSort({ key, ascending: sort.key === key ? !sort.ascending : true })
                    }
                  >
                    {key} {sort.key === key ? (sort.ascending ? '↑' : '↓') : '↕'}
                  </button>
                </th>
              ))}
              <th>Manifest / section</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={`${d.manifest}:${d.section}:${d.name}:${i}`}>
                <td className="dependency-name">{d.name}</td>
                <td className="mono">{d.version}</td>
                <td>
                  <span className="category-pill">{d.category}</span>
                </td>
                <td>
                  <span className="mono">{d.manifest}</span>
                  <small>{d.section}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty-state">
          <h3>No matching dependencies</h3>
          <p>Try another name or category.</p>
        </div>
      )}
    </section>
  );
}
function Search({ data, onSelect }: { data: Analysis; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const files = useMemo(
    () =>
      data.graph.nodes
        .filter((n) => n.type === 'file')
        .sort((a, b) => String(a.metadata.path).localeCompare(String(b.metadata.path))),
    [data],
  );
  const matches = useMemo(
    () =>
      files.filter((n) =>
        String(n.metadata.path ?? n.label)
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [files, query],
  );
  return (
    <section className="panel">
      <label className="search-input large">
        <span>⌕</span>
        <input
          autoFocus
          aria-label="Search files"
          placeholder="Search by filename or path…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(100);
          }}
        />
        <kbd>FILES</kbd>
      </label>
      <div className="table-summary">
        {matches.length} files {query ? 'matched' : 'in this project'}{' '}
        <span className="muted">· Select a file to open it in the graph</span>
      </div>
      <div className="file-results">
        {matches.slice(0, limit).map((file) => (
          <button key={file.id} onClick={() => onSelect(file.id)}>
            <span className="file-symbol">▱</span>
            <span>
              <strong>{file.label}</strong>
              <small>{String(file.metadata.path)}</small>
            </span>
            <span className="result-arrow">Open in graph ↗</span>
          </button>
        ))}
      </div>
      {!matches.length && (
        <div className="empty-state">
          <h3>No files found</h3>
          <p>Try a shorter filename or a folder name.</p>
        </div>
      )}
      {matches.length > limit && (
        <button className="show-more" onClick={() => setLimit((n) => n + 100)}>
          Show 100 more results
        </button>
      )}
    </section>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
