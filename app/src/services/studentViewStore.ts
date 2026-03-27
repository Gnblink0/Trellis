import type { AdaptedZone } from '../navigation/types';

/**
 * Lightweight module-level store for passing large adaptation data
 * from WorksheetViewScreen to StudentViewScreen without going through
 * React Navigation params (which serializes everything to JSON and
 * chokes on multi-MB base64 visualUrls).
 */

let _pending: { title: string; adaptations: AdaptedZone[]; imageUri?: string } | null = null;

export function setStudentViewData(data: typeof _pending) {
  _pending = data;
}

export function consumeStudentViewData() {
  const data = _pending;
  _pending = null;
  return data;
}
