/**
 * ProgressPage - 進捗画面
 *
 * 日別練習履歴の一覧、連続学習日数、シーン別理解度スコアのグラフ、
 * 苦手分野の表示、カリキュラム達成率のパーセンテージ表示を提供する。
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7
 */

import { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import type { LessonResult, WeakArea } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 日付文字列を「MM/DD（曜日）」形式にフォーマットする */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${month}/${day}（${weekday}）`;
}

/** スコアに応じた色クラスを返す */
function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

/** スコアに応じたバーの背景色クラスを返す */
function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

/** スコアに応じたバッジの背景色クラスを返す */
function badgeColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** 今日のサマリー表示 (Req 7.7) */
function TodaySummaryCard({
  hasCompletedToday,
  streak,
  recentScore,
}: {
  hasCompletedToday: boolean;
  streak: number;
  recentScore: number | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-900">今日のステータス</h2>
      <div className="grid grid-cols-3 gap-4 text-center">
        {/* レッスン状況 */}
        <div>
          <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <span className="text-lg" role="img" aria-label="レッスン状況">
              {hasCompletedToday ? '✅' : '📝'}
            </span>
          </div>
          <p className="text-xs text-gray-500">今日のレッスン</p>
          <p className="text-sm font-semibold text-gray-900">
            {hasCompletedToday ? '完了' : '未完了'}
          </p>
        </div>

        {/* 連続学習日数 */}
        <div>
          <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
            <span className="text-lg" role="img" aria-label="連続学習">🔥</span>
          </div>
          <p className="text-xs text-gray-500">連続学習</p>
          <p className="text-sm font-semibold text-gray-900">
            {streak}<span className="ml-0.5 text-xs font-normal text-gray-500">日</span>
          </p>
        </div>

        {/* 直近スコア */}
        <div>
          <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
            <span className="text-lg" role="img" aria-label="スコア">📊</span>
          </div>
          <p className="text-xs text-gray-500">直近スコア</p>
          <p className={`text-sm font-semibold ${recentScore !== null ? scoreColor(recentScore) : 'text-gray-400'}`}>
            {recentScore !== null ? `${recentScore}点` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

/** 連続学習日数の表示 (Req 7.2) */
function StreakCard({ streak }: { streak: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
          <span className="text-2xl" role="img" aria-label="炎">🔥</span>
        </div>
        <div>
          <p className="text-sm text-gray-500">連続学習日数</p>
          <p className="text-3xl font-bold text-gray-900">
            {streak}
            <span className="ml-1 text-base font-normal text-gray-500">日</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** カリキュラム達成率の表示 (Req 7.5) */
function CompletionRateCard({ rate }: { rate: number }) {
  const clampedRate = Math.min(100, Math.max(0, Math.round(rate)));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-900">カリキュラム達成率</h2>
      <div className="flex items-end gap-3">
        <p className="text-4xl font-bold text-blue-600">
          {clampedRate}
          <span className="text-lg font-normal text-gray-500">%</span>
        </p>
        <p className="mb-1 text-sm text-gray-500">/ 30日間</p>
      </div>
      {/* プログレスバー */}
      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={clampedRate}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`カリキュラム達成率 ${clampedRate}%`}
      >
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${clampedRate}%` }}
        />
      </div>
    </div>
  );
}

/** シーン別理解度スコアのグラフ表示 (Req 7.3) */
function SceneScoresChart({ scores }: { scores: Map<string, number> }) {
  const entries = useMemo(
    () => Array.from(scores.entries()).sort((a, b) => b[1] - a[1]),
    [scores],
  );

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">シーン別理解度</h2>
        <p className="text-sm text-gray-400">まだデータがありません</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">シーン別理解度</h2>
      <div className="space-y-3" role="list" aria-label="シーン別理解度スコア">
        {entries.map(([sceneName, score]) => (
          <div key={sceneName} role="listitem">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-gray-700">{sceneName}</span>
              <span className={`text-sm font-semibold ${scoreColor(score)}`}>
                {Math.round(score)}点
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${barColor(score)}`}
                style={{ width: `${Math.min(100, score)}%` }}
                role="meter"
                aria-valuenow={Math.round(score)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${sceneName}: ${Math.round(score)}点`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 苦手分野の表示 (Req 7.4) */
function WeakAreasCard({ weakAreas }: { weakAreas: WeakArea[] }) {
  if (weakAreas.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">苦手分野</h2>
        <p className="text-sm text-gray-400">苦手分野はまだ特定されていません</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-900">苦手分野</h2>
      <ul className="space-y-2" aria-label="苦手分野一覧">
        {weakAreas.map((area) => (
          <li
            key={`${area.type}-${area.name}`}
            className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  area.type === 'scene'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}
              >
                {area.type === 'scene' ? 'シーン' : 'スキル'}
              </span>
              <span className="text-sm font-medium text-gray-800">{area.name}</span>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColor(area.averageScore)}`}>
              {Math.round(area.averageScore)}点
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 日別練習履歴の一覧表示 (Req 7.1) */
function HistoryList({ history }: { history: LessonResult[] }) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">練習履歴</h2>
        <p className="text-sm text-gray-400">まだ練習履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-900">練習履歴</h2>
      <ul className="divide-y divide-gray-100" aria-label="練習履歴一覧">
        {history.map((result) => (
          <li key={result.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-gray-800">{result.sceneName}</p>
              <p className="text-xs text-gray-500">{formatDate(result.date)}</p>
            </div>
            <span className={`text-lg font-bold ${scoreColor(result.totalScore)}`}>
              {result.totalScore}
              <span className="ml-0.5 text-xs font-normal text-gray-500">点</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProgressPage() {
  const {
    getHistory,
    getStreak,
    getSceneScores,
    getWeakAreas,
    getCompletionRate,
    getTodaySummary,
  } = useApp();

  // 各データを取得
  const todaySummary = useMemo(() => getTodaySummary(), [getTodaySummary]);
  const streak = useMemo(() => getStreak(), [getStreak]);
  const completionRate = useMemo(() => getCompletionRate(), [getCompletionRate]);
  const sceneScores = useMemo(() => getSceneScores(), [getSceneScores]);
  const weakAreas = useMemo(() => getWeakAreas(), [getWeakAreas]);
  const history = useMemo(() => getHistory(30), [getHistory]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">学習の進捗</h1>
        <p className="mt-1 text-sm text-gray-500">
          あなたの学習履歴と成長を確認できます
        </p>
      </div>

      {/* 今日のサマリー (Req 7.7) */}
      <TodaySummaryCard
        hasCompletedToday={todaySummary.hasCompletedToday}
        streak={todaySummary.streak}
        recentScore={todaySummary.recentScore}
      />

      {/* 連続学習日数 & 達成率 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 連続学習日数 (Req 7.2) */}
        <StreakCard streak={streak} />
        {/* カリキュラム達成率 (Req 7.5) */}
        <CompletionRateCard rate={completionRate} />
      </div>

      {/* シーン別理解度スコアのグラフ (Req 7.3) */}
      <SceneScoresChart scores={sceneScores} />

      {/* 苦手分野 (Req 7.4) */}
      <WeakAreasCard weakAreas={weakAreas} />

      {/* 練習履歴 (Req 7.1) */}
      <HistoryList history={history} />
    </div>
  );
}
