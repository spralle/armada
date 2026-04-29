import type { TableFieldOverride } from "@ghost-shell/table-from-schema";
import { useLayoutEffect, useRef, useState } from "react";
import type { ZodObject, ZodRawShape } from "zod";
import type { EntityCardListProps } from "./entity-card-list.js";
import { EntityCardList } from "./entity-card-list.js";
import { EntityList } from "./entity-list.js";
import type { EntityListProps } from "./entity-list-types.js";

export interface ResponsiveEntityProps<TData extends Record<string, unknown>> {
  /** Zod schema */
  schema: ZodObject<ZodRawShape>;
  /** Data */
  data: TData[];
  /** Shared overrides (apply to both table and cards) */
  overrides?: Record<string, TableFieldOverride>;
  /** Fields to include */
  include?: string[];
  /** Fields to exclude */
  exclude?: string[];
  /** Width threshold to switch to card view (px). Default: 480 */
  cardThreshold?: number;
  /** External container ref to observe */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** Entity type identifier for table mode (defaults to 'entity') */
  entityType?: string;
  /** Props specific to table mode */
  tableProps?: Partial<
    Omit<EntityListProps<TData>, "schema" | "data" | "overrides" | "include" | "exclude" | "entityType">
  >;
  /** Props specific to card mode */
  cardProps?: Partial<Omit<EntityCardListProps<TData>, "schema" | "data" | "overrides" | "include" | "exclude">>;
  /** Row key accessor */
  getRowId?: (row: TData) => string;
}

export function ResponsiveEntity<TData extends Record<string, unknown>>({
  schema,
  data,
  overrides,
  include,
  exclude,
  cardThreshold = 480,
  containerRef: externalRef,
  entityType = "entity",
  tableProps,
  cardProps,
  getRowId,
}: ResponsiveEntityProps<TData>) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalRef ?? internalRef;
  const [useCardView, setUseCardView] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const check = (width: number) => setUseCardView(width < cardThreshold);
    check(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      check(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, cardThreshold]);

  return (
    <div ref={externalRef ? undefined : internalRef}>
      {useCardView ? (
        <EntityCardList
          schema={schema}
          data={data}
          overrides={overrides}
          include={include}
          exclude={exclude}
          getRowId={getRowId}
          {...cardProps}
        />
      ) : (
        <EntityList
          entityType={entityType}
          schema={schema}
          data={data}
          overrides={overrides}
          include={include}
          exclude={exclude}
          getRowId={getRowId}
          responsive={{
            enabled: true,
            containerRef,
            ...tableProps?.responsive,
          }}
          {...tableProps}
        />
      )}
    </div>
  );
}
