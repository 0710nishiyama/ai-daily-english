/**
 * EvaluationEngine - ユーザーの発話を評価するコンポーネント
 *
 * レッスン終了後に会話履歴とシーンIDを受け取り、AI APIを使って
 * 文法・自然さ・返答内容の3観点で評価する。各観点のスコア（1〜5）と
 * 改善例の生成、総合スコア（100点満点）の算出、スラング・自然表現の
 * 使用に対する肯定的評価を行う。
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import type {
  ConversationTurn,
  EvaluationResult,
  EvaluationScore,
  Improvement,
  SlangFeedback,
  ChatMessage,
} from '../types';
import type { AIProviderAdapter } from '../infra/AIProviderAdapter';
import { getScenePrompt } from '../data/prompts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** AI APIリクエストのデフォルトタイムアウト（ミリ秒） */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * 総合スコア算出の重み付け
 * grammar: 30%, naturalness: 40%, responseContent: 30%
 *
 * Requirements: 6.4
 */
const SCORE_WEIGHTS = {
  grammar: 0.3,
  naturalness: 0.4,
  responseContent: 0.3,
} as const;

/**
 * よく使われるスラング・自然表現のリスト
 * ユーザーの発話からこれらの表現を検出し、肯定的に評価する
 *
 * Requirements: 6.6
 */
const SLANG_EXPRESSIONS: ReadonlyArray<{
  expression: string;
  comment: string;
  commentJa: string;
}> = [
  { expression: "how's it going", comment: 'Great use of a casual greeting!', commentJa: 'カジュアルな挨拶をうまく使えています！' },
  { expression: "what's up", comment: 'Nice casual greeting!', commentJa: 'カジュアルな挨拶がいいですね！' },
  { expression: 'no worries', comment: 'Natural way to say "you\'re welcome"!', commentJa: '「どういたしまして」の自然な表現です！' },
  { expression: 'sounds good', comment: 'Perfect casual agreement!', commentJa: 'カジュアルな同意表現がぴったりです！' },
  { expression: 'no problem', comment: 'Natural response!', commentJa: '自然な返答です！' },
  { expression: "i'm down", comment: 'Great slang for expressing willingness!', commentJa: '意欲を表すスラングをうまく使えています！' },
  { expression: 'hang out', comment: 'Natural casual expression!', commentJa: '自然なカジュアル表現です！' },
  { expression: 'grab a bite', comment: 'Nice idiomatic expression!', commentJa: 'いい慣用表現です！' },
  { expression: 'catch you later', comment: 'Cool casual farewell!', commentJa: 'かっこいいカジュアルな別れの挨拶です！' },
  { expression: 'take it easy', comment: 'Relaxed farewell expression!', commentJa: 'リラックスした別れの表現です！' },
  { expression: "i'm stoked", comment: 'Awesome slang for excitement!', commentJa: '興奮を表すスラングが素晴らしい！' },
  { expression: 'for sure', comment: 'Natural way to confirm!', commentJa: '確認の自然な表現です！' },
  { expression: 'my bad', comment: 'Casual apology, well used!', commentJa: 'カジュアルな謝罪をうまく使えています！' },
  { expression: 'you bet', comment: 'Great casual affirmation!', commentJa: 'カジュアルな肯定表現がいいですね！' },
  { expression: 'fair enough', comment: 'Mature conversational expression!', commentJa: '大人な会話表現です！' },
  { expression: 'totally', comment: 'Natural strong agreement!', commentJa: '自然な強い同意表現です！' },
  { expression: 'pretty good', comment: 'Nice understated positive response!', commentJa: '控えめな肯定表現がいいですね！' },
  { expression: 'kind of', comment: 'Good hedging expression!', commentJa: '上手なぼかし表現です！' },
  { expression: 'sure thing', comment: 'Friendly affirmative!', commentJa: 'フレンドリーな肯定表現です！' },
  { expression: 'by the way', comment: 'Smooth topic transition!', commentJa: 'スムーズな話題転換です！' },
  { expression: "you're killing it", comment: 'Great use of encouraging slang!', commentJa: '励ましのスラングをうまく使えています！' },
  { expression: 'no way', comment: 'Natural expression of surprise!', commentJa: '驚きの自然な表現です！' },
  { expression: "that's a bummer", comment: 'Good casual expression of disappointment!', commentJa: '残念さを表すカジュアル表現がいいですね！' },
];

// ---------------------------------------------------------------------------
// EvaluationEngine class
// ---------------------------------------------------------------------------

/**
 * 評価エンジン
 *
 * レッスン終了後にユーザーの発話を3観点で評価し、
 * 改善例とスラング使用のフィードバックを生成する。
 */
export class EvaluationEngine {
  private readonly adapter: AIProviderAdapter;

  /**
   * @param adapter AIプロバイダーアダプター
   */
  constructor(adapter: AIProviderAdapter) {
    this.adapter = adapter;
  }

  /**
   * レッスン全体の評価を行う。
   *
   * 会話履歴とシーンIDを受け取り、AI APIを使って文法・自然さ・返答内容の
   * 3観点で評価する。各観点のスコア（1〜5）と改善例を生成し、
   * 総合スコア（100点満点）を算出する。
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   *
   * @param history 会話履歴
   * @param sceneId シーンID
   * @returns 評価結果
   */
  async evaluate(
    history: ConversationTurn[],
    sceneId: string,
  ): Promise<EvaluationResult> {
    // ユーザーの発話からスラング・自然表現を検出（Requirements: 6.6）
    const detectedSlang = this.detectSlangUsage(history);

    // AI APIによる評価を試行
    try {
      const aiResult = await this.evaluateWithAI(history, sceneId);

      // AIの評価結果にスラング検出結果をマージ
      const mergedSlang = this.mergeSlangFeedback(
        aiResult.slangUsage,
        detectedSlang,
      );

      // スコアのバリデーションと正規化
      const grammar = normalizeScore(aiResult.grammar);
      const naturalness = normalizeScore(aiResult.naturalness);
      const responseContent = normalizeScore(aiResult.responseContent);

      // 総合スコアの算出（Requirements: 6.4）
      const totalScore = calculateTotalScore(grammar, naturalness, responseContent);

      return {
        grammar,
        naturalness,
        responseContent,
        totalScore,
        improvements: aiResult.improvements ?? [],
        slangUsage: mergedSlang,
      };
    } catch {
      // AI API呼び出し失敗時はフォールバック評価を返す
      return this.buildFallbackEvaluation(history, detectedSlang);
    }
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  /**
   * AI APIを使って会話を評価する。
   *
   * @param history 会話履歴
   * @param sceneId シーンID
   * @returns AIが生成した評価結果（生データ）
   */
  private async evaluateWithAI(
    history: ConversationTurn[],
    sceneId: string,
  ): Promise<RawEvaluationResult> {
    const promptTemplate = getScenePrompt(sceneId);

    // 会話履歴をテキスト形式に変換
    const conversationText = history
      .map((turn) => `${turn.role === 'user' ? 'User' : 'AI'}: ${turn.text}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: promptTemplate.evaluationPrompt,
      },
      {
        role: 'user',
        content: conversationText,
      },
    ];

    const response = await this.adapter.chatCompletion(messages, {
      temperature: 0.3, // 評価は一貫性を重視するため低めの温度
      maxTokens: 2048,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    const parsed = parseJsonResponse<RawEvaluationResult>(response);

    if (!parsed) {
      throw new Error('評価結果のパースに失敗しました。');
    }

    return parsed;
  }

  /**
   * ユーザーの発話からスラング・自然表現を検出する。
   *
   * Requirements: 6.6
   *
   * @param history 会話履歴
   * @returns 検出されたスラングフィードバックの配列
   */
  private detectSlangUsage(history: ConversationTurn[]): SlangFeedback[] {
    const userTexts = history
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.text.toLowerCase());

    const combinedText = userTexts.join(' ');
    const detected: SlangFeedback[] = [];
    const seen = new Set<string>();

    for (const slang of SLANG_EXPRESSIONS) {
      if (combinedText.includes(slang.expression) && !seen.has(slang.expression)) {
        seen.add(slang.expression);
        detected.push({
          expression: slang.expression,
          isPositive: true,
          comment: slang.comment,
          commentJa: slang.commentJa,
        });
      }
    }

    return detected;
  }

  /**
   * AIが生成したスラングフィードバックとローカル検出結果をマージする。
   * 重複を排除し、ローカル検出で見つかった表現はすべて肯定的に評価する。
   *
   * @param aiSlang AIが生成したスラングフィードバック
   * @param localSlang ローカル検出のスラングフィードバック
   * @returns マージされたスラングフィードバック
   */
  private mergeSlangFeedback(
    aiSlang: SlangFeedback[] | undefined,
    localSlang: SlangFeedback[],
  ): SlangFeedback[] {
    const merged = new Map<string, SlangFeedback>();

    // ローカル検出結果を先に追加（肯定的評価を優先）
    for (const feedback of localSlang) {
      merged.set(feedback.expression.toLowerCase(), feedback);
    }

    // AIの結果を追加（ローカルで未検出のもののみ）
    if (aiSlang) {
      for (const feedback of aiSlang) {
        const key = feedback.expression.toLowerCase();
        if (!merged.has(key)) {
          merged.set(key, feedback);
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * AI API呼び出し失敗時のフォールバック評価を構築する。
   *
   * ユーザーの発話の長さや複雑さに基づいて簡易的なスコアを算出する。
   *
   * @param history 会話履歴
   * @param detectedSlang 検出されたスラング
   * @returns フォールバック評価結果
   */
  private buildFallbackEvaluation(
    history: ConversationTurn[],
    detectedSlang: SlangFeedback[],
  ): EvaluationResult {
    const userTurns = history.filter((turn) => turn.role === 'user');

    // ユーザーの発話の平均語数に基づく簡易スコア
    const avgWordCount =
      userTurns.length > 0
        ? userTurns.reduce(
            (sum, turn) => sum + turn.text.trim().split(/\s+/).length,
            0,
          ) / userTurns.length
        : 0;

    // 簡易スコア算出（1〜5）
    const baseScore = Math.min(5, Math.max(1, Math.round(avgWordCount / 3 + 1)));

    const grammar: EvaluationScore = {
      score: baseScore,
      feedback: 'Evaluation was performed offline. Practice more for detailed feedback!',
      feedbackJa: 'オフライン評価です。詳細なフィードバックにはもう少し練習しましょう！',
    };

    const naturalness: EvaluationScore = {
      score: Math.min(5, baseScore + (detectedSlang.length > 0 ? 1 : 0)),
      feedback: detectedSlang.length > 0
        ? 'Good use of natural expressions!'
        : 'Try using more casual expressions in your responses.',
      feedbackJa: detectedSlang.length > 0
        ? '自然な表現をうまく使えています！'
        : 'もっとカジュアルな表現を使ってみましょう。',
    };

    const responseContent: EvaluationScore = {
      score: baseScore,
      feedback: 'Keep practicing to improve your conversational responses!',
      feedbackJa: '会話の返答力を高めるために練習を続けましょう！',
    };

    const totalScore = calculateTotalScore(grammar, naturalness, responseContent);

    return {
      grammar,
      naturalness,
      responseContent,
      totalScore,
      improvements: [],
      slangUsage: detectedSlang,
    };
  }
}

// ---------------------------------------------------------------------------
// Score calculation helpers
// ---------------------------------------------------------------------------

/**
 * 総合スコア（100点満点）を算出する。
 *
 * 加重平均: grammar 30% + naturalness 40% + responseContent 30%
 * サブスコア（1〜5）を100点満点にスケーリングする。
 *
 * Requirements: 6.4
 *
 * @param grammar 文法スコア
 * @param naturalness 自然さスコア
 * @param responseContent 返答内容スコア
 * @returns 総合スコア（0〜100）
 */
export function calculateTotalScore(
  grammar: EvaluationScore,
  naturalness: EvaluationScore,
  responseContent: EvaluationScore,
): number {
  const weightedSum =
    grammar.score * SCORE_WEIGHTS.grammar +
    naturalness.score * SCORE_WEIGHTS.naturalness +
    responseContent.score * SCORE_WEIGHTS.responseContent;

  // 1〜5のスコアを0〜100にスケーリング: (weightedSum - 1) / (5 - 1) * 100
  const scaled = ((weightedSum - 1) / 4) * 100;

  // 0〜100の範囲にクランプし、整数に丸める
  return Math.round(Math.max(0, Math.min(100, scaled)));
}

/**
 * EvaluationScoreを正規化する。
 * スコアが1〜5の整数範囲に収まるようにクランプする。
 *
 * @param score 正規化対象のスコア
 * @returns 正規化されたスコア
 */
export function normalizeScore(score: EvaluationScore | undefined): EvaluationScore {
  if (!score) {
    return {
      score: 1,
      feedback: 'No evaluation available.',
      feedbackJa: '評価データがありません。',
    };
  }

  return {
    score: clampScore(score.score),
    feedback: score.feedback || 'No feedback available.',
    feedbackJa: score.feedbackJa || 'フィードバックがありません。',
  };
}

/**
 * スコアを1〜5の整数にクランプする。
 *
 * @param value 入力値
 * @returns 1〜5の整数
 */
function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return 1;
  return Math.round(Math.max(1, Math.min(5, num)));
}

// ---------------------------------------------------------------------------
// JSON parsing helper
// ---------------------------------------------------------------------------

/**
 * AIレスポンスからJSONをパースする。
 * Markdownコードブロックが含まれている場合は除去する。
 *
 * @param response AIのレスポンステキスト
 * @returns パースされたオブジェクト、またはnull
 */
function parseJsonResponse<T>(response: string): T | null {
  try {
    let cleaned = response.trim();
    // Markdownコードブロックを除去
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * AIから返される生の評価結果の型
 * パース後にバリデーション・正規化を行う
 */
interface RawEvaluationResult {
  grammar?: EvaluationScore;
  naturalness?: EvaluationScore;
  responseContent?: EvaluationScore;
  totalScore?: number;
  improvements?: Improvement[];
  slangUsage?: SlangFeedback[];
}
