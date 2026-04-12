export interface RouteParams {
  [key: string]: string;
}

export interface Route {
  method: "GET" | "POST" | "PUT" | "DELETE";
  pattern: RegExp;
  handler: (
    params: RouteParams,
    request: RequestInfo,
  ) => Response | Promise<Response>;
}

export interface RequestInfo {
  method: string;
  pathname: string;
  body: () => Promise<unknown>;
  headers: Record<string, string>;
  search?: string | undefined;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function createRouter(
  routes: Route[],
): (info: RequestInfo) => Response | Promise<Response> {
  return (info: RequestInfo): Response | Promise<Response> => {
    let methodMismatch = false;

    for (const route of routes) {
      const match = info.pathname.match(route.pattern);
      if (!match) {
        continue;
      }

      if (route.method !== info.method) {
        methodMismatch = true;
        continue;
      }

      const params: RouteParams = {};
      for (let i = 1; i < match.length; i++) {
        params[i - 1] = match[i];
      }

      return route.handler(params, info);
    }

    if (methodMismatch) {
      return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    return jsonResponse(
      {
        error: "not_found",
        message: `No route for ${info.pathname}`,
      },
      404,
    );
  };
}
