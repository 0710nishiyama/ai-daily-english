/**
 * EvaluationPage - 評価結果画面
 *
 * レッスン終了後の評価結果を表示する。
 * 文法・自然さ・返答内容の3観点スコア、総合スコア（100点満点）、
 * ユーザー発話と改善後の表現の並列表示、スラング使用フィードバックを含む。
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import type {
  EvaluationResult,
  EvaluationScore,
  Improvement,
  SlangFeedback,
} from '../types';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** 総合スコアの円形インジケーター */
function TotalScoreCircle({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const scoreColor =
    score >= 80
      ? 'text-green-600'
      : score >= 60
        ? 'text-yellow-600'
        : 'text-red-600';

  const strokeColor =
    score >= 80
      ? 'stroke-green-500'
      : score >= 60
        ? 'stroke-yellow-500'
        : 'stroke-red-500';

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg
          className="-rotate-90"
          viewBox="0 0 120 120"
          aria-hidden="true"
        >
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            className={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${scoreColor}`}>
            {score}
          </span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-gray-700">総合スコア</p>
    </div>
  );
}

/** 観点別スコアカード */
function AspectScoreCard({
  label,
  labelJa,
  score,
}: {
  label: string;
  labelJa: string;
  score: EvaluationScore;
}) {
  const barWidth = (score.score / 5) * 100;

  const barColor =
    score.score >= 4
      ? 'bg-green-500'
      : score.score >= 3
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{labelJa}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
        <span className="text-2xl font-bold text-gray-900">
          {score.score}
          <span className="text-sm font-normal text-gray-400">/5</span>
        </span>
      </div>

      {/* スコアバー */}
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{
            width: `${barWidth}%`,
            transition: 'width 0.6s ease-out',
          }}
        />
      </div>

      {/* フィードバック */}
      <p className="text-sm text-gray-700">{score.feedback}</p>
      <p className="mt-1 text-sm text-gray-500">{score.feedbackJa}</p>
    </div>
  );
}

/** 改善例カード（before / after） */
function ImprovementCard({ improvement }: { improvement: Improvement }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* ユーザー発話（before） */}
        <div className="rounded-lg bg-red-50 p-3">
          <p className="mb-1 text-xs font-medium text-red-600">
            あなたの表現
          </p>
          <p className="text-sm text-red-900">{improvement.original}</p>
        </div>

        {/* 改善後（after） */}
        <div className="rounded-lg bg-green-50 p-3">
          <p className="mb-1 text-xs font-medium text-green-600">
            より自然な表現
          </p>
          <p className="text-sm text-green-900">{improvement.improved}</p>
        </div>
      </div>

      {/* 解説 */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        <p className="text-sm text-gray-700">{improvement.explanation}</p>
        <p className="mt-1 text-sm text-gray-500">
          {improvement.explanationJa}
        </p>
      </div>
    </div>
  );
}

/** スラングフィードバックカード */
function SlangFeedbackCard({ feedback }: { feedback: SlangFeedback }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg p-3 ${
        feedback.isPositive ? 'bg-green-50' : 'bg-amber-50'
      }`}
    >
      <span className="mt-0.5 text-lg" aria-hidden="true">
        {feedback.isPositive ? '👍' : '💡'}
      </span>
      <div>
        <p
          className={`text-sm font-medium ${
            feedback.isPositive ? 'text-green-900' : 'text-amber-900'
          }`}
        >
          &ldquo;{feedback.expression}&rdquo;
        </p>
        <p
          className={`mt-0.5 text-sm ${
            feedback.isPositive ? 'text-green-700' : 'text-amber-700'
          }`}
        >
          {feedback.comment}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {feedback.commentJa}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface EvaluationPageProps {
  /** ホーム画面への遷移コールバック */
  onNavigateHome?: () => void;
  /** もう一度練習するコールバック */
  onRetryLesson?: () => void;
}

export function EvaluationPage({
  onNavigateHome,
  onRetryLesson,
}: EvaluationPageProps) {
  const { state, dispatch, saveLessonResult } = useApp();

  const result: EvaluationResult | null = state.evaluationResult;

  // レッスン結果を保存してホームに戻る
  const handleGoHome = useCallback(() => {
    if (result && state.currentSceneId) {
      const scenes = state.conversationHistory;
      const durationMs = state.lessonStartTime
        ? Date.now() - state.lessonStartTime
        : 0;

      saveLessonResult({
        id: `lesson-${Date.now()}`,
        date: new Date().toISOString(),
        sceneId: state.currentSceneId,
        sceneName: state.currentSceneId,
        totalScore: result.totalScore,
        grammarScore: result.grammar.score,
        naturalnessScore: result.naturalness.score,
        responseContentScore: result.responseContent.score,
        conversationTurns: scenes.length,
        durationMinutes: Math.round(durationMs / 60000),
      });
    }

    dispatch({ type: 'RESET_LESSON' });
    onNavigateHome?.();
  }, [
    result,
    state.currentSceneId,
    state.conversationHistory,
    state.lessonStartTime,
    saveLessonResult,
    dispatch,
    onNavigateHome,
  ]);

  // もう一度練習する
  const handleRetry = useCallback(() => {
    dispatch({ type: 'RESET_LESSON' });
    onRetryLesson?.();
  }, [dispatch, onRetryLesson]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-500">評価結果がありません</p>
          <button
            onClick={() => {
              dispatch({ type: 'RESET_LESSON' });
              onNavigateHome?.();
            }}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">レッスン評価</h1>
        <p className="mt-1 text-sm text-gray-500">
          お疲れさまでした！あなたの会話を評価しました
        </p>
      </div>

      {/* 総合スコア */}
      <div className="flex justify-center rounded-xl border border-gray-200 bg-white py-8 shadow-sm">
        <TotalScoreCircle score={result.totalScore} />
      </div>

      {/* 3観点スコア */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          観点別スコア
        </h2>
        <div className="space-y-3">
          <AspectScoreCard
            label="Grammar"
            labelJa="文法"
            score={result.grammar}
          />
          <AspectScoreCard
            label="Naturalness"
            labelJa="自然さ"
            score={result.naturalness}
          />
          <AspectScoreCard
            label="Response Content"
            labelJa="返答内容"
            score={result.responseContent}
          />
        </div>
      </section>

      {/* 改善例 */}
      {result.improvements.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            改善ポイント
          </h2>
          <div className="space-y-3">
            {result.improvements.map((imp, i) => (
              <ImprovementCard key={i} improvement={imp} />
            ))}
          </div>
        </section>
      )}

      {/* スラングフィードバック */}
      {result.slangUsage.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            スラング・自然表現フィードバック
          </h2>
          <div className="space-y-2">
            {result.slangUsage.map((fb, i) => (
              <SlangFeedbackCard key={i} feedback={fb} />
            ))}
          </div>
        </section>
      )}

      {/* アクションボタン */}
      <div className="flex gap-3 pb-6">
        <button
          onClick={handleGoHome}
          className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          ホームに戻る
        </button>
        <button
          onClick={handleRetry}
          className="flex-1 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          もう一度練習する
        </button>
      </div>
    </div>
  );
}
