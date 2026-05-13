import { AppData } from '@/types/storage';
import { loadAppData, saveAppData, validateAppData } from './storage';

export function exportBackupJson(): string {
  const data = loadAppData();
  return JSON.stringify(data, null, 2);
}

export function importBackupJson(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (validateAppData(data)) {
      saveAppData(data as AppData);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to import backup JSON', error);
    return false;
  }
}
