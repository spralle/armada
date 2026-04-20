"use client"

import { useCallback } from "react"
import { useSchemaForm } from "@ghost/formr-react"
import type { UseSchemaFormOptions } from "@ghost/formr-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SchemaFormProvider } from "./schema-form-context"
import { renderNode } from "./renderers"

export interface SchemaFormProps {
  readonly schema: unknown
  readonly initialData?: Record<string, unknown>
  readonly onSubmit?: (data: unknown) => void | Promise<void>
  readonly className?: string
  readonly children?: React.ReactNode
  readonly options?: Omit<UseSchemaFormOptions<unknown, unknown>, "initialData">
}

export function SchemaForm({
  schema,
  initialData,
  onSubmit,
  className,
  children,
  options,
}: SchemaFormProps) {
  const { form, fields, layout } = useSchemaForm(schema, {
    ...options,
    initialData: initialData as never,
  })

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const result = await form.submit()
      if (result.ok && onSubmit) {
        await onSubmit(form.getState().data)
      }
    },
    [form, onSubmit],
  )

  return (
    <SchemaFormProvider value={{ form, fields }}>
      <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} noValidate>
        {layout.children?.map((node) => renderNode(node, form, fields))}
        {children ?? (
          <Button type="submit" disabled={!form.canSubmit()}>
            Submit
          </Button>
        )}
      </form>
    </SchemaFormProvider>
  )
}
