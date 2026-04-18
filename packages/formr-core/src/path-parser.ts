import type { CanonicalPath, CanonicalSegment, Namespace } from './path.js';
import { FormrError } from './errors.js';

const UI_PREFIX = '$ui.';
const NUMERIC_INDEX_RE = /^(?:0|[1-9]\d*)$/;
const DOT_SAFE_SEGMENT_RE = /^[a-zA-Z0-9_\-]+$/;

const PATH_CACHE_MAX = 1000;
const pathCache = new Map<string, CanonicalPath>();

/**
 * Parse any supported path notation into a CanonicalPath.
 * Accepts dot paths, $ui dot paths, and JSON Pointers (RFC 6901).
 * Results are cached by input string for repeated lookups.
 */
export function parsePath(input: string): CanonicalPath {
  const cached = pathCache.get(input);
  if (cached) return cached;

  if (input === '') {
    throw new FormrError('FORMR_PATH_EMPTY', 'Path must not be empty');
  }

  if (input.startsWith('$ui/')) {
    throw new FormrError(
      'FORMR_PATH_MIXED_NAMESPACE',
      'Mixed namespace form $ui/... is not allowed; use $ui. dot notation',
    );
  }

  let result: CanonicalPath;
  if (input.startsWith('/')) {
    result = parsePointer(input);
  } else {
    result = parseDot(input);
  }

  if (pathCache.size >= PATH_CACHE_MAX) {
    pathCache.clear();
  }
  pathCache.set(input, result);
  return result;
}

function parseDot(input: string): CanonicalPath {
  let namespace: Namespace = 'data';
  let raw = input;

  if (raw.startsWith('$ui.')) {
    namespace = 'ui';
    raw = raw.slice(UI_PREFIX.length);
  } else if (raw === '$ui') {
    throw new FormrError(
      'FORMR_PATH_INVALID_DOT',
      '$ui alone is not a valid path; at least one segment is required after $ui.',
    );
  }

  validateDotRaw(raw);

  const segments = raw.split('.').map(toDotSegment);
  return { namespace, segments };
}

function validateDotRaw(raw: string): void {
  if (raw === '') {
    throw new FormrError('FORMR_PATH_INVALID_DOT', 'Path has no segments after prefix');
  }
  if (raw.startsWith('.')) {
    throw new FormrError('FORMR_PATH_INVALID_DOT', 'Path must not start with a dot');
  }
  if (raw.endsWith('.')) {
    throw new FormrError('FORMR_PATH_INVALID_DOT', 'Path must not end with a dot');
  }
  if (raw.includes('..')) {
    throw new FormrError('FORMR_PATH_INVALID_DOT', 'Path must not contain consecutive dots');
  }
}

function toDotSegment(seg: string): CanonicalSegment {
  return NUMERIC_INDEX_RE.test(seg) ? Number(seg) : seg;
}

function parsePointer(input: string): CanonicalPath {
  // RFC 6901: "" is the whole document, "/foo" splits to ['', 'foo']
  const parts = input.split('/');
  // First element is always '' because input starts with '/'
  const rawSegments = parts.slice(1);

  // Detect $ui namespace prefix in pointer form: /$ui/...
  if (rawSegments.length > 0 && rawSegments[0] === '$ui') {
    const uiSegments = rawSegments.slice(1).map(decodePointerSegment);
    return { namespace: 'ui', segments: uiSegments };
  }

  const segments: CanonicalSegment[] = rawSegments.map(decodePointerSegment);
  return { namespace: 'data', segments };
}

function decodePointerSegment(raw: string): CanonicalSegment {
  validatePointerEscapes(raw);
  // RFC 6901 order: ~1 → /, then ~0 → ~
  return raw.replace(/~1/g, '/').replace(/~0/g, '~');
}

function validatePointerEscapes(raw: string): void {
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '~') {
      const next = raw[i + 1];
      if (next !== '0' && next !== '1') {
        throw new FormrError(
          'FORMR_PATH_INVALID_POINTER_ESCAPE',
          `Invalid JSON Pointer escape sequence ~${next ?? ''} at index ${i}`,
        );
      }
    }
  }
}

/**
 * Serialize a canonical data-namespace path to JSON Pointer (RFC 6901).
 */
export function toPointer(path: CanonicalPath): string {
  if (path.namespace === 'ui') {
    throw new FormrError(
      'FORMR_PATH_MIXED_NAMESPACE',
      'Cannot convert ui-namespace path to JSON Pointer',
    );
  }
  return '/' + path.segments.map(encodePointerSegment).join('/');
}

function encodePointerSegment(seg: CanonicalSegment): string {
  const s = String(seg);
  // RFC 6901 order: ~ → ~0, / → ~1
  return s.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Serialize a canonical path to dot notation.
 * Throws FORMR_PATH_NOT_DOT_SAFE if any segment contains characters
 * that cannot be represented unambiguously in dot notation.
 */
export function toDot(path: CanonicalPath): string {
  for (const seg of path.segments) {
    const s = String(seg);
    if (!DOT_SAFE_SEGMENT_RE.test(s)) {
      throw new FormrError(
        'FORMR_PATH_NOT_DOT_SAFE',
        `Segment "${s}" contains characters not representable in dot notation`,
      );
    }
    // String segments that look numeric are ambiguous in dot notation
    if (typeof seg === 'string' && NUMERIC_INDEX_RE.test(seg)) {
      throw new FormrError(
        'FORMR_PATH_NOT_DOT_SAFE',
        `String segment "${seg}" is ambiguous in dot notation (looks numeric)`,
      );
    }
  }

  const dotPath = path.segments.map(String).join('.');
  return path.namespace === 'ui' ? `$ui.${dotPath}` : dotPath;
}
