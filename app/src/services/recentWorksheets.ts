import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const WORKSHEETS_SUBDIR = 'worksheets';
const INDEX_FILE = 'recent-worksheets.json';
const MAX_ITEMS = 20;

export type RecentWorksheet = {
  id: string;
  createdAt: number;
  title: string;
  imageUri: string;
};

function worksheetsDir(): string {
  const base = FileSystem.documentDirectory;
  if (!base) return '';
  return `${base}${WORKSHEETS_SUBDIR}/`;
}

function indexPath(): string {
  return `${FileSystem.documentDirectory ?? ''}${INDEX_FILE}`;
}

function isPersistedWorksheetUri(uri: string): boolean {
  if (Platform.OS === 'web') return false;
  const dir = worksheetsDir();
  return dir.length > 0 && uri.startsWith(dir);
}

function idFromPersistedUri(uri: string): string | null {
  const dir = worksheetsDir();
  if (!dir || !uri.startsWith(dir)) return null;
  const name = uri.slice(dir.length);
  const m = name.match(/^(.+)\.(jpe?g|png)$/i);
  return m?.[1] ?? null;
}

async function ensureWorksheetsDir(): Promise<void> {
  const dir = worksheetsDir();
  if (!dir) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function loadIndex(): Promise<RecentWorksheet[]> {
  if (Platform.OS === 'web') return [];
  const path = indexPath();
  if (!FileSystem.documentDirectory) return [];
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentWorksheet =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as RecentWorksheet).id === 'string' &&
        typeof (x as RecentWorksheet).imageUri === 'string' &&
        typeof (x as RecentWorksheet).createdAt === 'number' &&
        typeof (x as RecentWorksheet).title === 'string'
    );
  } catch {
    return [];
  }
}

async function saveIndex(items: RecentWorksheet[]): Promise<void> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return;
  const path = indexPath();
  await FileSystem.writeAsStringAsync(path, JSON.stringify(items));
}

async function deleteFileIfExists(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export type RegisterWorksheetOptions = {
  /** Shown in Recent worksheets (max 120 chars, trimmed). */
  title?: string;
};

/**
 * Copy a picker/camera URI into app storage (if needed), add to recents, return URI for display/processing.
 * On web, returns the source URI unchanged and does not persist.
 */
export async function registerWorksheetUse(
  sourceUri: string,
  options?: RegisterWorksheetOptions
): Promise<{
  uri: string;
  id: string | null;
}> {
  if (Platform.OS === 'web') {
    return { uri: sourceUri, id: null };
  }

  if (isPersistedWorksheetUri(sourceUri)) {
    const id = idFromPersistedUri(sourceUri);
    if (id) await touchRecentById(id);
    return { uri: sourceUri, id };
  }

  await ensureWorksheetsDir();
  const id = newId();
  const dest = `${worksheetsDir()}${id}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });

  const initialTitle = options?.title?.trim().slice(0, 120) || 'Worksheet';

  const item: RecentWorksheet = {
    id,
    createdAt: Date.now(),
    title: initialTitle,
    imageUri: dest,
  };

  const list = await loadIndex();
  const next = [item, ...list.filter((w) => w.id !== id)].slice(0, MAX_ITEMS);
  const removed = list.filter((w) => !next.some((n) => n.id === w.id));
  await saveIndex(next);
  for (const w of removed) {
    await deleteFileIfExists(w.imageUri);
  }

  return { uri: dest, id };
}

export async function getRecentWorksheetById(id: string): Promise<RecentWorksheet | null> {
  if (Platform.OS === 'web') return null;
  const list = await loadIndex();
  return list.find((w) => w.id === id) ?? null;
}

export async function getRecentWorksheets(): Promise<RecentWorksheet[]> {
  const list = await loadIndex();
  const withFiles: RecentWorksheet[] = [];
  for (const w of list) {
    try {
      const info = await FileSystem.getInfoAsync(w.imageUri);
      if (info.exists) withFiles.push(w);
    } catch {
      /* skip missing */
    }
  }
  if (withFiles.length !== list.length) {
    await saveIndex(withFiles);
  }
  return withFiles;
}

async function touchRecentById(id: string): Promise<void> {
  const list = await loadIndex();
  const idx = list.findIndex((w) => w.id === id);
  if (idx <= 0) return;
  const item = list[idx];
  const next = [item, ...list.filter((_, i) => i !== idx)];
  await saveIndex(next);
}

export async function updateRecentTitle(id: string, title: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const trimmed = title.trim().slice(0, 120) || 'Worksheet';
  const list = await loadIndex();
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) return;
  const next = [...list];
  next[idx] = { ...next[idx], title: trimmed };
  await saveIndex(next);
}

/**
 * Delete a worksheet by ID, removing both the image file and index entry.
 */
export async function deleteWorksheet(id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const list = await loadIndex();
  const item = list.find((w) => w.id === id);
  if (!item) return;

  // Delete the image file
  await deleteFileIfExists(item.imageUri);

  // Remove from index
  const next = list.filter((w) => w.id !== id);
  await saveIndex(next);
}
