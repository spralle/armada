import { useRef, useState, useLayoutEffect, useCallback, useMemo } from "react"
import type { ColumnMeasurer } from "./column-measurer.js"
import type { ColumnPriority } from "./budget-algorithm.js"
import { createFallbackMeasurer } from "./column-measurer.js"
import { computeColumnBudget, type BudgetColumn } from "./budget-algorithm.js"

const MAX_SAMPLE_ROWS = 50
const DEFAULT_FONT = "14px sans-serif"

export interface ResponsiveColumnDef {
  id: string
  priority: ColumnPriority
  /** Header label for measurement */
  label?: string
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
  /** User's manually toggled column visibility (takes precedence over budget) */
  userVisibility?: Record<string, boolean>
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
    userVisibility,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const rafRef = useRef(0)

  const activeMeasurer = useMemo(() => measurer ?? createFallbackMeasurer(), [measurer])

  const measuredColumns: BudgetColumn[] = useMemo(() => {
    const sampleRows = data.slice(0, MAX_SAMPLE_ROWS)

    return columns.map((col) => {
      const values = sampleRows.map((row) => getCellValue(row, col.id))
      if (col.label) values.push(col.label)
      const measuredWidth = activeMeasurer.measureColumn(values, font)
      return { id: col.id, priority: col.priority, measuredWidth }
    })
  }, [data, columns, activeMeasurer, font, getCellValue])

  useLayoutEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const entry = entries[0]
        if (entry) {
          setContainerWidth(entry.contentRect.width)
        }
      })
    })

    observer.observe(el)
    setContainerWidth(el.clientWidth)

    return () => {
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
    }
  }, [enabled])

  const budgetResult = useMemo(() => {
    if (!enabled || containerWidth === 0) {
      return { visibility: {} as Record<string, boolean>, shouldUseCardView: false }
    }
    return computeColumnBudget({ columns: measuredColumns, containerWidth, cardViewThreshold })
  }, [enabled, containerWidth, measuredColumns, cardViewThreshold])

  const columnVisibility = useMemo(() => {
    if (!enabled) return {}
    return mergeUserVisibility(budgetResult.visibility, userVisibility)
  }, [enabled, budgetResult.visibility, userVisibility])

  return {
    containerRef,
    columnVisibility,
    shouldUseCardView: enabled ? budgetResult.shouldUseCardView : false,
    containerWidth,
  }
}

function mergeUserVisibility(
  budget: Record<string, boolean>,
  user: Record<string, boolean> | undefined,
): Record<string, boolean> {
  if (!user) return budget
  const merged = { ...budget }
  for (const [id, visible] of Object.entries(user)) {
    merged[id] = visible
  }
  return merged
}
