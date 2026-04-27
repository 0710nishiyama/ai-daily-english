/**
 * LessonManager - シーン別レッスンの選択・進行・カリキュラム管理を行うコンポーネント
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.1, 9.2, 9.3
 */

import type {
  Scene,
  SceneDetail,
  SceneStatus,
  CurriculumProgress,
  ListeningQuiz,
} from '../types';
import { SCENES, SCENE_MAP, DAY_TO_SCENE_MAP } from '../data/scenes';
import { WEEKLY_THEMES, TOTAL_CURRICULUM_DAYS } from '../data/curriculum';
import * as StorageManager from '../infra/StorageManager';

/**
 * カリキュラム状態の永続化データ構造
 */
interface CurriculumState {
  startDate: string;
  completedSceneIds: string[];
  inProgressSceneIds: string[];
  /** シーンIDごとの完了回数（再選択時に異なるパターンを提供するため） */
  completionCounts: Record<string, number>;
}

/**
 * デフォルトのカリキュラム状態
 */
function getDefaultCurriculumState(): CurriculumState {
  return {
    startDate: new Date().toISOString().split('T')[0],
    completedSceneIds: [],
    inProgressSceneIds: [],
    completionCounts: {},
  };
}

/**
 * カリキュラム状態をStorageManagerから読み込む
 */
function loadCurriculumState(): CurriculumState {
  const state = StorageManager.load<CurriculumState>('curriculum_state');
  return state ?? getDefaultCurriculumState();
}

/**
 * カリキュラム状態をStorageManagerに保存する
 */
function saveCurriculumState(state: CurriculumState): void {
  StorageManager.save('curriculum_state', state);
}

/**
 * カリキュラム開始日からの経過日数を計算する（1始まり、最大30）
 */
function calculateCurrentDay(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();
  // 日付のみで比較（時刻を無視）
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // 1始まりで最大30日
  return Math.max(1, Math.min(diffDays + 1, TOTAL_CURRICULUM_DAYS));
}

/**
 * 利用可能なシーン一覧を取得する
 * Sceneインターフェースに合致するフィールドのみを返す
 *
 * Requirements: 5.1
 */
export function getScenes(): Scene[] {
  return SCENES.map(({ id, name, nameJa, description, descriptionJa, keyPhrases, week, day }) => ({
    id,
    name,
    nameJa,
    description,
    descriptionJa,
    keyPhrases,
    week,
    day,
  }));
}

/**
 * シーンの詳細を取得する
 * 完了済みシーンの再選択時は、完了回数に基づいて異なる会話パターンのヒントを付与する
 *
 * Requirements: 5.2, 5.6
 */
export function getSceneDetail(sceneId: string): SceneDetail | null {
  const scene = SCENE_MAP.get(sceneId);
  if (!scene) {
    return null;
  }

  const state = loadCurriculumState();
  const completionCount = state.completionCounts[sceneId] ?? 0;

  // 完了済みシーンの再選択時は、会話ゴールに変化を付ける
  if (completionCount > 0) {
    const variationSuffix = getConversationVariation(completionCount);
    return {
      ...scene,
      conversationGoal: `${scene.conversationGoal} (${variationSuffix})`,
      conversationGoalJa: `${scene.conversationGoalJa}（${getConversationVariationJa(completionCount)}）`,
    };
  }

  return { ...scene };
}

/**
 * 完了回数に応じた会話バリエーションの英語説明
 */
function getConversationVariation(completionCount: number): string {
  const variations = [
    'Try using more natural expressions this time',
    'Challenge yourself with longer responses',
    'Focus on using slang and casual phrases',
    'Try to lead the conversation more actively',
  ];
  return variations[(completionCount - 1) % variations.length];
}

/**
 * 完了回数に応じた会話バリエーションの日本語説明
 */
function getConversationVariationJa(completionCount: number): string {
  const variations = [
    '今回はより自然な表現を使ってみましょう',
    'より長い返答にチャレンジしましょう',
    'スラングやカジュアルな表現を使ってみましょう',
    'より積極的に会話をリードしてみましょう',
  ];
  return variations[(completionCount - 1) % variations.length];
}

/**
 * 今日のおすすめシーンを取得する
 * カリキュラムの進行日に基づいて推薦する
 *
 * Requirements: 5.4
 */
export function getTodayRecommendation(): Scene {
  const state = loadCurriculumState();
  const currentDay = calculateCurrentDay(state.startDate);

  // カリキュラム日に対応するシーンを取得
  const recommendedScene = DAY_TO_SCENE_MAP.get(currentDay);
  if (recommendedScene) {
    const { id, name, nameJa, description, descriptionJa, keyPhrases, week, day } = recommendedScene;
    return { id, name, nameJa, description, descriptionJa, keyPhrases, week, day };
  }

  // フォールバック: 最初のシーン
  const fallback = SCENES[0];
  const { id, name, nameJa, description, descriptionJa, keyPhrases, week, day } = fallback;
  return { id, name, nameJa, description, descriptionJa, keyPhrases, week, day };
}

/**
 * シーンの完了状態を取得する
 *
 * Requirements: 5.5
 */
export function getSceneStatus(sceneId: string): SceneStatus {
  const state = loadCurriculumState();

  if (state.completedSceneIds.includes(sceneId)) {
    return 'completed';
  }
  if (state.inProgressSceneIds.includes(sceneId)) {
    return 'in_progress';
  }
  return 'not_started';
}

/**
 * シーンの状態を「進行中」に更新する
 */
export function markSceneInProgress(sceneId: string): void {
  const state = loadCurriculumState();

  if (!state.inProgressSceneIds.includes(sceneId)) {
    state.inProgressSceneIds.push(sceneId);
    saveCurriculumState(state);
  }
}

/**
 * シーンの状態を「完了」に更新する
 * 完了回数もインクリメントする
 */
export function markSceneCompleted(sceneId: string): void {
  const state = loadCurriculumState();

  // in_progressから削除
  state.inProgressSceneIds = state.inProgressSceneIds.filter((id) => id !== sceneId);

  // completedに追加（重複しない）
  if (!state.completedSceneIds.includes(sceneId)) {
    state.completedSceneIds.push(sceneId);
  }

  // 完了回数をインクリメント
  state.completionCounts[sceneId] = (state.completionCounts[sceneId] ?? 0) + 1;

  saveCurriculumState(state);
}

/**
 * カリキュラム進捗を取得する
 *
 * Requirements: 5.4
 */
export function getCurriculumProgress(): CurriculumProgress {
  const state = loadCurriculumState();
  const currentDay = calculateCurrentDay(state.startDate);
  const completedDays = state.completedSceneIds.length;
  const completionRate = (completedDays / TOTAL_CURRICULUM_DAYS) * 100;

  // 現在の週を計算（1〜4）
  const currentWeek = Math.min(Math.ceil(currentDay / 7), 4);
  const weekTheme = WEEKLY_THEMES.find((t) => t.week === currentWeek);
  const weeklyTheme = weekTheme?.theme ?? WEEKLY_THEMES[0].theme;

  return {
    currentDay,
    completedDays,
    totalDays: 30,
    completionRate: Math.round(completionRate * 100) / 100,
    weeklyTheme,
  };
}

/**
 * 聞き取り問題を生成する
 * AI音声のテキストから選択式の問題を生成する
 *
 * Requirements: 9.1, 9.2, 9.3
 */
export function generateListeningQuiz(turnText: string): ListeningQuiz {
  // テキストから主要な内容を抽出して問題を生成
  const words = turnText.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return {
      question: 'What did the speaker say?',
      options: ['(No audio)', '(Could not generate options)'],
      correctIndex: 0,
      explanation: 'The audio was empty.',
    };
  }

  // 問題文を生成
  const question = `What did the speaker say?`;

  // 正解選択肢は元のテキスト
  const correctOption = turnText;

  // 不正解選択肢を生成（テキストを変形して作成）
  const distractors = generateDistractors(turnText, words);

  // 選択肢をシャッフル
  const allOptions = [correctOption, ...distractors];
  const shuffled = shuffleWithCorrectIndex(allOptions);

  return {
    question,
    options: shuffled.options,
    correctIndex: shuffled.correctIndex,
    explanation: `The speaker said: "${turnText}"`,
  };
}

/**
 * 不正解選択肢を生成する
 * 元のテキストを変形して、もっともらしい不正解を作成する
 */
function generateDistractors(originalText: string, words: string[]): string[] {
  const distractors: string[] = [];

  // 戦略1: キーワードを置換
  if (words.length >= 3) {
    const replacements: Record<string, string[]> = {
      left: ['right', 'straight'],
      right: ['left', 'straight'],
      yes: ['no', 'maybe'],
      no: ['yes', 'sure'],
      small: ['large', 'medium'],
      medium: ['small', 'large'],
      large: ['small', 'medium'],
      morning: ['afternoon', 'evening'],
      afternoon: ['morning', 'evening'],
      evening: ['morning', 'afternoon'],
      today: ['tomorrow', 'yesterday'],
      tomorrow: ['today', 'yesterday'],
      here: ['there', 'over there'],
      one: ['two', 'three'],
      two: ['one', 'three'],
      three: ['two', 'four'],
      coffee: ['tea', 'juice'],
      tea: ['coffee', 'water'],
    };

    for (const word of words) {
      const lowerWord = word.toLowerCase().replace(/[.,!?]/g, '');
      if (replacements[lowerWord] && distractors.length < 3) {
        const replacement = replacements[lowerWord][distractors.length % replacements[lowerWord].length];
        const distractor = originalText.replace(
          new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i'),
          replacement
        );
        if (distractor !== originalText && !distractors.includes(distractor)) {
          distractors.push(distractor);
        }
      }
    }
  }

  // 戦略2: 文の一部を省略
  if (distractors.length < 3 && words.length > 4) {
    const midPoint = Math.floor(words.length / 2);
    const truncated = words.slice(0, midPoint).join(' ') + '...';
    if (!distractors.includes(truncated)) {
      distractors.push(truncated);
    }
  }

  // 戦略3: 語順を変更
  if (distractors.length < 3 && words.length >= 3) {
    const reordered = [...words];
    // 最初と最後の単語を入れ替え
    const temp = reordered[0];
    reordered[0] = reordered[reordered.length - 1];
    reordered[reordered.length - 1] = temp;
    const reorderedText = reordered.join(' ');
    if (reorderedText !== originalText && !distractors.includes(reorderedText)) {
      distractors.push(reorderedText);
    }
  }

  // 最低2つの不正解選択肢を保証
  while (distractors.length < 2) {
    distractors.push(`(Similar but different expression ${distractors.length + 1})`);
  }

  return distractors.slice(0, 3);
}

/**
 * 正規表現の特殊文字をエスケープする
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 選択肢をシャッフルし、正解のインデックスを追跡する
 * 正解は常にインデックス0に入っている前提で、シャッフル後の位置を返す
 */
function shuffleWithCorrectIndex(options: string[]): { options: string[]; correctIndex: number } {
  const correctOption = options[0];
  const shuffled = [...options];

  // Fisher-Yatesシャッフル
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const correctIndex = shuffled.indexOf(correctOption);

  return { options: shuffled, correctIndex };
}
