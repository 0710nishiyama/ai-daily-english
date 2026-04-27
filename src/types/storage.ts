/**
 * Storage and encryption related types
 * ストレージ・暗号化関連の型定義
 */

export interface EncryptedData {
  cipherText: string;
  iv: string;
  salt: string;
}

export type StorageKey =
  | 'api_keys'
  | 'lesson_history'
  | 'progress_data'
  | 'curriculum_state'
  | 'user_settings'
  | 'user_account';

export interface StorageUsage {
  usedBytes: number;
  maxBytes: number;
  percentage: number;
}
