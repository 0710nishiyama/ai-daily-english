/**
 * ConversationEngine - AI APIを利用して会話を生成・管理するコンポーネント
 *
 * シーンに基づいた英会話レッスンの会話フローを制御する。
 * AIProviderAdapterを利用してAI APIとの通信を行い、会話履歴の保持・順序管理、
 * レッスン完了判定（3〜5往復）、難易度の動的調整、日本語ヒント・例文の表示、
 * 自然表現・スラングの検出と解説データの付与を実装する。
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 10.1, 10.2
 */

import type {
  ConversationTurn,
  DifficultyLevel,
  HintData,
  NaturalExpression,
  ChatMessage,
} from '../types';
import type { AIProviderAdapter } from '../infra/AIProviderAdapter';
import { getScenePrompt, resolvePrompt } from '../data/prompts';
import { SCENE_MAP } from '../data/scenes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** レッスン完了に必要な最小往復回数 */
const MIN_TURNS = 3;

/** レッスン完了の最大往復回数 */
const MAX_TURNS = 5;

/** AI APIリクエストのデフォルトタイムアウト（ミリ秒） */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * よく使われる自然表現・スラングのデータベース
 * AIの返答からこれらの表現を検出し、解説を付与する
 *
 * Requirements: 10.1, 10.2
 */
const NATURAL_EXPRESSIONS_DB: NaturalExpression[] = [
  { expression: "how's it going", meaning: 'How are you? (casual greeting)', usageContext: 'Casual greeting among friends or acquaintances' },
  { expression: "what's up", meaning: 'Hello / What is happening? (very casual)', usageContext: 'Very casual greeting, often among close friends' },
  { expression: 'no worries', meaning: "It's okay / Don't worry about it", usageContext: 'Casual way to say "you\'re welcome" or "it\'s fine"' },
  { expression: 'sounds good', meaning: "That's a good idea / I agree", usageContext: 'Casual agreement or approval' },
  { expression: 'no problem', meaning: "You're welcome / It's fine", usageContext: 'Casual response to thanks or apology' },
  { expression: "i'm down", meaning: "I'm willing / I want to do that", usageContext: 'Casual way to express willingness to participate' },
  { expression: 'hang out', meaning: 'Spend time together casually', usageContext: 'Informal way to describe spending time with friends' },
  { expression: 'grab a bite', meaning: 'Get something to eat quickly', usageContext: 'Casual suggestion to eat together' },
  { expression: 'catch you later', meaning: 'See you later / Goodbye', usageContext: 'Casual farewell' },
  { expression: 'take it easy', meaning: 'Relax / Goodbye (casual)', usageContext: 'Casual farewell or advice to relax' },
  { expression: "i'm stoked", meaning: "I'm very excited", usageContext: 'Expressing strong excitement (slang)' },
  { expression: "that's a bummer", meaning: "That's disappointing", usageContext: 'Expressing disappointment casually' },
  { expression: 'no way', meaning: "I can't believe it / That's surprising", usageContext: 'Expressing surprise or disbelief' },
  { expression: 'for sure', meaning: 'Definitely / Certainly', usageContext: 'Casual way to confirm or agree strongly' },
  { expression: 'my bad', meaning: "My mistake / I'm sorry", usageContext: 'Casual apology for a minor mistake' },
  { expression: 'you bet', meaning: "Of course / You're welcome", usageContext: 'Casual affirmation' },
  { expression: 'fair enough', meaning: "That's reasonable / I accept that", usageContext: 'Acknowledging a valid point in discussion' },
  { expression: "i'm not sure about that", meaning: 'I disagree (politely)', usageContext: 'Polite way to express disagreement' },
  { expression: 'totally', meaning: 'Completely / I agree', usageContext: 'Casual strong agreement' },
  { expression: "you won't believe", meaning: 'Something surprising happened', usageContext: 'Starting an exciting or surprising story' },
  { expression: 'long story short', meaning: 'To summarize briefly', usageContext: 'Shortening a long explanation' },
  { expression: "you're killing it", meaning: "You're doing great", usageContext: 'Complimenting someone on their performance (slang)' },
  { expression: 'sure thing', meaning: 'Of course / No problem', usageContext: 'Casual affirmative response' },
  { expression: 'pretty good', meaning: 'Quite good / Fairly good', usageContext: 'Casual positive response, slightly understated' },
  { expression: 'kind of', meaning: 'Somewhat / Sort of', usageContext: 'Hedging or softening a statement' },
  { expression: 'by the way', meaning: 'Incidentally / On another topic', usageContext: 'Introducing a new or tangential topic' },
  { expression: 'speaking of which', meaning: 'Related to what was just said', usageContext: 'Transitioning to a related topic' },
  { expression: 'that reminds me', meaning: 'Something just came to mind', usageContext: 'Introducing a related thought or memory' },
  { expression: "let me rephrase that", meaning: 'Let me say that differently', usageContext: 'Clarifying a misunderstood statement' },
  { expression: "what i meant was", meaning: 'My intended meaning was', usageContext: 'Correcting a misunderstanding' },
];

// ---------------------------------------------------------------------------
// ConversationEngine class
// ---------------------------------------------------------------------------

/**
 * 会話エンジン
 *
 * 1つのレッスンセッションの会話フローを管理する。
 * インスタンスはレッスン開始時に生成し、レッスン終了まで保持する。
 */
export class ConversationEngine {
  private readonly adapter: AIProviderAdapter;
  private readonly history: ConversationTurn[] = [];
  private sceneId: string = '';
  private difficulty: DifficultyLevel = 'beginner';
  private systemPrompt: string = '';
  private lessonStarted: boolean = false;

  /**
   * @param adapter AIプロバイダーアダプター
   */
  constructor(adapter: AIProviderAdapter) {
    this.adapter = adapter;
  }

  /**
   * レッスンを開始し、AIの最初の発話を生成する。
   *
   * シーンのコンテキストに基づいてシステムプロンプトを構築し、
   * AIに最初の発話を生成させる。
   *
   * Requirements: 4.1
   *
   * @param sceneId シーンID
   * @param difficulty 難易度レベル
   * @returns AIの最初の発話ターン
   * @throws レッスンが既に開始されている場合
   */
  async startLesson(
    sceneId: string,
    difficulty: DifficultyLevel = 'beginner',
  ): Promise<ConversationTurn> {
    if (this.lessonStarted) {
      throw new Error('レッスンは既に開始されています。');
    }

    this.sceneId = sceneId;
    this.difficulty = difficulty;
    this.lessonStarted = true;

    // シーンに対応するプロンプトテンプレートを取得し、難易度を適用
    const promptTemplate = getScenePrompt(sceneId);
    this.systemPrompt = resolvePrompt(promptTemplate.systemPrompt, difficulty);

    // シーンの会話ゴールをシステムプロンプトに追加
    const scene = SCENE_MAP.get(sceneId);
    if (scene) {
      this.systemPrompt += `\n\nConversation Goal: ${scene.conversationGoal}`;
    }

    // AIに最初の発話を生成させる
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content:
          'Start the conversation. Greet the customer/person naturally and set the scene. Respond ONLY in English.',
      },
    ];

    const aiText = await this.callAI(messages);

    const turn: ConversationTurn = {
      role: 'assistant',
      text: aiText,
      timestamp: Date.now(),
      naturalExpressions: detectNaturalExpressions(aiText),
    };

    this.history.push(turn);
    return turn;
  }

  /**
   * ユーザーの発話に対するAI返答を生成する。
   *
   * 会話履歴を考慮し、シーンの文脈に沿った自然な英語の返答を生成する。
   * 難易度の動的調整と自然表現の検出を行う。
   *
   * Requirements: 4.2, 4.4, 4.5, 4.6
   *
   * @param userText ユーザーの発話テキスト
   * @returns AIの返答ターン
   * @throws レッスンが開始されていない場合
   */
  async sendMessage(userText: string): Promise<ConversationTurn> {
    if (!this.lessonStarted) {
      throw new Error('レッスンが開始されていません。startLesson()を先に呼び出してください。');
    }

    // ユーザーの発話を履歴に追加
    const userTurn: ConversationTurn = {
      role: 'user',
      text: userText,
      timestamp: Date.now(),
    };
    this.history.push(userTurn);

    // 難易度の動的調整（Requirements: 4.4）
    this.adjustDifficulty(userText);

    // 会話履歴からChatMessage配列を構築
    const messages = this.buildMessages();

    // レッスン終盤の場合、会話を自然に締めくくるよう指示
    const roundTripCount = this.getRoundTripCount();
    if (roundTripCount >= MAX_TURNS - 1) {
      messages.push({
        role: 'system',
        content:
          'This is the last exchange. Wrap up the conversation naturally with a closing remark.',
      });
    }

    const aiText = await this.callAI(messages);

    const aiTurn: ConversationTurn = {
      role: 'assistant',
      text: aiText,
      timestamp: Date.now(),
      naturalExpressions: detectNaturalExpressions(aiText),
    };

    this.history.push(aiTurn);
    return aiTurn;
  }

  /**
   * 会話履歴を取得する。
   * 送信順序を保持した全ターンを返す。
   *
   * Requirements: 4.5
   *
   * @returns 会話ターンの配列（送信順）
   */
  getHistory(): ConversationTurn[] {
    return [...this.history];
  }

  /**
   * レッスンが完了したかどうかを判定する。
   * ユーザーとAIの往復回数が3〜5回の範囲で完了とする。
   *
   * Requirements: 4.3
   *
   * @returns レッスンが完了している場合はtrue
   */
  isLessonComplete(): boolean {
    const roundTrips = this.getRoundTripCount();
    return roundTrips >= MIN_TURNS && roundTrips <= MAX_TURNS;
  }

  /**
   * 日本語ヒントと例文を取得する。
   * AIに現在の会話コンテキストに基づいたヒントを生成させる。
   *
   * Requirements: 4.8
   *
   * @returns ヒントデータ（日本語ヒント + 例文）
   */
  async getHint(): Promise<HintData> {
    if (!this.lessonStarted) {
      throw new Error('レッスンが開始されていません。');
    }

    const promptTemplate = getScenePrompt(this.sceneId);

    // 現在の会話コンテキストを含むヒントリクエストを構築
    const conversationContext = this.history
      .map((t) => `${t.role}: ${t.text}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: promptTemplate.hintPrompt,
      },
      {
        role: 'user',
        content: `${conversationContext}\n\nBased on this conversation, provide a hint for the learner. Return as JSON: { "japaneseHint": string, "examplePhrases": [string, string, string] }`,
      },
    ];

    try {
      const response = await this.callAI(messages);
      const parsed = parseJsonResponse<HintData>(response);

      if (parsed && parsed.japaneseHint && Array.isArray(parsed.examplePhrases)) {
        return {
          japaneseHint: parsed.japaneseHint,
          examplePhrases: parsed.examplePhrases.filter(
            (p): p is string => typeof p === 'string',
          ),
        };
      }
    } catch {
      // ヒント生成に失敗した場合はフォールバック
    }

    // フォールバック: シーンのキーフレーズを使用
    return this.getFallbackHint();
  }

  /**
   * 現在の往復回数を取得する。
   * 1往復 = ユーザー発話1回 + AI返答1回（ただし最初のAI発話は除く）
   */
  getRoundTripCount(): number {
    // 最初のAI発話を除いた後の、ユーザー発話の数が往復回数
    const userTurns = this.history.filter((t) => t.role === 'user');
    return userTurns.length;
  }

  /**
   * 現在の難易度を取得する
   */
  getDifficulty(): DifficultyLevel {
    return this.difficulty;
  }

  /**
   * 現在のシーンIDを取得する
   */
  getSceneId(): string {
    return this.sceneId;
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  /**
   * AI APIを呼び出す。
   * タイムアウト（10秒）を設定し、エラー時は適切なメッセージをスローする。
   *
   * Requirements: 4.7
   */
  private async callAI(messages: ChatMessage[]): Promise<string> {
    try {
      return await this.adapter.chatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 1024,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      // タイムアウトエラーの場合
      if (message.includes('タイムアウト') || message.includes('AbortError')) {
        throw new Error('応答がありません。再試行しますか？');
      }

      throw error;
    }
  }

  /**
   * 会話履歴からChatMessage配列を構築する。
   * システムプロンプト + 会話履歴の順で構成する。
   */
  private buildMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
    ];

    for (const turn of this.history) {
      messages.push({
        role: turn.role === 'assistant' ? 'assistant' : 'user',
        content: turn.text,
      });
    }

    return messages;
  }

  /**
   * ユーザーの発話内容に基づいて難易度を動的に調整する。
   *
   * Requirements: 4.4
   *
   * - 短い返答（3語以下）が続く場合: 難易度を下げる
   * - 長い返答（10語以上）で文法的に複雑な場合: 難易度を上げる
   */
  private adjustDifficulty(userText: string): void {
    const words = userText.trim().split(/\s+/);
    const wordCount = words.length;

    // 直近のユーザー発話を取得（最大3つ）
    const recentUserTurns = this.history
      .filter((t) => t.role === 'user')
      .slice(-3);

    const recentWordCounts = recentUserTurns.map(
      (t) => t.text.trim().split(/\s+/).length,
    );

    // 短い返答が続く場合は難易度を下げる
    if (
      recentWordCounts.length >= 2 &&
      recentWordCounts.every((c) => c <= 3) &&
      wordCount <= 3
    ) {
      if (this.difficulty === 'advanced') {
        this.difficulty = 'intermediate';
        this.updateSystemPromptDifficulty();
      } else if (this.difficulty === 'intermediate') {
        this.difficulty = 'beginner';
        this.updateSystemPromptDifficulty();
      }
      return;
    }

    // 長い返答で複雑な構造の場合は難易度を上げる
    const hasComplexStructure =
      userText.includes(',') ||
      userText.includes('because') ||
      userText.includes('although') ||
      userText.includes('however') ||
      userText.includes('which') ||
      userText.includes('that');

    if (wordCount >= 10 && hasComplexStructure) {
      if (this.difficulty === 'beginner') {
        this.difficulty = 'intermediate';
        this.updateSystemPromptDifficulty();
      } else if (this.difficulty === 'intermediate') {
        this.difficulty = 'advanced';
        this.updateSystemPromptDifficulty();
      }
    }
  }

  /**
   * 難易度変更時にシステムプロンプトを更新する
   */
  private updateSystemPromptDifficulty(): void {
    const promptTemplate = getScenePrompt(this.sceneId);
    this.systemPrompt = resolvePrompt(
      promptTemplate.systemPrompt,
      this.difficulty,
    );

    const scene = SCENE_MAP.get(this.sceneId);
    if (scene) {
      this.systemPrompt += `\n\nConversation Goal: ${scene.conversationGoal}`;
    }
  }

  /**
   * ヒント生成のフォールバック
   * シーンのキーフレーズからヒントを構築する
   */
  private getFallbackHint(): HintData {
    const scene = SCENE_MAP.get(this.sceneId);
    if (scene) {
      return {
        japaneseHint: `${scene.nameJa}のシーンで使える表現を試してみましょう。`,
        examplePhrases: scene.keyPhrases.slice(0, 3),
      };
    }

    return {
      japaneseHint: '英語で自然に返答してみましょう。',
      examplePhrases: ['That sounds great!', "I'd like to...", 'Could you help me with...?'],
    };
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * テキストから自然表現・スラングを検出する。
 * NATURAL_EXPRESSIONS_DBに登録された表現をテキスト内から検索し、
 * 見つかった表現の解説データを返す。
 *
 * Requirements: 10.1, 10.2
 *
 * @param text 検索対象のテキスト
 * @returns 検出された自然表現の配列
 */
export function detectNaturalExpressions(text: string): NaturalExpression[] {
  const lowerText = text.toLowerCase();
  const detected: NaturalExpression[] = [];

  for (const expr of NATURAL_EXPRESSIONS_DB) {
    if (lowerText.includes(expr.expression)) {
      detected.push({ ...expr });
    }
  }

  return detected;
}

/**
 * AIレスポンスからJSONをパースする。
 * レスポンスにMarkdownコードブロックが含まれている場合は除去する。
 *
 * @param response AIのレスポンステキスト
 * @returns パースされたオブジェクト、またはnull
 */
function parseJsonResponse<T>(response: string): T | null {
  try {
    // Markdownコードブロックを除去
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
