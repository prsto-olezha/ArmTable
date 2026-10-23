import { invoke } from '@tauri-apps/api/core';
import type { AppData } from '../types';

const LS_KEY = 'armtable-data';

/** true, если фронтенд работает внутри оболочки Tauri (иначе — обычный браузер) */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

export async function loadData(): Promise<AppData | null> {
  if (isTauri()) {
    try {
      const raw = await invoke<string | null>('load_data');
      return raw ? (JSON.parse(raw) as AppData) : null;
    } catch (e) {
      console.error('load_data failed:', e);
      return null;
    }
  }
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

export async function saveData(data: AppData): Promise<void> {
  const raw = JSON.stringify(data);
  if (isTauri()) {
    try {
      await invoke('save_data', { data: raw });
      return;
    } catch (e) {
      console.error('save_data failed:', e);
    }
  }
  localStorage.setItem(LS_KEY, raw);
}
