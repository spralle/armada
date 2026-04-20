"use client"

import type { ReactNode } from "react"
import type { FormApi } from "@ghost/formr-core"
import type { LayoutNode, SchemaFieldInfo } from "@ghost/formr-from-schema"
import { fieldId, descriptionId, errorId } from "@ghost/formr-react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldGroup,
  FieldLegend,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"

import { mapFieldToWidget } from "./field-mapping"

function getNodeProp(node: LayoutNode, key: string): unknown {
  return (node.props as Readonly<Record<string, unknown>> | undefined)?.[key]
}

export interface SchemaRendererProps {
  readonly node: LayoutNode
  readonly form: FormApi<unknown, unknown>
  readonly fields: readonly SchemaFieldInfo[]
}

/** Render a layout tree node, dispatching to the correct Ghost renderer */
export function renderNode(
  node: LayoutNode,
  form: FormApi<unknown, unknown>,
  fields: readonly SchemaFieldInfo[],
): ReactNode {
  switch (node.type) {
    case "field":
      return <GhostFieldRenderer node={node} form={form} fields={fields} key={node.id} />
    case "group":
      return (
        <GhostGroupRenderer node={node} form={form} fields={fields} key={node.id}>
          {node.children?.map((child) => renderNode(child, form, fields))}
        </GhostGroupRenderer>
      )
    case "section":
      return (
        <GhostSectionRenderer node={node} form={form} fields={fields} key={node.id}>
          {node.children?.map((child) => renderNode(child, form, fields))}
        </GhostSectionRenderer>
      )
    case "array":
      return <GhostArrayRenderer node={node} form={form} fields={fields} key={node.id} />
    default:
      return null
  }
}

function capitalize(s: string): string {
  const last = s.split(".").pop() ?? s
  return last.charAt(0).toUpperCase() + last.slice(1)
}

function GhostFieldRenderer({ node, form, fields }: SchemaRendererProps) {
  const fieldInfo = fields.find((f) => f.path === node.path)
  if (!fieldInfo || !node.path) return null

  const fieldApi = form.field(node.path as never)
  const mapping = mapFieldToWidget(fieldInfo)
  const issues = fieldApi.issues()
  const errorIssues = issues.filter((i) => i.severity === "error")
  const hasErrors = errorIssues.length > 0
  const hasDescription = !!fieldInfo.metadata?.description
  const title = fieldInfo.metadata?.title ?? fieldInfo.metadata?.label ?? capitalize(node.path)
  const id = fieldId(node.path)

  const describedByParts: string[] = []
  if (hasDescription) describedByParts.push(descriptionId(node.path))
  if (hasErrors) describedByParts.push(errorId(node.path))
  const ariaDescribedBy = describedByParts.length > 0 ? describedByParts.join(" ") : undefined

  const commonProps = {
    id,
    "aria-invalid": hasErrors || undefined,
    "aria-describedby": ariaDescribedBy,
    "aria-required": fieldInfo.required || undefined,
  }

  return (
    <Field data-invalid={hasErrors || undefined}>
      <FieldLabel htmlFor={id}>{title}</FieldLabel>
      {renderWidget(fieldApi, fieldInfo, mapping, commonProps)}
      {hasDescription && (
        <FieldDescription id={descriptionId(node.path)}>
          {fieldInfo.metadata?.description}
        </FieldDescription>
      )}
      {hasErrors && (
        <FieldError id={errorId(node.path)}>
          {errorIssues.map((i) => i.message).join(", ")}
        </FieldError>
      )}
    </Field>
  )
}

function renderWidget(
  fieldApi: ReturnType<FormApi<unknown, unknown>["field"]>,
  fieldInfo: SchemaFieldInfo,
  mapping: ReturnType<typeof mapFieldToWidget>,
  commonProps: Record<string, unknown>,
): ReactNode {
  const value = fieldApi.get()
  const { htmlAttrs } = mapping

  switch (mapping.widget) {
    case "input":
      return (
        <Input
          {...commonProps}
          type={mapping.inputType ?? "text"}
          step={mapping.inputStep}
          value={value == null ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value
            const parsed = mapping.inputType === "number" ? (raw === "" ? "" : Number(raw)) : raw
            fieldApi.handleChange(parsed as never)
          }}
          onBlur={() => fieldApi.handleBlur()}
          {...htmlAttrs}
        />
      )

    case "textarea":
      return (
        <Textarea
          {...commonProps}
          value={value == null ? "" : String(value)}
          onChange={(e) => fieldApi.handleChange(e.target.value as never)}
          onBlur={() => fieldApi.handleBlur()}
          {...htmlAttrs}
        />
      )

    case "switch":
      return (
        <Switch
          {...commonProps}
          checked={!!value}
          onCheckedChange={(val) => fieldApi.handleChange(val as never)}
        />
      )

    case "slider":
      return (
        <Slider
          {...commonProps}
          value={[typeof value === "number" ? value : 0]}
          onValueChange={([v]) => fieldApi.handleChange(v as never)}
          min={typeof htmlAttrs.min === "number" ? htmlAttrs.min : 0}
          max={typeof htmlAttrs.max === "number" ? htmlAttrs.max : 100}
          step={mapping.inputStep === "1" ? 1 : 0.01}
        />
      )

    case "select":
      return renderSelect(fieldApi, fieldInfo, commonProps)

    case "radio-group":
      return renderRadioGroup(fieldApi, fieldInfo, commonProps)

    default:
      return null
  }
}

function renderSelect(
  fieldApi: ReturnType<FormApi<unknown, unknown>["field"]>,
  fieldInfo: SchemaFieldInfo,
  commonProps: Record<string, unknown>,
): ReactNode {
  const values = (fieldInfo.metadata?.enum ?? fieldInfo.metadata?.options ?? []) as readonly unknown[]
  return (
    <Select
      value={fieldApi.get() == null ? "" : String(fieldApi.get())}
      onValueChange={(v) => fieldApi.handleChange(v as never)}
    >
      <SelectTrigger {...commonProps}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((v) => (
          <SelectItem key={String(v)} value={String(v)}>
            {String(v)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function renderRadioGroup(
  fieldApi: ReturnType<FormApi<unknown, unknown>["field"]>,
  fieldInfo: SchemaFieldInfo,
  commonProps: Record<string, unknown>,
): ReactNode {
  const values = (fieldInfo.metadata?.enum ?? fieldInfo.metadata?.options ?? []) as readonly unknown[]
  return (
    <RadioGroup
      {...commonProps}
      value={fieldApi.get() == null ? "" : String(fieldApi.get())}
      onValueChange={(v) => fieldApi.handleChange(v as never)}
    >
      {values.map((v) => (
        <div key={String(v)} className="flex items-center gap-2">
          <RadioGroupItem value={String(v)} id={`${commonProps.id}-${String(v)}`} />
          <Label htmlFor={`${commonProps.id}-${String(v)}`}>{String(v)}</Label>
        </div>
      ))}
    </RadioGroup>
  )
}

export function GhostGroupRenderer({
  node,
  children,
}: SchemaRendererProps & { readonly children?: ReactNode }) {
  const title = getNodeProp(node, 'title') as string | undefined
  return (
    <FieldGroup>
      {title && <FieldLegend>{title}</FieldLegend>}
      {children}
    </FieldGroup>
  )
}

export function GhostSectionRenderer({
  node,
  children,
}: SchemaRendererProps & { readonly children?: ReactNode }) {
  const title = getNodeProp(node, 'title') as string | undefined
  const description = getNodeProp(node, 'description') as string | undefined
  return (
    <FieldSet>
      {title && <FieldLegend>{title}</FieldLegend>}
      {description && <FieldDescription>{description}</FieldDescription>}
      {children}
    </FieldSet>
  )
}

export function GhostArrayRenderer({ node, form, fields }: SchemaRendererProps) {
  if (!node.path) return null

  const fieldApi = form.field(node.path as never)
  const arrayValue = (fieldApi.get() ?? []) as readonly unknown[]
  const title = getNodeProp(node, 'title') as string | undefined
  const maxItems = getNodeProp(node, 'maxItems') as number | undefined
  const canAdd = maxItems === undefined || arrayValue.length < maxItems

  const hasArrayHelpers = typeof (fieldApi as Record<string, unknown>)['pushValue'] === 'function'
  const arrayHelpers = fieldApi as unknown as {
    pushValue(item: unknown): unknown
    removeValue(index: number): unknown
  }

  return (
    <FieldSet>
      <div className="flex items-center justify-between">
        {title && <FieldLegend>{title}</FieldLegend>}
        {canAdd && hasArrayHelpers && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => arrayHelpers.pushValue(undefined)}
          >
            Add
          </Button>
        )}
      </div>
      {arrayValue.map((_, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1">
            {node.children?.map((child) => {
              const indexedPath = child.path
                ? child.path.replace(`${node.path}.`, `${node.path}.${index}.`)
                : child.path
              const indexedChild: LayoutNode = {
                ...child,
                id: `${child.id}-${index}`,
                ...(indexedPath !== undefined ? { path: indexedPath } : {}),
              }
              return renderNode(indexedChild, form, fields)
            })}
          </div>
          {hasArrayHelpers && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => arrayHelpers.removeValue(index)}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
    </FieldSet>
  )
}
