import type {
  ProcessRequest,
  ProcessResponse,
  RegenerateRequest,
  RegenerateResponse,
  ApiError,
  OcrScanResponse,
} from '@trellis/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const TIMEOUT_MS = 120_000;

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

async function request<T>(
  path: string,
  body: unknown
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = await res.json();

    if (!res.ok) {
      return { ok: false, error: json as ApiError };
    }

    return { ok: true, data: json as T };
  } catch (err) {
    // RN/Hermes has no global DOMException; use name check (works for web + native abort).
    const isAbort =
      err != null &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'AbortError';
    if (isAbort) {
      return {
        ok: false,
        error: { code: 'AI_TIMEOUT', message: 'Request timed out. Please try again.' },
      };
    }
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Network error. Is the server running?',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export function processWorksheet(
  body: ProcessRequest
): Promise<ApiResult<ProcessResponse>> {
  return request<ProcessResponse>('/api/adapt/process', body);
}

export function regenerateAdaptation(
  body: RegenerateRequest
): Promise<ApiResult<RegenerateResponse>> {
  return request<RegenerateResponse>('/api/adapt/regenerate', body);
}

export function scanImageOcr(imageBase64: string): Promise<ApiResult<OcrScanResponse>> {
  return request<OcrScanResponse>('/api/ocr/scan', { imageBase64 });
}
