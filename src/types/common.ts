/**
 * Common types shared across modules
 * モジュール間で共有される共通型定義
 */

export interface NaturalExpression {
  expression: string;
  meaning: string;
  usageContext: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  naturalExpressions?: NaturalExpression[];
}

export interface HintData {
  japaneseHint: string;
  examplePhrases: string[];
}
