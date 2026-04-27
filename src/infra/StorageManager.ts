/**
 * StorageManager - localStorageへのデータ永続化を管理するコンポーネント
 *
 * 全データはブラウザのlocalStorageにJSON形式で保存される。
 * 容量超過時のエラーハンドリングを含む。
 */

import type { StorageKey, StorageUsage } from '../types';

/** アプリケーション用のlocalStorageキープレフィックス */
const STORAGE_PREFIX = 'ai_daily_english_';

/** localStorage最大容量の推定値（5MB） */
const MAX_STORAGE_BYTES = 5 * 1024 * 1024;

/**
 * StorageKeyにプレフィックスを付与して実際のlocalStorageキーを生成する
 */
function getPrefixedKey(key: StorageKey): string {
  return `${STORAGE_PREFIX}${key}`;
}

/**
 * データをlocalStorageに保存する。
 * JSON シリアライズして格納し、容量超過時はエラーをスローする。
 *
 * @throws Error 容量超過時に「ストレージ容量が不足しています」エラーをスロー
 */
export function save<T>(key: StorageKey, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(getPrefixedKey(key), serialized);
  } catch (error: unknown) {
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      throw new Error(
        'ストレージ容量が不足しています。古い履歴を削除してください。'
      );
    }
    throw error;
  }
}

/**
 * localStorageからデータを取得する。
 * JSON デシリアライズして返却し、キーが存在しない場合やパースエラー時はnullを返す。
 */
export function load<T>(key: StorageKey): T | null {
  try {
    const serialized = localStorage.getItem(getPrefixedKey(key));
    if (serialized === null) {
      return null;
    }
    return JSON.parse(serialized) as T;
  } catch {
    return null;
  }
}

/**
 * localStorageから指定キーのデータを削除する。
 */
export function remove(key: StorageKey): void {
  localStorage.removeItem(getPrefixedKey(key));
}

/**
 * アプリケーション用の全データをlocalStorageからクリアする。
 * プレフィックス付きのキーのみを削除し、他アプリのデータには影響しない。
 */
export function clear(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && key.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

/**
 * アプリケーションが使用しているストレージ容量を取得する。
 * プレフィックス付きキーのデータサイズを合計し、推定最大容量に対する割合を返す。
 */
export function getUsage(): StorageUsage {
  let usedBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && key.startsWith(STORAGE_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        // UTF-16エンコーディングを考慮: 各文字は2バイト
        usedBytes += (key.length + value.length) * 2;
      }
    }
  }

  return {
    usedBytes,
    maxBytes: MAX_STORAGE_BYTES,
    percentage: MAX_STORAGE_BYTES > 0
      ? Math.round((usedBytes / MAX_STORAGE_BYTES) * 10000) / 100
      : 0,
  };
}
