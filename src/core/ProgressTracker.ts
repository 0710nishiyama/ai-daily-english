/**
 * ProgressTracker - 学習履歴・スコア・達成率・苦手分野を記録・表示するコンポーネント
 *
 * StorageManagerと連携してレッスン結果の永続化を行い、
 * 連続学習日数、シーン別平均スコア、苦手分野の特定、
 * カリキュラム達成率の計算を提供する。
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import type { LessonResult, WeakArea, DaySummary } from '../types';
import * as StorageManager from '../infra/StorageManager';
import { getTodayRecommendation } from './LessonManager';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** カリキュラムの総日数 */
const TOTAL_CURRICULUM_DAYS = 30;

/** スキル名の定義（評価観点） */
const SKILL_NAMES: ReadonlyArray<{ key: keyof Pick<LessonResult, 'grammarScore' | 'naturalnessScore' | 'responseContentScore'>; name: string }> = [
  { key: 'grammarScore', name: 'Grammar' },
  { key: 'naturalnessScore', name: 'Naturalness' },
  { key: 'responseContentScore', name: 'Response Content' },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * StorageManagerからレッスン履歴を読み込む。
 * データが存在しない場合は空配列を返す。
 */
function loadHistory(): LessonResult[] {
  return StorageManager.load<LessonResult[]>('lesson_history') ?? [];
}

/**
 * レッスン履歴をStorageManagerに保存する。
 */
function saveHistory(history: LessonResult[]): void {
  StorageManager.save('lesson_history', history);
}

/**
 * 進捗データの永続化構造
 */
interface ProgressData {
  streak: number;
  lastPracticeDate: string;
  totalLessons: number;
  averageScore: number;
}

/**
 * StorageManagerから進捗データを読み込む。
 */
function loadProgressData(): ProgressData | null {
  return StorageManager.load<ProgressData>('progress_data');
}

/**
 * 進捗データをStorageManagerに保存する。
 */
function saveProgressData(data: ProgressData): void {
  StorageManager.save('progress_data', data);
}

/**
 * 今日の日付をISO形式（YYYY-MM-DD）で取得する。
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 日付文字列からISO日付部分（YYYY-MM-DD）を抽出する。
 * ISO 8601形式の日付文字列を想定。
 */
function extractDatePart(dateStr: string): string {
  return dateStr.split('T')[0];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * レッスン結果を保存する。
 *
 * 履歴に追加し、進捗データ（連続学習日数、平均スコア等）を更新する。
 *
 * Requirements: 7.1, 7.6
 *
 * @param result 保存するレッスン結果
 */
export function saveResult(result: LessonResult): void {
  // 履歴に追加
  const history = loadHistory();
  history.push(result);
  saveHistory(history);

  // 進捗データを更新
  const today = getTodayDateString();
  const progressData = loadProgressData();
  const newTotalLessons = (progressData?.totalLessons ?? 0) + 1;

  // 平均スコアの更新（累積平均）
  const prevTotal = (progressData?.averageScore ?? 0) * (progressData?.totalLessons ?? 0);
  const newAverageScore = (prevTotal + result.totalScore) / newTotalLessons;

  // 連続学習日数の更新
  const streak = calculateStreakFromHistory([...history]);

  saveProgressData({
    streak,
    lastPracticeDate: today,
    totalLessons: newTotalLessons,
    averageScore: Math.round(newAverageScore * 100) / 100,
  });
}

/**
 * 練習履歴を取得する。
 *
 * 新しい順にソートして返す。limitが指定された場合は件数を制限する。
 *
 * Requirements: 7.1
 *
 * @param limit 取得件数の上限（省略時は全件）
 * @returns レッスン結果の配列（新しい順）
 */
export function getHistory(limit?: number): LessonResult[] {
  const history = loadHistory();

  // 日付の降順でソート
  const sorted = history.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  if (limit !== undefined && limit > 0) {
    return sorted.slice(0, limit);
  }

  return sorted;
}

/**
 * 連続学習日数を取得する。
 *
 * 今日から遡って連続する練習日数を計算する。
 * 練習していない日が1日でもあれば、そこでストリークは途切れる。
 *
 * Requirements: 7.2
 *
 * @returns 連続学習日数
 */
export function getStreak(): number {
  const history = loadHistory();
  return calculateStreakFromHistory(history);
}

/**
 * シーン別理解度スコアを取得する。
 *
 * 各シーンの全レッスンのtotalScoreの平均値を算出する。
 *
 * Requirements: 7.3
 *
 * @returns シーンIDをキー、平均スコアを値とするMap
 */
export function getSceneScores(): Map<string, number> {
  const history = loadHistory();
  const sceneScores = new Map<string, number[]>();

  // シーンごとにスコアを集計
  for (const result of history) {
    const scores = sceneScores.get(result.sceneId) ?? [];
    scores.push(result.totalScore);
    sceneScores.set(result.sceneId, scores);
  }

  // 平均を算出
  const averages = new Map<string, number>();
  for (const [sceneId, scores] of sceneScores) {
    const sum = scores.reduce((acc, s) => acc + s, 0);
    const avg = sum / scores.length;
    averages.set(sceneId, Math.round(avg * 100) / 100);
  }

  return averages;
}

/**
 * 苦手分野を取得する。
 *
 * 全体平均を下回るスコアのシーンまたはスキルを返す。
 *
 * Requirements: 7.4
 *
 * @returns 苦手分野の配列
 */
export function getWeakAreas(): WeakArea[] {
  const history = loadHistory();

  if (history.length === 0) {
    return [];
  }

  const weakAreas: WeakArea[] = [];

  // 全体の平均totalScoreを算出
  const overallAvgScore =
    history.reduce((sum, r) => sum + r.totalScore, 0) / history.length;

  // --- シーン別の苦手分野 ---
  const sceneScores = getSceneScores();
  for (const [sceneId, avgScore] of sceneScores) {
    if (avgScore < overallAvgScore) {
      // シーン名を履歴から取得
      const sceneName =
        history.find((r) => r.sceneId === sceneId)?.sceneName ?? sceneId;
      weakAreas.push({
        type: 'scene',
        name: sceneName,
        averageScore: avgScore,
      });
    }
  }

  // --- スキル別の苦手分野 ---
  // 各スキルの全体平均を算出
  const skillAverages: Record<string, number> = {};
  for (const skill of SKILL_NAMES) {
    const sum = history.reduce((acc, r) => acc + r[skill.key], 0);
    skillAverages[skill.name] = sum / history.length;
  }

  // 全スキルの平均を算出
  const overallSkillAvg =
    Object.values(skillAverages).reduce((sum, v) => sum + v, 0) /
    SKILL_NAMES.length;

  // 全体平均を下回るスキルを苦手分野として追加
  for (const skill of SKILL_NAMES) {
    const avg = skillAverages[skill.name];
    if (avg < overallSkillAvg) {
      weakAreas.push({
        type: 'skill',
        name: skill.name,
        averageScore: Math.round(avg * 100) / 100,
      });
    }
  }

  return weakAreas;
}

/**
 * カリキュラム達成率を取得する。
 *
 * 完了日数 / 30 × 100 のパーセンテージを返す。
 * 完了日数は、ユニークな練習日の数で算出する。
 *
 * Requirements: 7.5
 *
 * @returns 達成率（パーセンテージ）
 */
export function getCompletionRate(): number {
  const history = loadHistory();

  // ユニークな練習日を集計
  const uniqueDates = new Set<string>();
  for (const result of history) {
    uniqueDates.add(extractDatePart(result.date));
  }

  const completedDays = Math.min(uniqueDates.size, TOTAL_CURRICULUM_DAYS);
  return (completedDays / TOTAL_CURRICULUM_DAYS) * 100;
}

/**
 * 今日のサマリーを取得する。
 *
 * 今日のレッスン完了状況、連続学習日数、直近のスコア、
 * おすすめシーンを返す。
 *
 * Requirements: 7.7
 *
 * @returns 今日のサマリー
 */
export function getTodaySummary(): DaySummary {
  const history = loadHistory();
  const today = getTodayDateString();

  // 今日のレッスン完了状況
  const hasCompletedToday = history.some(
    (r) => extractDatePart(r.date) === today,
  );

  // 連続学習日数
  const streak = calculateStreakFromHistory(history);

  // 直近のスコア（最新のレッスン結果）
  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const recentScore = sorted.length > 0 ? sorted[0].totalScore : null;

  // おすすめシーン
  const recommended = getTodayRecommendation();

  return {
    hasCompletedToday,
    streak,
    recentScore,
    recommendedScene: recommended.id,
  };
}

// ---------------------------------------------------------------------------
// Internal calculation helpers
// ---------------------------------------------------------------------------

/**
 * 履歴データから連続学習日数を計算する。
 *
 * 今日から遡って連続する練習日数を返す。
 * 今日練習していない場合は、昨日から遡って計算する。
 * 練習していない日が1日でもあれば、そこでストリークは途切れる。
 *
 * @param history レッスン履歴
 * @returns 連続学習日数
 */
function calculateStreakFromHistory(history: LessonResult[]): number {
  if (history.length === 0) {
    return 0;
  }

  // ユニークな練習日を集合として取得
  const practiceDates = new Set<string>();
  for (const result of history) {
    practiceDates.add(extractDatePart(result.date));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = getTodayDateString();

  // 今日練習していない場合はストリーク0
  if (!practiceDates.has(todayStr)) {
    return 0;
  }

  // 今日から遡って連続する日数を計算
  let streak = 0;
  const checkDate = new Date(today);

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (practiceDates.has(dateStr)) {
      streak++;
      // 1日前に移動
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
