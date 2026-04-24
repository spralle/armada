"use client"

import { createContext, useContext } from "react"
import type { FormApi } from "@ghost-shell/formr-core"
import type { SchemaFieldInfo } from "@ghost-shell/formr-from-schema"
import type { RendererRegistry } from "@ghost-shell/formr-react"
import type { WidgetOverrides } from "./widget-overrides"

export interface SchemaFormContextValue {
  readonly form: FormApi<unknown, unknown>
  readonly fields: readonly SchemaFieldInfo[]
  readonly overrides?: WidgetOverrides
  readonly registry: RendererRegistry
}

const SchemaFormContext = createContext<SchemaFormContextValue | null>(null)

export function SchemaFormProvider({
  value,
  children,
}: {
  readonly value: SchemaFormContextValue
  readonly children: React.ReactNode
}) {
  return (
    <SchemaFormContext.Provider value={value}>
      {children}
    </SchemaFormContext.Provider>
  )
}

export function useSchemaFormContext(): SchemaFormContextValue {
  const ctx = useContext(SchemaFormContext)
  if (!ctx) {
    throw new Error("useSchemaFormContext must be used within a SchemaForm")
  }
  return ctx
}
