/**
 * HomePage - ホーム画面
 *
 * 「今日の会話を始める」ボタン、今日のおすすめScene、
 * 連続学習日数、直近の理解度スコアを表示する。
 * APIキー未設定時は設定画面への誘導メッセージを表示する。
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** APIキー未設定時の誘導メッセージ */
function ApiKeyPrompt({ onNavigateSettings }: { onNavigateSettings: () => void }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
        <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-amber-800">
        APIキーを設定してください
      </h3>
      <p className="mb-4 text-sm text-amber-700">
        レッスンを始めるには、AIプロバイダーのAPIキーが必要です。
        <br />
        OpenAI、Gemini、Claudeのいずれかを設定してください。
      </p>
      <button
        onClick={onNavigateSettings}
        className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700"
      >
        設定画面へ
      </button>
    </div>
  );
}

/** 連続学習日数の表示 */
function StreakDisplay({ streak }: { streak: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
          <span className="text-lg" role="img" aria-label="炎">🔥</span>
        </div>
        <div>
          <p className="text-xs text-gray-500">連続学習</p>
          <p className="text-2xl font-bold text-gray-900">
            {streak}
            <span className="ml-1 text-sm font-normal text-gray-500">日</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** 直近の理解度スコア表示 */
function RecentScoreDisplay({ score }: { score: number | null }) {
  const scoreColor =
    score === null
      ? 'text-gray-400'
      : score >= 80
        ? 'text-green-600'
        : score >= 60
          ? 'text-yellow-600'
          : 'text-red-600';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <span className="text-lg" role="img" aria-label="スコア">📊</span>
        </div>
        <div>
          <p className="text-xs text-gray-500">直近スコア</p>
          <p className={`text-2xl font-bold ${scoreColor}`}>
            {score !== null ? (
              <>
                {score}
                <span className="ml-1 text-sm font-normal text-gray-500">点</span>
              </>
            ) : (
              <span className="text-base font-normal text-gray-400">未受講</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/** 今日のおすすめシーン表示 */
function RecommendedScene({
  sceneName,
  sceneNameJa,
  description,
  keyPhrases,
}: {
  sceneName: string;
  sceneNameJa: string;
  description: string;
  keyPhrases: string[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg" role="img" aria-label="おすすめ">⭐</span>
        <h3 className="text-sm font-medium text-gray-500">今日のおすすめ</h3>
      </div>
      <p className="text-lg font-semibold text-gray-900">{sceneNameJa}</p>
      <p className="text-sm text-gray-500">{sceneName}</p>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      {keyPhrases.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {keyPhrases.slice(0, 3).map((phrase) => (
            <span
              key={phrase}
              className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
            >
              {phrase}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 今日の学習完了バッジ */
function CompletedTodayBadge() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>今日のレッスンは完了しました！</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface HomePageProps {
  /** 設定画面への遷移コールバック */
  onNavigateSettings?: () => void;
  /** レッスン開始コールバック（シーンIDを渡す） */
  onStartLesson?: (sceneId: string) => void;
}

export function HomePage({
  onNavigateSettings,
  onStartLesson,
}: HomePageProps) {
  const { state, getTodayRecommendation, getStreak, getTodaySummary } = useApp();

  const hasApiKey = state.activeProvider !== null;

  // 今日のサマリーとおすすめシーンを取得
  const todaySummary = useMemo(() => getTodaySummary(), [getTodaySummary]);
  const recommendedScene = useMemo(() => getTodayRecommendation(), [getTodayRecommendation]);
  const streak = useMemo(() => getStreak(), [getStreak]);

  /** レッスン開始ハンドラー */
  const handleStartLesson = () => {
    if (!hasApiKey) {
      onNavigateSettings?.();
      return;
    }
    onStartLesson?.(recommendedScene.id);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Daily English</h1>
        <p className="mt-1 text-sm text-gray-500">
          毎日5〜10分の英会話トレーニング
        </p>
      </div>

      {/* APIキー未設定時の誘導 */}
      {!hasApiKey && (
        <ApiKeyPrompt
          onNavigateSettings={() => onNavigateSettings?.()}
        />
      )}

      {/* 今日の完了バッジ */}
      {todaySummary.hasCompletedToday && <CompletedTodayBadge />}

      {/* メインCTA: 今日の会話を始める */}
      <button
        onClick={handleStartLesson}
        disabled={!hasApiKey}
        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-center shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-lg"
      >
        <span className="block text-lg font-bold text-white">
          {todaySummary.hasCompletedToday
            ? 'もう一度練習する'
            : '今日の会話を始める'}
        </span>
        <span className="mt-1 block text-sm text-blue-100">
          {recommendedScene.nameJa} - {recommendedScene.name}
        </span>
      </button>

      {/* ステータスカード */}
      <div className="grid grid-cols-2 gap-4">
        <StreakDisplay streak={streak} />
        <RecentScoreDisplay score={todaySummary.recentScore} />
      </div>

      {/* おすすめシーン */}
      <RecommendedScene
        sceneName={recommendedScene.name}
        sceneNameJa={recommendedScene.nameJa}
        description={recommendedScene.descriptionJa}
        keyPhrases={recommendedScene.keyPhrases}
      />
    </div>
  );
}
