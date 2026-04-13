/**
 * Minimal static file server using Node.js built-in APIs.
 *
 * Streams files from disk with correct Content-Type headers.
 * No external dependencies — uses node:fs createReadStream and node:path.
 */

import { createReadStream, statSync } from "node:fs";
import { extname } from "node:path";
import type { ServerResponse } from "node:http";

const MIME_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

const DEFAULT_MIME = "application/octet-stream";

/**
 * Streams a file from `filePath` to the HTTP response.
 *
 * - Determines Content-Type from extension.
 * - Returns 404 if the file does not exist or is not a regular file.
 * - Returns 500 on unexpected read errors.
 * - Sets Cache-Control: no-cache (dev-mode parity with live Vite).
 */
export function serveStaticFile(
  res: ServerResponse,
  filePath: string,
): void {
  let stat: ReturnType<typeof statSync> | undefined;
  try {
    stat = statSync(filePath);
  } catch {
    // File not found
  }

  if (!stat || !stat.isFile()) {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain");
    res.end("Not found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? DEFAULT_MIME;

  res.statusCode = 200;
  res.setHeader("content-type", contentType);
  res.setHeader("content-length", Number(stat.size));
  res.setHeader("cache-control", "no-cache");

  const stream = createReadStream(filePath);
  stream.pipe(res);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
    }
    res.end("Internal server error");
  });
}
