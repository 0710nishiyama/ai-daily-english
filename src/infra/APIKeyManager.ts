/**
 * APIKeyManager - AIプロバイダーのAPIキー管理コンポーネント
 *
 * APIキーの暗号化保存・復号化取得・削除・接続テスト・コスト推定・利用上限警告を提供する。
 * CryptoUtilとStorageManagerを利用し、APIキーはクライアントサイドのみで管理される。
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 12.1, 12.2, 12.3
 */

import type {
  AIProvider,
  ConnectionTestResult,
  CostEstimate,
  EncryptedData,
} from '../types';
import * as CryptoUtil from './CryptoUtil';
import * as StorageManager from './StorageManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** localStorageに保存されるAPIキーのレコード構造 */
interface ApiKeyRecord {
  provider: AIProvider;
  encryptedKey: EncryptedData;
  savedAt: number;
}

/** localStorageに保存されるAPIキーマップ */
type ApiKeysMap = Partial<Record<AIProvider, ApiKeyRecord>>;

/** ユーザー設定（StorageManagerで永続化） */
interface UserSettings {
  activeProvider?: AIProvider;
  speechRate?: number;
  showHints?: boolean;
  showJapanese?: boolean;
  difficultyLevel?: string;
  monthlyLessonLimit?: number;
  monthlyLessonCount?: number;
  monthlyLessonCountResetMonth?: string; // "YYYY-MM" 形式
}

// ---------------------------------------------------------------------------
// Cost estimation data
// ---------------------------------------------------------------------------

/** プロバイダーごとの推定コスト（USD） */
const COST_ESTIMATES: Record<AIProvider, CostEstimate> = {
  openai: {
    perLesson: 0.02,
    perMonth: 0.02 * 30,
    currency: 'USD',
  },
  gemini: {
    perLesson: 0.01,
    perMonth: 0.01 * 30,
    currency: 'USD',
  },
  claude: {
    perLesson: 0.03,
    perMonth: 0.03 * 30,
    currency: 'USD',
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** APIキーマップをStorageManagerから読み込む */
function loadApiKeys(): ApiKeysMap {
  return StorageManager.load<ApiKeysMap>('api_keys') ?? {};
}

/** APIキーマップをStorageManagerに保存する */
function saveApiKeys(keys: ApiKeysMap): void {
  StorageManager.save('api_keys', keys);
}

/** ユーザー設定をStorageManagerから読み込む */
function loadSettings(): UserSettings {
  return StorageManager.load<UserSettings>('user_settings') ?? {};
}

/** ユーザー設定をStorageManagerに保存する */
function saveSettings(settings: UserSettings): void {
  StorageManager.save('user_settings', settings);
}

/**
 * 現在の年月を "YYYY-MM" 形式で返す
 */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * APIキーを暗号化してlocalStorageに保存する。
 * 保存後、アクティブプロバイダーとして設定する。
 *
 * @param provider AIプロバイダー種別
 * @param apiKey 平文のAPIキー文字列
 */
export async function saveApiKey(
  provider: AIProvider,
  apiKey: string,
): Promise<void> {
  const encryptedKey = await CryptoUtil.encrypt(apiKey);
  const keys = loadApiKeys();
  keys[provider] = {
    provider,
    encryptedKey,
    savedAt: Date.now(),
  };
  saveApiKeys(keys);

  // アクティブプロバイダーとして設定
  const settings = loadSettings();
  settings.activeProvider = provider;
  saveSettings(settings);
}

/**
 * 指定プロバイダーのAPIキーを復号化して取得する。
 * キーが保存されていない場合はnullを返す。
 *
 * @param provider AIプロバイダー種別
 * @returns 復号化されたAPIキー文字列、または null
 */
export async function getApiKey(
  provider: AIProvider,
): Promise<string | null> {
  const keys = loadApiKeys();
  const record = keys[provider];
  if (!record) {
    return null;
  }
  try {
    return await CryptoUtil.decrypt(record.encryptedKey);
  } catch {
    return null;
  }
}

/**
 * 指定プロバイダーのAPIキーをlocalStorageから完全に削除する。
 * 削除対象がアクティブプロバイダーの場合、アクティブプロバイダーをクリアする。
 *
 * @param provider AIプロバイダー種別
 */
export async function deleteApiKey(provider: AIProvider): Promise<void> {
  const keys = loadApiKeys();
  delete keys[provider];
  saveApiKeys(keys);

  // アクティブプロバイダーがこのプロバイダーだった場合はクリア
  const settings = loadSettings();
  if (settings.activeProvider === provider) {
    settings.activeProvider = undefined;
    saveSettings(settings);
  }
}

/**
 * 指定プロバイダーのAPIキーで接続テストを実行する。
 * 各プロバイダーのAPIに軽量なテストリクエストを送信し、成功/失敗とレイテンシを返す。
 * 結果は3秒以内に返却される（タイムアウト: 10秒）。
 *
 * @param provider AIプロバイダー種別
 * @returns 接続テスト結果
 */
export async function testConnection(
  provider: AIProvider,
): Promise<ConnectionTestResult> {
  const apiKey = await getApiKey(provider);
  if (!apiKey) {
    return {
      success: false,
      latencyMs: 0,
      errorMessage: 'APIキーが設定されていません。',
    };
  }

  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;

    switch (provider) {
      case 'openai':
        response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });
        break;

      case 'gemini':
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          {
            method: 'GET',
            signal: controller.signal,
          },
        );
        break;

      case 'claude':
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
          signal: controller.signal,
        });
        break;
    }

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (response.ok || (provider === 'claude' && response.status === 200)) {
      return { success: true, latencyMs };
    }

    // 401 / 403 → 無効なAPIキー
    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        latencyMs,
        errorMessage:
          'APIキーが無効です。正しいキーを入力してください。',
      };
    }

    return {
      success: false,
      latencyMs,
      errorMessage: `接続テストに失敗しました（ステータス: ${response.status}）`,
    };
  } catch (error: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);

    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        latencyMs,
        errorMessage: '接続がタイムアウトしました。ネットワーク接続を確認してください。',
      };
    }

    return {
      success: false,
      latencyMs,
      errorMessage: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
    };
  }
}

/**
 * 現在のアクティブプロバイダーを取得する。
 * 設定されていない場合はnullを返す。
 */
export function getActiveProvider(): AIProvider | null {
  const settings = loadSettings();
  return settings.activeProvider ?? null;
}

/**
 * 指定プロバイダーの推定コストを取得する。
 *
 * @param provider AIプロバイダー種別
 * @returns 1レッスンあたり・月間の推定コスト
 */
export function getEstimatedCost(provider: AIProvider): CostEstimate {
  return { ...COST_ESTIMATES[provider] };
}

/**
 * 月間利用上限に達しているかどうかを判定する。
 * 月が変わった場合はカウントをリセットする。
 *
 * @returns 上限に達している場合はtrue
 */
export function isMonthlyLimitReached(): boolean {
  const settings = loadSettings();
  const limit = settings.monthlyLessonLimit;

  // 上限が未設定の場合は制限なし
  if (limit === undefined || limit <= 0) {
    return false;
  }

  const currentMonth = getCurrentMonth();

  // 月が変わっていたらカウントをリセット
  if (settings.monthlyLessonCountResetMonth !== currentMonth) {
    settings.monthlyLessonCount = 0;
    settings.monthlyLessonCountResetMonth = currentMonth;
    saveSettings(settings);
    return false;
  }

  const count = settings.monthlyLessonCount ?? 0;
  return count >= limit;
}

/**
 * 月間利用回数をインクリメントする。
 * 月が変わっていた場合はリセットしてから1にする。
 */
export function incrementMonthlyUsage(): void {
  const settings = loadSettings();
  const currentMonth = getCurrentMonth();

  if (settings.monthlyLessonCountResetMonth !== currentMonth) {
    settings.monthlyLessonCount = 1;
    settings.monthlyLessonCountResetMonth = currentMonth;
  } else {
    settings.monthlyLessonCount = (settings.monthlyLessonCount ?? 0) + 1;
  }

  saveSettings(settings);
}

/**
 * 月間利用上限を設定する。
 *
 * @param limit 月間レッスン上限回数（0以下で無制限）
 */
export function setMonthlyLimit(limit: number): void {
  const settings = loadSettings();
  settings.monthlyLessonLimit = limit;
  saveSettings(settings);
}

/**
 * 現在の月間利用状況を取得する。
 *
 * @returns { count: 今月の利用回数, limit: 上限（未設定時はundefined） }
 */
export function getMonthlyUsage(): { count: number; limit: number | undefined } {
  const settings = loadSettings();
  const currentMonth = getCurrentMonth();

  if (settings.monthlyLessonCountResetMonth !== currentMonth) {
    return { count: 0, limit: settings.monthlyLessonLimit };
  }

  return {
    count: settings.monthlyLessonCount ?? 0,
    limit: settings.monthlyLessonLimit,
  };
}
