import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Analysis } from '../../../packages/core/src/index.js';
import { parentFolders, type VisibleNode } from './graph-model';

type Layout = {
  nodes: (VisibleNode & { position: { x: number; y: number } })[];
  edges: { id: string; source: string; target: string; count: number }[];
  total: number;
};
export default function GraphView({
  data,
  focus,
  onSelect,
}: {
  data: Analysis;
  focus?: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [limit, setLimit] = useState(300);
  const [layout, setLayout] = useState<Layout>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  // Selection changes highlight neighbors; only search/reveal changes the layout.
  const [reveal, setReveal] = useState<string | undefined>(focus);
  useEffect(() => {
    if (focus && !layout?.nodes.some((n) => n.id === focus)) {
      setExpanded((previous) => [...new Set([...previous, ...parentFolders(focus.slice(5))])]);
      setReveal(focus);
    }
  }, [focus]);
  useEffect(() => {
    setBusy(true);
    setError('');
    const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      if (event.data.error) setError(event.data.error);
      else {
        setLayout(event.data);
        setRevision((r) => r + 1);
      }
      setBusy(false);
    };
    worker.onerror = () => {
      setError('Could not calculate the graph layout. Try collapsing folders.');
      setBusy(false);
    };
    worker.postMessage({ data, expanded, limit, selected: reveal });
    return () => worker.terminate();
  }, [data, expanded, limit, reveal]);
  const neighbors = useMemo(() => {
    const ids = new Set([focus]);
    for (const edge of layout?.edges ?? []) {
      if (edge.source === focus) ids.add(edge.target);
      if (edge.target === focus) ids.add(edge.source);
    }
    return ids;
  }, [layout, focus]);
  const nodes: Node[] = useMemo(
    () =>
      (layout?.nodes ?? []).map((n) => ({
        id: n.id,
        position: n.position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: (
            <span title={n.label}>
              <small>{n.folder ? `FOLDER · ${n.count} FILES` : 'FILE'}</small>
              <strong>
                {n.folder ? '▸ ' : ''}
                {n.label}
              </strong>
            </span>
          ),
        },
        className: `${n.folder ? 'folder-node' : 'file-node'} ${n.id === focus ? 'focused-node' : ''}`,
        style: { width: 230, height: 64, opacity: focus && !neighbors.has(n.id) ? 0.28 : 1 },
      })),
    [layout, focus, neighbors],
  );
  const edges: Edge[] = useMemo(
    () =>
      (layout?.edges ?? []).map((e) => ({
        ...e,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        label: e.count > 1 ? String(e.count) : undefined,
        style: {
          stroke: focus && (e.source === focus || e.target === focus) ? '#86efac' : '#56675e',
          opacity: focus && e.source !== focus && e.target !== focus ? 0.12 : 0.8,
        },
      })),
    [layout, focus],
  );
  const selected = data.graph.nodes.find((n) => n.id === focus);
  const outgoing = data.graph.edges.filter(
    (e) => e.source === focus && (e.type === 'imports' || e.type === 'depends_on'),
  );
  const incoming = data.graph.edges.filter((e) => e.target === focus && e.type === 'imports');
  const names = new Map(data.graph.nodes.map((n) => [n.id, String(n.metadata.path ?? n.label)]));
  function relationship(id: string) {
    return id.startsWith('file:') ? (
      <button className="link-file" onClick={() => onSelect(id)}>
        {names.get(id)}
      </button>
    ) : (
      <span>
        {names.get(id)} <small>external</small>
      </span>
    );
  }
  return (
    <>
      <div className="toolbar">
        <div>
          <span className="live-dot" /> {layout?.nodes.length ?? 0} / {layout?.total ?? 0} visible
          nodes <span className="muted">· folder-first view</span>
        </div>
        <div className="actions">
          <button
            onClick={() => {
              setExpanded([]);
              setReveal(undefined);
              setLimit(300);
            }}
          >
            Collapse all
          </button>
          {!!layout && layout.total > limit && (
            <button onClick={() => setLimit((n) => n + 300)}>Show 300 more</button>
          )}
        </div>
      </div>
      {expanded.length > 0 && (
        <div className="expanded-folders">
          <span>Expanded</span>
          {expanded.map((folder) => (
            <button
              key={folder}
              onClick={() =>
                setExpanded((list) =>
                  list.filter((p) => p !== folder && !p.startsWith(folder + '/')),
                )
              }
            >
              {folder} ×
            </button>
          ))}
        </div>
      )}
      <div className="graph-workspace">
        <div className="graph-canvas" aria-label="Import graph">
          {busy && (
            <div className="graph-status" role="status">
              Arranging graph…
            </div>
          )}
          {error && (
            <div className="graph-status error" role="alert">
              {error}
            </div>
          )}
          {!busy && !error && layout?.nodes.length === 0 && (
            <div className="graph-status">No files to display.</div>
          )}
          <ReactFlow
            key={revision}
            nodes={nodes}
            edges={edges}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.02}
            maxZoom={2}
            fitView
            fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
            colorMode="dark"
            onlyRenderVisibleElements
            onNodeClick={(_, node) => {
              if (node.id.startsWith('folder:'))
                setExpanded((list) => [...new Set([...list, node.id.slice(7)])]);
              else onSelect(node.id);
            }}
          >
            <Background color="#2b3830" gap={24} />
            <Controls showInteractive={false} />
            <MiniMap nodeColor="#3a6350" maskColor="rgba(12,18,14,.75)" pannable zoomable />
          </ReactFlow>
        </div>
        <aside className="node-details">
          <span className="eyebrow">NODE INSPECTOR</span>
          {selected ? (
            <>
              <h3>{selected.label}</h3>
              <p className="mono break-all">{String(selected.metadata.path ?? selected.label)}</p>
              <div className="detail-section">
                <h4>
                  Imports <span>{outgoing.length}</span>
                </h4>
                {outgoing.length ? (
                  outgoing.map((e) => <div key={e.id}>{relationship(e.target)}</div>)
                ) : (
                  <p>No outgoing imports.</p>
                )}
              </div>
              <div className="detail-section">
                <h4>
                  Imported by <span>{incoming.length}</span>
                </h4>
                {incoming.length ? (
                  incoming.map((e) => <div key={e.id}>{relationship(e.source)}</div>)
                ) : (
                  <p>No incoming imports.</p>
                )}
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <div className="inspector-symbol">⌘</div>
              <h3>Follow the connections</h3>
              <p>
                Expand a folder, then select a file to explore its imports and direct neighbors.
              </p>
              <p>Arrows point from the importing file to its dependency.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
