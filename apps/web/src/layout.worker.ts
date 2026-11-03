import dagre from '@dagrejs/dagre';
import { visibleGraph } from './graph-model';
import type { Analysis } from '../../../packages/core/src/index.js';
self.onmessage = (
  event: MessageEvent<{ data: Analysis; expanded: string[]; limit: number; selected?: string }>,
) => {
  try {
    const { data, expanded, limit, selected } = event.data;
    const graph = visibleGraph(data, expanded, limit, selected);
    const layout = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    layout.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 90 });
    for (const node of graph.nodes) layout.setNode(node.id, { width: 230, height: 64 });
    for (const edge of graph.edges) layout.setEdge(edge.source, edge.target);
    dagre.layout(layout);
    self.postMessage({
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        position: { x: layout.node(node.id).x - 115, y: layout.node(node.id).y - 32 },
      })),
    });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Layout failed.' });
  }
};
