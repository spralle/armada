import { useRef, useState, useLayoutEffect, useMemo, useEffect } from "react"
import type { ColumnMeasurer } from "./column-measurer.js"
import type { ColumnPriority, BudgetDebugInfo } from "./budget-algorithm.js"
import { createFallbackMeasurer } from "./column-measurer.js"
import { computeColumnBudget, type BudgetColumn } from "./budget-algorithm.js"

const MAX_SAMPLE_ROWS = 50
const DEFAULT_FONT = "14px sans-serif"
/** Cell padding (32px for px-4 both sides) + sort header chrome (16px) */
const CELL_OVERHEAD = 48

export interface ResponsiveColumnDef {
  id: string
  priority: ColumnPriority
  /** Header label for measurement */
  label?: string
  /** If set, budget uses this instead of measured width (column wraps) */
  minWidth?: number
}

export interface UseResponsiveColumnsOptions<TData> {
  columns: ResponsiveColumnDef[]
  /** Sample data rows for content measurement. Pass first ~50 rows. */
  data: TData[]
  /** Accessor to get cell string value for a column from a row */
  getCellValue: (row: TData, columnId: string) => string
  /** Pluggable measurer. Falls back to char-count heuristic. */
  measurer?: ColumnMeasurer
  /** CSS font string for measurement (e.g. '14px Inter'). Default: '14px sans-serif' */
  font?: string
  /** Enable/disable responsive behavior */
  enabled?: boolean
  /** Container width below which card view is forced */
  cardViewThreshold?: number
  /** External container ref to observe instead of creating a new one */
  containerRef?: React.RefObject<HTMLDivElement | null>
  /** Callback with debug info on every budget recalculation */
  onBudgetChange?: (debug: BudgetDebugInfo) => void
}

export interface UseResponsiveColumnsResult {
  /** Ref to attach to the table container div */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Computed column visibility (budget + user overrides merged) */
  columnVisibility: Record<string, boolean>
  /** Whether card view should be active */
  shouldUseCardView: boolean
  /** Current container width */
  containerWidth: number
  /** Debug info for development tooling */
  debug: BudgetDebugInfo | null
}

/**
 * Hook that observes container width and computes which columns
 * fit within the available budget, switching to card view when needed.
 */
export function useResponsiveColumns<TData>(
  options: UseResponsiveColumnsOptions<TData>,
): UseResponsiveColumnsResult {
  const {
    columns,
    data,
    getCellValue,
    measurer,
    font = DEFAULT_FONT,
    enabled = true,
    cardViewThreshold,
    containerRef: externalRef,
    onBudgetChange,
  } = options

  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = externalRef ?? internalRef
  const [containerWidth, setContainerWidth] = useState(0)

  const activeMeasurer = useMemo(() => measurer ?? createFallbackMeasurer(), [measurer])

  const measuredColumns: BudgetColumn[] = useMemo(() => {
    const sampleRows = data.slice(0, MAX_SAMPLE_ROWS)

    return columns.map((col) => {
      const values = sampleRows.map((row) => getCellValue(row, col.id))
      if (col.label) values.push(col.label)
      const contentWidth = activeMeasurer.measureColumn(values, font)
      const measuredWidth = col.minWidth
        ? col.minWidth + CELL_OVERHEAD
        : contentWidth + CELL_OVERHEAD
      return { id: col.id, priority: col.priority, measuredWidth, minWidth: col.minWidth }
    })
  }, [data, columns, activeMeasurer, font, getCellValue])

  useLayoutEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    // Read initial width synchronously
    setContainerWidth(Math.round(el.clientWidth))

    // ResizeObserver already batches — no RAF needed
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(Math.round(entry.contentRect.width))
      }
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [enabled, containerRef])

  const budgetResult = useMemo(() => {
    if (!enabled || containerWidth === 0) {
      return { visibility: {} as Record<string, boolean>, shouldUseCardView: false, debug: null }
    }
    const result = computeColumnBudget({ columns: measuredColumns, containerWidth, cardViewThreshold })
    return { visibility: result.visibility, shouldUseCardView: result.shouldUseCardView, debug: result.debug }
  }, [enabled, containerWidth, measuredColumns, cardViewThreshold])

  useEffect(() => {
    if (budgetResult.debug && onBudgetChange) {
      onBudgetChange(budgetResult.debug)
    }
  }, [budgetResult.debug, onBudgetChange])

  const columnVisibility = useMemo(() => {
    if (!enabled) return {}
    return budgetResult.visibility
  }, [enabled, budgetResult.visibility])

  return {
    containerRef,
    columnVisibility,
    shouldUseCardView: enabled ? budgetResult.shouldUseCardView : false,
    containerWidth,
    debug: budgetResult.debug,
  }
}
