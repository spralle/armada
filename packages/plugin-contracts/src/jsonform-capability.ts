import type { ConfigurationPropertySchema } from './types.js';

/** Schema passed to the jsonform capability — must be an object schema with properties */
export interface JsonFormSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, ConfigurationPropertySchema>>;
  readonly required?: readonly string[] | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
}

/** Options for mounting a jsonform */
export interface JsonFormOptions {
  readonly schema: JsonFormSchema;
  readonly data: Readonly<Record<string, unknown>>;
  readonly onChange: (path: string, value: unknown) => void;
}

/** Controller returned from mount — manages form lifecycle */
export interface JsonFormController {
  update(options: Partial<Pick<JsonFormOptions, 'data'>>): void;
  unmount(): void;
}

/** The jsonform component capability contract */
export interface JsonFormCapability {
  mount(target: HTMLElement, options: JsonFormOptions): JsonFormController;
}
