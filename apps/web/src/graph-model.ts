import type { Analysis } from '../../../packages/core/src/index.js';

export interface VisibleNode {
  id: string;
  label: string;
  folder: boolean;
  count: number;
}
export function visibleGraph(data: Analysis, expanded: string[], limit: number, selected?: string) {
  const open = new Set(expanded);
  const all = new Map<string, VisibleNode>();
  const representatives = new Map<string, string>();
  for (const file of data.graph.nodes.filter((n) => n.type === 'file')) {
    const filePath = String(file.metadata.path ?? file.id.slice(5));
    const parts = filePath.split('/');
    let folder = '';
    for (let i = 0; i < parts.length - 1; i++) {
      const candidate = parts.slice(0, i + 1).join('/');
      if (!open.has(candidate)) {
        folder = candidate;
        break;
      }
    }
    const id = folder ? `folder:${folder}` : file.id;
    representatives.set(file.id, id);
    const previous = all.get(id);
    all.set(id, {
      id,
      label: folder || filePath,
      folder: !!folder,
      count: (previous?.count ?? 0) + 1,
    });
  }
  const sorted = [...all.values()].sort(
    (a, b) => Number(b.folder) - Number(a.folder) || a.label.localeCompare(b.label),
  );
  // A search selection must remain visible even when it is beyond the current cap.
  const selectedId = selected && representatives.get(selected);
  if (selectedId) {
    const i = sorted.findIndex((n) => n.id === selectedId);
    if (i >= 0) sorted.unshift(...sorted.splice(i, 1));
  }
  const nodes = sorted.slice(0, limit);
  const visible = new Set(nodes.map((n) => n.id));
  const edges = new Map<string, { id: string; source: string; target: string; count: number }>();
  for (const edge of data.graph.edges) {
    if (edge.type !== 'imports') continue;
    const source = representatives.get(edge.source),
      target = representatives.get(edge.target);
    if (!source || !target || source === target || !visible.has(source) || !visible.has(target))
      continue;
    const id = JSON.stringify([source, target]);
    edges.set(id, { id, source, target, count: (edges.get(id)?.count ?? 0) + 1 });
  }
  return { nodes, edges: [...edges.values()], total: all.size };
}
export function parentFolders(filePath: string) {
  const parts = filePath.split('/');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
}
