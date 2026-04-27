/**
 * AIProviderAdapter - 3つのAIプロバイダーを統一的に扱うアダプター
 *
 * OpenAI・Gemini・Claudeの各APIに対して統一インターフェースを提供する。
 * 指数バックオフ付きリトライ、タイムアウト（10秒）、エラーハンドリングを含む。
 *
 * Requirements: 1.1, 1.3, 4.7
 */

import type {
  AIProvider,
  ChatMessage,
  CompletionOptions,
  RetryConfig,
} from '../types';

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

/** デフォルトのタイムアウト（ミリ秒） */
const DEFAULT_TIMEOUT_MS = 10_000;

/** デフォルトのリトライ設定 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
};

// ---------------------------------------------------------------------------
// withRetry - 指数バックオフ付きリトライ
// ---------------------------------------------------------------------------

/**
 * 指数バックオフ付きリトライでasync関数を実行する。
 *
 * @param fn 実行する非同期関数
 * @param config リトライ設定
 * @returns 関数の戻り値
 * @throws 全リトライ失敗後に最後のエラーをスロー
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // リトライ不要なエラー（認証エラーなど）は即座にスロー
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelayMs,
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * リトライすべきでないエラーかどうかを判定する。
 * 認証エラー（401, 403）やバリデーションエラー（400）はリトライしない。
 */
function isNonRetryableError(error: Error): boolean {
  const message = error.message;
  return (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('400') ||
    message.includes('APIキーが無効')
  );
}

/** 指定ミリ秒だけ待機する */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// AIProviderAdapter interface
// ---------------------------------------------------------------------------

/**
 * AIプロバイダーアダプターの統一インターフェース
 */
export interface AIProviderAdapter {
  /** チャット補完リクエスト */
  chatCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<string>;

  /** 接続テスト */
  testConnection(): Promise<boolean>;

  /** プロバイダー名 */
  readonly providerName: AIProvider;
}

// ---------------------------------------------------------------------------
// OpenAIAdapter
// ---------------------------------------------------------------------------

/**
 * OpenAI API アダプター
 *
 * GPT-4o-mini をデフォルトモデルとして使用する。
 */
export class OpenAIAdapter implements AIProviderAdapter {
  readonly providerName: AIProvider = 'openai';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.model,
              messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              temperature: options?.temperature ?? 0.7,
              max_tokens: options?.maxTokens ?? 1024,
            }),
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          throw new Error(
            `OpenAI API error (${response.status}): ${errorBody}`,
          );
        }

        const data = (await response.json()) as OpenAIResponse;
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('OpenAI APIから有効なレスポンスが返されませんでした。');
        }

        return content;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          throw new Error(
            '応答がありません。再試行しますか？（タイムアウト: 10秒）',
          );
        }

        throw error;
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// GeminiAdapter
// ---------------------------------------------------------------------------

/**
 * Google Gemini API アダプター
 *
 * Gemini 2.0 Flash をデフォルトモデルとして使用する。
 */
export class GeminiAdapter implements AIProviderAdapter {
  readonly providerName: AIProvider = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'gemini-2.0-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Gemini APIのメッセージ形式に変換
        const { systemInstruction, contents } =
          convertToGeminiFormat(messages);

        const requestBody: Record<string, unknown> = {
          contents,
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 1024,
          },
        };

        if (systemInstruction) {
          requestBody.systemInstruction = systemInstruction;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          throw new Error(
            `Gemini API error (${response.status}): ${errorBody}`,
          );
        }

        const data = (await response.json()) as GeminiResponse;
        const content =
          data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
          throw new Error(
            'Gemini APIから有効なレスポンスが返されませんでした。',
          );
        }

        return content;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          throw new Error(
            '応答がありません。再試行しますか？（タイムアウト: 10秒）',
          );
        }

        throw error;
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
        {
          method: 'GET',
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// ClaudeAdapter
// ---------------------------------------------------------------------------

/**
 * Anthropic Claude API アダプター
 *
 * Claude 3 Haiku をデフォルトモデルとして使用する。
 * ブラウザから直接呼び出すため anthropic-dangerous-direct-browser-access ヘッダーを付与する。
 */
export class ClaudeAdapter implements AIProviderAdapter {
  readonly providerName: AIProvider = 'claude';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'claude-3-haiku-20240307') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Claude APIのメッセージ形式に変換
        const { system, claudeMessages } = convertToClaudeFormat(messages);

        const requestBody: Record<string, unknown> = {
          model: this.model,
          max_tokens: options?.maxTokens ?? 1024,
          messages: claudeMessages,
        };

        if (system) {
          requestBody.system = system;
        }

        // temperature は Claude API では任意
        if (options?.temperature !== undefined) {
          requestBody.temperature = options.temperature;
        }

        const response = await fetch(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          throw new Error(
            `Claude API error (${response.status}): ${errorBody}`,
          );
        }

        const data = (await response.json()) as ClaudeResponse;
        const textBlock = data.content?.find(
          (block) => block.type === 'text',
        );

        if (!textBlock || !textBlock.text) {
          throw new Error(
            'Claude APIから有効なレスポンスが返されませんでした。',
          );
        }

        return textBlock.text;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          throw new Error(
            '応答がありません。再試行しますか？（タイムアウト: 10秒）',
          );
        }

        throw error;
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * AIプロバイダーに対応するアダプターインスタンスを生成する。
 *
 * @param provider AIプロバイダー種別
 * @param apiKey APIキー
 * @returns AIProviderAdapter インスタンス
 */
export function createAdapter(
  provider: AIProvider,
  apiKey: string,
): AIProviderAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter(apiKey);
    case 'gemini':
      return new GeminiAdapter(apiKey);
    case 'claude':
      return new ClaudeAdapter(apiKey);
  }
}

// ---------------------------------------------------------------------------
// Message format converters
// ---------------------------------------------------------------------------

/** Gemini API用のメッセージ形式 */
interface GeminiFormattedMessages {
  systemInstruction: { parts: { text: string }[] } | null;
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
}

/**
 * ChatMessage配列をGemini APIのリクエスト形式に変換する。
 * systemロールのメッセージはsystemInstructionとして分離する。
 */
function convertToGeminiFormat(
  messages: ChatMessage[],
): GeminiFormattedMessages {
  let systemInstruction: GeminiFormattedMessages['systemInstruction'] = null;
  const contents: GeminiFormattedMessages['contents'] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  return { systemInstruction, contents };
}

/** Claude API用のメッセージ形式 */
interface ClaudeFormattedMessages {
  system: string | null;
  claudeMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * ChatMessage配列をClaude APIのリクエスト形式に変換する。
 * systemロールのメッセージはsystemパラメータとして分離する。
 */
function convertToClaudeFormat(
  messages: ChatMessage[],
): ClaudeFormattedMessages {
  let system: string | null = null;
  const claudeMessages: ClaudeFormattedMessages['claudeMessages'] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
    } else {
      claudeMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return { system, claudeMessages };
}

// ---------------------------------------------------------------------------
// Response types (internal)
// ---------------------------------------------------------------------------

/** OpenAI API レスポンス型 */
interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/** Gemini API レスポンス型 */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

/** Claude API レスポンス型 */
interface ClaudeResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
}
