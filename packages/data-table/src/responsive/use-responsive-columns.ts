import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { BudgetDebugInfo, ColumnPriority } from "./budget-algorithm.js";
import { type BudgetColumn, computeColumnBudget } from "./budget-algorithm.js";
import type { ColumnMeasurer } from "./column-measurer.js";
import { createFallbackMeasurer } from "./column-measurer.js";

const MAX_SAMPLE_ROWS = 50;
const DEFAULT_FONT = "14px sans-serif";
const CELL_PADDING = 32; // px-4 both sides
const SORT_CHROME = 20; // sort dropdown trigger
/** Per-format rendering chrome overhead in pixels */
const FORMAT_CHROME: Record<string, number> = {
  avatar: 32, // 24px circle + 8px gap
  badge: 16, // pill padding + border
  tags: 24, // badge chrome + inter-tag gap
};

function getColumnOverhead(col: ResponsiveColumnDef): number {
  const formatExtra = col.format ? (FORMAT_CHROME[col.format] ?? 0) : 0;
  return CELL_PADDING + SORT_CHROME + formatExtra;
}

/** Compare two visibility maps for shallow equality */
function visibilityChanged(prev: Record<string, boolean>, next: Record<string, boolean>): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return true;
  return nextKeys.some((k) => prev[k] !== next[k]);
}

export interface ResponsiveColumnDef {
  id: string;
  priority: ColumnPriority;
  /** Header label for measurement */
  label?: string;
  /** If set, budget uses this instead of measured width (column wraps) */
  minWidth?: number;
  /** Column renderer format (e.g. 'avatar', 'badge') for overhead calculation */
  format?: string;
}

export interface UseResponsiveColumnsOptions<TData> {
  columns: ResponsiveColumnDef[];
  /** Sample data rows for content measurement. Pass first ~50 rows. */
  data: TData[];
  /** Accessor to get cell string value for a column from a row */
  getCellValue: (row: TData, columnId: string) => string;
  /** Pluggable measurer. Falls back to char-count heuristic. */
  measurer?: ColumnMeasurer;
  /** CSS font string for measurement (e.g. '14px Inter'). Default: '14px sans-serif' */
  font?: string;
  /** Enable/disable responsive behavior */
  enabled?: boolean;
  /** External container ref to observe instead of creating a new one */
  containerRef?: RefObject<HTMLDivElement | null>;
  /** Called directly (not via state) when column visibility changes */
  onVisibilityChange?: (visibility: Record<string, boolean>) => void;
  /** Callback with debug info on every budget recalculation */
  onBudgetChange?: (debug: BudgetDebugInfo) => void;
}

export interface UseResponsiveColumnsResult {
  /** Ref to attach to the table container div */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current container width */
  containerWidth: number;
}

/**
 * Hook that observes container width and computes which columns
 * fit within the available budget, switching to card view when needed.
 *
 * Optimization: the ResizeObserver callback computes the budget inline
 * and only triggers a React state update when column visibility actually
 * changes, avoiding re-renders on every resize pixel.
 */
export function useResponsiveColumns<TData>(options: UseResponsiveColumnsOptions<TData>): UseResponsiveColumnsResult {
  const {
    columns,
    data,
    getCellValue,
    measurer,
    font = DEFAULT_FONT,
    enabled = true,
    containerRef: externalRef,
    onVisibilityChange,
    onBudgetChange,
  } = options;

  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalRef ?? internalRef;

  const activeMeasurer = useMemo(() => measurer ?? createFallbackMeasurer(), [measurer]);

  // Measurement only depends on columns/data/measurer/font — NOT containerWidth.
  const measuredColumns: BudgetColumn[] = useMemo(() => {
    const sampleRows = data.slice(0, MAX_SAMPLE_ROWS);

    return columns.map((col) => {
      const overhead = getColumnOverhead(col);
      const values = sampleRows.map((row) => getCellValue(row, col.id));
      if (col.label) values.push(col.label);
      const contentWidth = activeMeasurer.measureColumn(values, font);
      const measuredWidth = col.minWidth ? col.minWidth + overhead : contentWidth + overhead;
      return { id: col.id, priority: col.priority, measuredWidth, minWidth: col.minWidth };
    });
  }, [data, columns, activeMeasurer, font, getCellValue]);

  // Keep measuredColumns accessible in the observer callback without stale closures
  const measuredColumnsRef = useRef(measuredColumns);
  measuredColumnsRef.current = measuredColumns;

  const containerWidthRef = useRef(0);
  const prevVisibilityRef = useRef<Record<string, boolean>>({});

  // Compute budget and call callbacks directly — no intermediate state for visibility
  const computeAndUpdate = useCallback(
    (width: number) => {
      if (!enabled || width === 0) return;

      const result = computeColumnBudget({
        columns: measuredColumnsRef.current,
        containerWidth: width,
      });

      const changed =
        visibilityChanged(prevVisibilityRef.current, result.visibility) || prevVisibilityRef.current === undefined;

      if (changed) {
        prevVisibilityRef.current = result.visibility;
        if (onVisibilityChange) {
          onVisibilityChange(result.visibility);
        }
        if (result.debug && onBudgetChange) {
          onBudgetChange(result.debug);
        }
      }
    },
    [enabled, onVisibilityChange, onBudgetChange],
  );

  // Recompute when measured columns change (columns/data change, not resize)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — triggers recompute when measured columns identity changes
  useEffect(() => {
    if (containerWidthRef.current > 0) {
      computeAndUpdate(containerWidthRef.current);
    }
  }, [measuredColumns, computeAndUpdate]);

  // ResizeObserver — computes budget inline, only sets state on visibility change
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    // Synchronous initial read
    const initialWidth = Math.round(el.clientWidth);
    containerWidthRef.current = initialWidth;
    computeAndUpdate(initialWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      containerWidthRef.current = width;
      computeAndUpdate(width);
    });
    observer.observe(el);

    return () => observer.disconnect();
    // computeAndUpdate is stable for a given enabled/onVisibilityChange/onBudgetChange.
    // containerRef identity is stable (external ref or our internalRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRef is a stable ref object
  }, [enabled, containerRef, computeAndUpdate]);

  return {
    containerRef,
    containerWidth: containerWidthRef.current,
  };
}
