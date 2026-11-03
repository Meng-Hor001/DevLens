import { z } from 'zod';

export const GraphNodeSchema = z.object({
  id: z.string().min(1), type: z.enum(['project', 'file', 'dependency']),
  label: z.string(), metadata: z.record(z.string(), z.unknown()).default({}),
});
export const GraphEdgeSchema = z.object({
  id: z.string().min(1), source: z.string(), target: z.string(),
  type: z.enum(['contains', 'imports', 'depends_on']),
});
export const GraphSchema = z.object({ nodes: z.array(GraphNodeSchema), edges: z.array(GraphEdgeSchema) }).superRefine((graph, ctx) => {
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  if (nodes.size !== graph.nodes.length) ctx.addIssue({ code: 'custom', message: 'Duplicate node IDs' });
  if (new Set(graph.edges.map(e => e.id)).size !== graph.edges.length) ctx.addIssue({ code: 'custom', message: 'Duplicate edge IDs' });
  for (const edge of graph.edges) {
    const a = nodes.get(edge.source), b = nodes.get(edge.target);
    if (!a || !b) ctx.addIssue({ code: 'custom', message: 'Dangling edge' });
    else if (!(edge.type === 'contains' ? a.type === 'project' && b.type === 'file' : edge.type === 'imports' ? a.type === 'file' && b.type === 'file' : b.type === 'dependency' && a.type !== 'dependency')) {
      ctx.addIssue({ code: 'custom', message: 'Invalid relationship types' });
    }
  }
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export interface Warning { parser: string; path: string; message: string }
export class Graph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  addNode(node: z.input<typeof GraphNodeSchema>): GraphNode {
    const parsed = GraphNodeSchema.parse(node); this.nodes.set(parsed.id, parsed); return parsed;
  }
  addEdge(source: string, target: string, type: GraphEdge['type']): GraphEdge {
    const edge = GraphEdgeSchema.parse({ id: JSON.stringify([type, source, target]), source, target, type });
    GraphSchema.parse({ nodes: [...new Set([source, target])].flatMap(id => {
      const node = this.nodes.get(id);
      return node ? [node] : [];
    }), edges: [edge] });
    this.edges.set(edge.id, edge); return edge;
  }
  getNeighbors(id: string, direction: 'out' | 'in' | 'both' = 'out'): GraphNode[] {
    const ids = new Set<string>();
    for (const e of this.edges.values()) {
      if (direction !== 'in' && e.source === id) ids.add(e.target);
      if (direction !== 'out' && e.target === id) ids.add(e.source);
    }
    return [...ids].map(id => this.nodes.get(id)!);
  }
  countByType(): Record<string, number> {
    const counts: Record<string, number> = { project: 0, file: 0, dependency: 0, contains: 0, imports: 0, depends_on: 0 };
    for (const item of [...this.nodes.values(), ...this.edges.values()]) counts[item.type]!++;
    return counts;
  }
  toJSON() { return GraphSchema.parse({ nodes: [...this.nodes.values()], edges: [...this.edges.values()] }); }
}
