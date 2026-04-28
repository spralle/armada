/** Contract for measuring column content widths without DOM reflow. */
export interface ColumnMeasurer {
  /**
   * Measure a column's effective width given sample cell values.
   * Returns the recommended width in pixels (typically p90 of measured values + padding).
   */
  measureColumn(values: string[], font: string): number
}

/**
 * Character-count heuristic measurer for when no text measurement library is available.
 * Uses average character width × p90 string length as an approximation.
 */
export function createFallbackMeasurer(avgCharWidth = 8): ColumnMeasurer {
  return {
    measureColumn(values: string[], _font: string): number {
      if (values.length === 0) return 80

      const lengths = values.map((v) => v.length).sort((a, b) => a - b)
      const p90Index = Math.floor(lengths.length * 0.9)
      const p90Length =
        lengths[p90Index] ?? lengths[lengths.length - 1] ?? 10

      return Math.max(40, Math.ceil(p90Length * avgCharWidth))
    },
  }
}
