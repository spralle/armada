import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext'
import type { ColumnMeasurer } from '@ghost-shell/data-table'

/**
 * Creates a high-fidelity column measurer using pretext for accurate
 * text width calculation without DOM reflow.
 *
 * Requires @chenglou/pretext to be installed — if it isn't, this
 * module's import will fail at the call site (tree-shaking ensures
 * users who don't import this file never pull in pretext).
 */
export function createPretextMeasurer(defaultFont = '14px sans-serif'): ColumnMeasurer {
  return {
    measureColumn(values: string[], font: string = defaultFont): number {
      if (values.length === 0) return 80

      const widths = values.map((value) => {
        const prepared = prepareWithSegments(value, font)
        return measureNaturalWidth(prepared)
      })

      widths.sort((a, b) => a - b)
      const p90Index = Math.floor(widths.length * 0.9)
      const p90Width = widths[p90Index] ?? widths[widths.length - 1] ?? 80

      return Math.ceil(p90Width)
    },
  }
}
