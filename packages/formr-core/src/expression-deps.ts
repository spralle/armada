import type { RuleDefinition } from './contracts.js';
import type { ExprNode } from '@ghost/predicate';

export interface RuleDependency {
  readonly rule: RuleDefinition;
  readonly reads: readonly string[];
  readonly writes: readonly string[];
}

export interface DependencyGraph {
  readonly rules: readonly RuleDependency[];
}

/** Extract all path references from an expression AST */
function collectPaths(node: ExprNode, paths: Set<string>): void {
  switch (node.kind) {
    case 'literal':
      return;
    case 'path':
      paths.add(node.path);
      return;
    case 'op':
      for (const arg of node.args) {
        collectPaths(arg, paths);
      }
      return;
  }
}

function analyzeRule(rule: RuleDefinition): RuleDependency {
  const readPaths = new Set<string>();
  const writePaths = new Set<string>();

  // Condition reads
  collectPaths(rule.when, readPaths);

  // Write value expressions also read paths
  for (const w of rule.writes) {
    writePaths.add(w.path);
    collectPaths(w.value, readPaths);
  }

  return {
    rule,
    reads: [...readPaths],
    writes: [...writePaths],
  };
}

/** Build a dependency graph from rule definitions for scoped re-evaluation */
export function buildDependencyGraph(rules: readonly RuleDefinition[]): DependencyGraph {
  return { rules: rules.map(analyzeRule) };
}

/** Given changed paths, return only rules that read from any of them */
export function getAffectedRules(
  graph: DependencyGraph,
  changedPaths: readonly string[],
): readonly RuleDefinition[] {
  const changed = new Set(changedPaths);

  return graph.rules
    .filter((dep) => dep.reads.some((r) => changed.has(r) || hasOverlap(r, changed)))
    .map((dep) => dep.rule);
}

/** Check if a read path overlaps with any changed path (parent/child) */
function hasOverlap(readPath: string, changed: Set<string>): boolean {
  for (const cp of changed) {
    if (cp.startsWith(readPath + '.') || readPath.startsWith(cp + '.')) {
      return true;
    }
  }
  return false;
}
