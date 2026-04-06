import type {
  DetectRequest,
  DetectResponse,
  ProcessRequest,
  ProcessResponse,
  RegenerateRequest,
  RegenerateResponse,
  ApiError,
  OcrScanResponse,
} from '@trellis/shared';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Auto-detect the API server URL.
 * - Env var override always wins.
 * - On native (Expo Go / dev client), extract the dev machine's LAN IP
 *   from Expo's hostUri so iPad/phone can reach the server without manual config.
 * - On web, localhost works fine.
 */
function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log('[API] Using env var:', envUrl);
    return envUrl;
  }

  if (Platform.OS !== 'web') {
    // hostUri format: "192.168.1.5:8081" (LAN IP : metro port)
    const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
    console.log('[API] Auto-detect hostUri:', hostUri);
    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip metro port
      const url = `http://${host}:3001`;
      console.log('[API] Auto-detected URL:', url);
      return url;
    }
  }

  console.log('[API] Fallback to localhost:3001');
  return 'http://localhost:3001';
}

const API_URL = resolveApiUrl();
console.log('[API] Final API_URL:', API_URL);
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

export function detectWorksheet(
  body: DetectRequest
): Promise<ApiResult<DetectResponse>> {
  return request<DetectResponse>('/api/adapt/detect', body);
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
