import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { AdaptedZone } from '../navigation/types';
import type { DrawingData } from '../components/DrawingCanvas';

const SESSIONS_SUBDIR = 'sessions';

export type WorksheetSession = {
  worksheetId: string;
  updatedAt: number;
  title: string;
  imageUri?: string;
  adaptations: AdaptedZone[];
  drawingData: DrawingData;
};

function sessionsDir(): string {
  const base = FileSystem.documentDirectory;
  if (!base) return '';
  return `${base}${SESSIONS_SUBDIR}/`;
}

function sessionPath(worksheetId: string): string {
  return `${sessionsDir()}${worksheetId}.json`;
}

async function ensureSessionsDir(): Promise<void> {
  const dir = sessionsDir();
  if (!dir) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function saveSession(session: WorksheetSession): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ensureSessionsDir();
    const path = sessionPath(session.worksheetId);
    await FileSystem.writeAsStringAsync(path, JSON.stringify(session));
  } catch (e) {
    console.error('[worksheetSessionStore] saveSession', e);
  }
}

export async function loadSession(worksheetId: string): Promise<WorksheetSession | null> {
  if (Platform.OS === 'web') return null;
  try {
    const path = sessionPath(worksheetId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as WorksheetSession;
  } catch {
    return null;
  }
}

export async function hasSession(worksheetId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const path = sessionPath(worksheetId);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

export async function deleteSession(worksheetId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const path = sessionPath(worksheetId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
}
