/**
 * CryptoUtil - Web Crypto API（AES-GCM）による暗号化・復号化ユーティリティ
 *
 * APIキーなどの機密データをlocalStorageに安全に保存するために使用する。
 * Web Crypto API非対応ブラウザではBase64エンコーディングにフォールバックする（セキュリティ警告付き）。
 */

import type { EncryptedData } from '../types';

/**
 * AES-GCM暗号化で使用する固定パスフレーズ。
 * クライアントサイドのみで使用されるため、完全な秘匿性は保証しないが、
 * localStorageの平文保存よりもセキュリティを向上させる。
 */
const PASSPHRASE = 'ai-daily-english-local-encryption-key';

/** AES-GCMのキー長（ビット） */
const AES_KEY_LENGTH = 256;

/** PBKDF2の反復回数 */
const PBKDF2_ITERATIONS = 100000;

/** ソルトのバイト長 */
const SALT_LENGTH = 16;

/** 初期化ベクトル（IV）のバイト長 */
const IV_LENGTH = 12;

/** Base64フォールバック時のマーカー（IVとsaltに使用） */
const BASE64_FALLBACK_MARKER = 'base64-fallback';

/**
 * Web Crypto APIが利用可能かどうかを判定する
 */
function isCryptoAvailable(): boolean {
  return (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined'
  );
}

/**
 * Uint8ArrayをBase64文字列に変換する
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64文字列をUint8Arrayに変換する
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * パスフレーズとソルトからAES-GCM暗号化キーを導出する（PBKDF2）
 */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(PASSPHRASE),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * テキストをAES-GCMで暗号化する。
 * Web Crypto API非対応ブラウザではBase64エンコーディングにフォールバックする。
 *
 * @param plainText 暗号化する平文テキスト
 * @returns 暗号化データ（cipherText, iv, salt はすべてBase64エンコード）
 */
export async function encrypt(plainText: string): Promise<EncryptedData> {
  if (!isCryptoAvailable()) {
    console.warn(
      '[CryptoUtil] Web Crypto APIが利用できません。Base64エンコーディングにフォールバックします。' +
        'この方法は暗号化ではないため、セキュリティが低下します。'
    );
    return encryptBase64Fallback(plainText);
  }

  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainText)
  );

  return {
    cipherText: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
  };
}

/**
 * AES-GCMで暗号化されたデータを復号化する。
 * Base64フォールバックで暗号化されたデータも復号化できる。
 *
 * @param encryptedData 暗号化データ
 * @returns 復号化された平文テキスト
 * @throws Error 復号化に失敗した場合
 */
export async function decrypt(encryptedData: EncryptedData): Promise<string> {
  if (
    encryptedData.iv === BASE64_FALLBACK_MARKER &&
    encryptedData.salt === BASE64_FALLBACK_MARKER
  ) {
    return decryptBase64Fallback(encryptedData);
  }

  if (!isCryptoAvailable()) {
    throw new Error(
      'Web Crypto APIが利用できないため、AES-GCM暗号化データを復号化できません。'
    );
  }

  const salt = base64ToArrayBuffer(encryptedData.salt);
  const iv = base64ToArrayBuffer(encryptedData.iv);
  const cipherText = base64ToArrayBuffer(encryptedData.cipherText);
  const key = await deriveKey(salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherText
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Base64フォールバック: テキストをBase64エンコードする（暗号化ではない）
 */
function encryptBase64Fallback(plainText: string): EncryptedData {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(plainText);
  return {
    cipherText: arrayBufferToBase64(encoded),
    iv: BASE64_FALLBACK_MARKER,
    salt: BASE64_FALLBACK_MARKER,
  };
}

/**
 * Base64フォールバック: Base64エンコードされたテキストをデコードする
 */
function decryptBase64Fallback(encryptedData: EncryptedData): string {
  const bytes = base64ToArrayBuffer(encryptedData.cipherText);
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}
