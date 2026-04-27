/**
 * Evaluation related types
 * 発話評価関連の型定義
 */

export interface EvaluationResult {
  grammar: EvaluationScore;
  naturalness: EvaluationScore;
  responseContent: EvaluationScore;
  totalScore: number;
  improvements: Improvement[];
  slangUsage: SlangFeedback[];
}

export interface EvaluationScore {
  score: number;
  feedback: string;
  feedbackJa: string;
}

export interface Improvement {
  original: string;
  improved: string;
  explanation: string;
  explanationJa: string;
}

export interface SlangFeedback {
  expression: string;
  isPositive: boolean;
  comment: string;
  commentJa: string;
}
