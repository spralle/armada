/** Priority levels for responsive column visibility budgeting. */
export type ColumnPriority = "essential" | "default" | "optional"

export interface BudgetColumn {
  id: string
  priority: ColumnPriority
  measuredWidth: number
  minWidth?: number
}

export interface BudgetColumnDebug {
  id: string
  priority: ColumnPriority
  measuredWidth: number
  visible: boolean
  /** Why this column is visible or hidden */
  reason: 'essential-always' | 'fits-budget' | 'exceeds-budget' | 'card-view-active' | 'defaults-have-priority'
}

export interface BudgetDebugInfo {
  containerWidth: number
  shouldUseCardView: boolean
  totalBudgetUsed: number
  totalBudgetAvailable: number
  remainingBudget: number
  columns: BudgetColumnDebug[]
}

export interface BudgetResult {
  /** Column visibility map: { columnId: true/false } */
  visibility: Record<string, boolean>
  /** True when table should switch to card view */
  shouldUseCardView: boolean
  /** Debug info for development/tuning. Always populated. */
  debug: BudgetDebugInfo
}

export interface BudgetOptions {
  columns: BudgetColumn[]
  containerWidth: number
  /** Horizontal gap/padding between columns (default: 16) */
  columnGap?: number
  /** Container width below which card view is forced (default: 480) */
  cardViewThreshold?: number
}

const DEFAULT_COLUMN_GAP = 16
const DEFAULT_CARD_VIEW_THRESHOLD = 480
const MIN_VISIBLE_COLUMNS = 2

/**
 * Pure function that decides which columns fit within a container width budget.
 * Prioritizes essential columns, then greedily adds default/optional narrowest-first.
 */
export function computeColumnBudget(options: BudgetOptions): BudgetResult {
  const {
    columns,
    containerWidth,
    columnGap = DEFAULT_COLUMN_GAP,
    cardViewThreshold = DEFAULT_CARD_VIEW_THRESHOLD,
  } = options

  const allVisible = buildVisibilityMap(columns, true)

  if (containerWidth < cardViewThreshold) {
    return {
      visibility: allVisible,
      shouldUseCardView: true,
      debug: buildDebug(columns, containerWidth, true, 'card-view-active'),
    }
  }

  const { essentials, defaults, optionals } = groupByPriority(columns)

  const essentialCost = sumWidths(essentials, columnGap)
  if (essentialCost > containerWidth) {
    return {
      visibility: allVisible,
      shouldUseCardView: true,
      debug: buildDebug(columns, containerWidth, true, 'card-view-active'),
    }
  }

  const visibility = buildVisibilityMap(columns, false)
  const reasons = new Map<string, BudgetColumnDebug['reason']>()

  for (const col of essentials) {
    visibility[col.id] = true
    reasons.set(col.id, 'essential-always')
  }

  let remaining = containerWidth - essentialCost
  remaining = fillBudgetTracked(defaults, remaining, columnGap, visibility, reasons)

  const allDefaultsVisible = defaults.every(d => visibility[d.id])
  if (allDefaultsVisible) {
    remaining = fillBudgetTracked(optionals, remaining, columnGap, visibility, reasons)
  } else {
    for (const col of optionals) {
      reasons.set(col.id, 'defaults-have-priority')
    }
  }

  const visibleCount = Object.values(visibility).filter(Boolean).length
  if (visibleCount <= MIN_VISIBLE_COLUMNS) {
    return {
      visibility: allVisible,
      shouldUseCardView: true,
      debug: buildDebug(columns, containerWidth, true, 'card-view-active'),
    }
  }

  const budgetUsed = containerWidth - remaining
  const debugColumns: BudgetColumnDebug[] = columns.map(col => ({
    id: col.id,
    priority: col.priority,
    measuredWidth: col.measuredWidth,
    visible: visibility[col.id],
    reason: reasons.get(col.id) ?? 'exceeds-budget',
  }))

  return {
    visibility,
    shouldUseCardView: false,
    debug: {
      containerWidth,
      shouldUseCardView: false,
      totalBudgetUsed: budgetUsed,
      totalBudgetAvailable: containerWidth,
      remainingBudget: remaining,
      columns: debugColumns,
    },
  }
}

function groupByPriority(columns: BudgetColumn[]) {
  const essentials: BudgetColumn[] = []
  const defaults: BudgetColumn[] = []
  const optionals: BudgetColumn[] = []

  for (const col of columns) {
    if (col.priority === "essential") essentials.push(col)
    else if (col.priority === "default") defaults.push(col)
    else optionals.push(col)
  }

  return { essentials, defaults, optionals }
}

function sumWidths(columns: BudgetColumn[], gap: number): number {
  if (columns.length === 0) return 0
  return columns.reduce((sum, col) => sum + col.measuredWidth, 0) + (columns.length - 1) * gap
}

/** Greedily add narrowest columns first. Returns remaining budget. */
function fillBudget(
  columns: BudgetColumn[],
  budget: number,
  gap: number,
  visibility: Record<string, boolean>,
): number {
  const sorted = [...columns].sort((a, b) => a.measuredWidth - b.measuredWidth)
  let remaining = budget

  for (const col of sorted) {
    const cost = col.measuredWidth + gap
    if (cost <= remaining) {
      visibility[col.id] = true
      remaining -= cost
    }
  }

  return remaining
}

/** Like fillBudget but also tracks reasons for debug output. */
function fillBudgetTracked(
  columns: BudgetColumn[],
  budget: number,
  gap: number,
  visibility: Record<string, boolean>,
  reasons: Map<string, BudgetColumnDebug['reason']>,
): number {
  const sorted = [...columns].sort((a, b) => a.measuredWidth - b.measuredWidth)
  let remaining = budget

  for (const col of sorted) {
    const cost = col.measuredWidth + gap
    if (cost <= remaining) {
      visibility[col.id] = true
      reasons.set(col.id, 'fits-budget')
      remaining -= cost
    } else {
      reasons.set(col.id, 'exceeds-budget')
    }
  }

  return remaining
}

function buildDebug(
  columns: BudgetColumn[],
  containerWidth: number,
  shouldUseCardView: boolean,
  reason: BudgetColumnDebug['reason'],
): BudgetDebugInfo {
  const totalUsed = sumWidths(columns, DEFAULT_COLUMN_GAP)
  return {
    containerWidth,
    shouldUseCardView,
    totalBudgetUsed: totalUsed,
    totalBudgetAvailable: containerWidth,
    remainingBudget: containerWidth - totalUsed,
    columns: columns.map(col => ({
      id: col.id,
      priority: col.priority,
      measuredWidth: col.measuredWidth,
      visible: true,
      reason,
    })),
  }
}

function buildVisibilityMap(columns: BudgetColumn[], value: boolean): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const col of columns) {
    map[col.id] = value
  }
  return map
}
