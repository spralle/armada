// Session lifecycle endpoints: activate, deactivate, status

import type { Route } from "./router.js";
import { jsonResponse } from "./router.js";
import type { GodModeSessionController } from "@weaver/config-providers";
import { sessionActivationRequestSchema } from "@weaver/config-types";

export function createSessionRoutes(options: {
  sessionController: GodModeSessionController;
}): Route[] {
  const { sessionController } = options;

  return [
    // POST /api/session/activate — create a new god-mode session
    {
      method: "POST",
      pattern: /^\/api\/session\/activate$/,
      handler: async (_params, request) => {
        const body = await request.body();
        const parsed = sessionActivationRequestSchema.safeParse(body);

        if (!parsed.success) {
          return jsonResponse(
            { error: "invalid_body", details: parsed.error.issues },
            400,
          );
        }

        if (sessionController.isActive()) {
          return jsonResponse(
            { error: "session_already_active" },
            409,
          );
        }

        const session = sessionController.activate(parsed.data);
        return jsonResponse(session);
      },
    },

    // POST /api/session/deactivate — end the current session
    {
      method: "POST",
      pattern: /^\/api\/session\/deactivate$/,
      handler: async () => {
        if (!sessionController.isActive()) {
          return jsonResponse(
            { error: "no_active_session" },
            404,
          );
        }

        const result = sessionController.deactivate();
        return jsonResponse(result);
      },
    },

    // GET /api/session/status — check session state
    {
      method: "GET",
      pattern: /^\/api\/session\/status$/,
      handler: () => {
        const session = sessionController.getSession();
        if (session !== null) {
          return jsonResponse({ active: true, session });
        }
        return jsonResponse({ active: false, session: null });
      },
    },
  ];
}
