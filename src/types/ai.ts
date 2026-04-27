/**
 * AI Provider related types
 * AIプロバイダー関連の型定義
 */

export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  errorMessage?: string;
}

export interface CostEstimate {
  perLesson: number;
  perMonth: number;
  currency: 'USD';
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}
