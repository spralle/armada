import type { Middleware, MiddlewareDecision, MiddlewareInitContext } from './contracts.js';
import { withTimeout, DEFAULT_RUNTIME_CONSTRAINTS } from './extensions.js';
import { FormrError } from './errors.js';

/** Run veto-capable hooks synchronously (for non-submit pipeline path) */
export function runVetoHooksSync<S extends string>(
  middlewares: readonly Middleware<S>[],
  hookName: 'beforeAction' | 'beforeSubmit',
  context: unknown,
): MiddlewareDecision {
  for (const mw of middlewares) {
    const hook = mw[hookName];
    if (!hook) continue;
    try {
      const result = hook(context as never);
      if (isPromiseLike(result)) {
        throw new FormrError(
          'FORMR_ASYNC_IN_SYNC_PIPELINE',
          `Middleware "${mw.id}" returned a Promise from ${hookName}. Use the async pipeline path for async middleware.`,
        );
      }
      if (result && typeof result === 'object' && 'action' in result) {
        if ((result as MiddlewareDecision).action === 'veto') {
          return result as MiddlewareDecision;
        }
      }
    } catch (err) {
      if (err instanceof FormrError) throw err;
      return { action: 'veto', reason: `Middleware "${mw.id}" threw in ${hookName}` };
    }
  }
  return { action: 'continue' };
}

/** Run notification hooks synchronously (for non-submit pipeline path) */
export function runNotifyHooksSync<S extends string>(
  middlewares: readonly Middleware<S>[],
  hookName: 'beforeEvaluate' | 'afterEvaluate' | 'beforeValidate' | 'afterValidate' | 'afterAction' | 'afterSubmit',
  context: unknown,
): void {
  for (const mw of middlewares) {
    const hook = mw[hookName];
    if (!hook) continue;
    try {
      (hook as (c: unknown) => void)(context);
    } catch {
      // Swallow errors in sync notify hooks to match async variant behavior
    }
  }
}

/** Run veto-capable hooks with async support and timeout */
export async function runVetoHooksAsync<S extends string>(
  middlewares: readonly Middleware<S>[],
  hookName: 'beforeAction' | 'beforeSubmit',
  context: unknown,
  timeoutMs: number = DEFAULT_RUNTIME_CONSTRAINTS.middlewareTimeout,
): Promise<MiddlewareDecision> {
  for (const mw of middlewares) {
    const hook = mw[hookName];
    if (!hook) continue;
    try {
      const result = hook(context as never);
      const decision = isPromiseLike(result)
        ? await withTimeout(
            result as Promise<MiddlewareDecision>,
            timeoutMs,
            `Middleware "${mw.id}" timed out in ${hookName}`,
          )
        : (result as MiddlewareDecision);
      if (decision?.action === 'veto') return decision;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { action: 'veto', reason };
    }
  }
  return { action: 'continue' };
}

/** Run notification hooks with async support and timeout */
export async function runNotifyHooksAsync<S extends string>(
  middlewares: readonly Middleware<S>[],
  hookName: 'beforeEvaluate' | 'afterEvaluate' | 'beforeValidate' | 'afterValidate' | 'afterAction' | 'afterSubmit',
  context: unknown,
  timeoutMs: number = DEFAULT_RUNTIME_CONSTRAINTS.middlewareTimeout,
): Promise<void> {
  for (const mw of middlewares) {
    const hook = mw[hookName];
    if (!hook) continue;
    try {
      const result = (hook as (c: unknown) => unknown)(context);
      if (isPromiseLike(result)) {
        await withTimeout(
          result as Promise<unknown>,
          timeoutMs,
          `Middleware "${mw.id}" timed out in ${hookName}`,
        );
      }
    } catch {
      // Swallow errors/timeouts in notify hooks
    }
  }
}

/** Run onInit on all middlewares in registration order */
export function initMiddlewares<S extends string>(
  middlewares: readonly Middleware<S>[],
  context: MiddlewareInitContext<S>,
): void {
  for (const mw of middlewares) {
    if (mw.onInit) {
      try {
        mw.onInit(context);
      } catch {
        // Swallow init errors
      }
    }
  }
}

/** Run onDispose on all middlewares in registration order */
export function disposeMiddlewares<S extends string>(
  middlewares: readonly Middleware<S>[],
): void {
  for (const mw of middlewares) {
    if (mw.onDispose) {
      try {
        mw.onDispose();
      } catch {
        // Swallow dispose errors
      }
    }
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return value !== null && typeof value === 'object' && typeof (value as { then?: unknown }).then === 'function';
}
