import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { JsonFormCapability, JsonFormOptions, JsonFormController } from '@ghost-shell/contracts';
import { ErrorBoundary } from './ErrorBoundary.js';
import { JsonFormRoot } from './JsonFormRoot.js';

export function createJsonFormCapability(): JsonFormCapability {
  return {
    mount(target: HTMLElement, options: JsonFormOptions): JsonFormController {
      const root: Root = createRoot(target);
      let currentOptions = options;

      function render(opts: JsonFormOptions): void {
        root.render(
          <ErrorBoundary>
            <JsonFormRoot
              schema={opts.schema}
              data={opts.data}
              onChange={opts.onChange}
              layout={opts.layout}
            />
          </ErrorBoundary>,
        );
      }

      render(currentOptions);

      return {
        update(partial) {
          if (partial.data) {
            currentOptions = { ...currentOptions, data: partial.data };
            render(currentOptions);
          }
        },
        unmount() {
          root.unmount();
        },
      };
    },
  };
}
