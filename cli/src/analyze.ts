import path from 'node:path';
import { Graph } from '../../packages/core/src/index.js';
import { scanRepository, detectLanguages } from '../../packages/scanner/src/index.js';
import {
  parseManifests,
  analyzeImports,
  dependencyCategory,
} from '../../packages/parsers/src/index.js';

export async function analyze(directory: string, excludedPaths: string[] = []) {
  const scan = await scanRepository(directory, excludedPaths);
  if (!scan.files.length) throw new Error('No eligible text files found in the project.');
  const graph = new Graph();
  graph.addNode({ id: 'project', type: 'project', label: path.basename(scan.root), metadata: {} });
  for (const file of scan.files) {
    graph.addNode({
      id: `file:${file.path}`,
      type: 'file',
      label: file.name,
      metadata: { ...file },
    });
    graph.addEdge('project', `file:${file.path}`, 'contains');
  }
  const manifests = parseManifests(scan),
    imports = analyzeImports(scan);
  const dependencies = new Map<string, typeof manifests.dependencies>();
  for (const dep of manifests.dependencies)
    dependencies.set(dep.name, [...(dependencies.get(dep.name) ?? []), dep]);
  for (const relation of imports.relations)
    if (relation.external && !dependencies.has(relation.target))
      dependencies.set(relation.target, []);
  for (const [name, declarations] of dependencies) {
    graph.addNode({
      id: `dependency:${name}`,
      type: 'dependency',
      label: name,
      metadata: {
        category: dependencyCategory(name),
        declarations,
        declared: declarations.length > 0,
      },
    });
    graph.addEdge('project', `dependency:${name}`, 'depends_on');
  }
  for (const relation of imports.relations)
    graph.addEdge(
      `file:${relation.source}`,
      `${relation.external ? 'dependency' : 'file'}:${relation.target}`,
      relation.external ? 'depends_on' : 'imports',
    );
  return {
    schemaVersion: '0.1.0',
    project: { name: path.basename(scan.root) },
    summary: {
      files: scan.files.length,
      skipped: scan.skipped,
      languages: detectLanguages(scan.files),
      frameworks: manifests.frameworks,
      dependencies: manifests.dependencies.length,
      uniqueDependencies: dependencies.size,
      imports: graph.countByType().imports,
    },
    dependencies: manifests.dependencies,
    warnings: [...scan.warnings, ...manifests.warnings, ...imports.warnings],
    graph: graph.toJSON(),
  };
}
