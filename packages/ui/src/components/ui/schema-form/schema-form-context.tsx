"use client"

import { createContext, useContext } from "react"
import type { FormApi } from "@ghost/formr-core"
import type { SchemaFieldInfo } from "@ghost/formr-from-schema"

export interface SchemaFormContextValue {
  readonly form: FormApi<unknown, unknown>
  readonly fields: readonly SchemaFieldInfo[]
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
