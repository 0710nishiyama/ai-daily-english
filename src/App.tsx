/**
 * App - アプリケーションルート
 *
 * React Routerによるルーティング設定、ナビゲーションバー、
 * AppContextProviderによる全画面ラップ、APIキー未設定時のガード、
 * レッスン全体フロー（開始→会話→評価→保存）の統合を実装する。
 *
 * Requirements: 8.3, 8.4, 全体
 */

import { useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AppContextProvider, useApp } from './contexts/AppContext';
import { NavigationBar } from './components/NavigationBar';
import { HomePage } from './components/HomePage';
import { LessonPage } from './components/LessonPage';
import { EvaluationPage } from './components/EvaluationPage';
import { SettingsPage } from './components/SettingsPage';
import { ProgressPage } from './components/ProgressPage';
import { AuthPage } from './components/AuthPage';

// ---------------------------------------------------------------------------
// APIキーガード付きレッスンラッパー
// ---------------------------------------------------------------------------

/**
 * APIキー未設定時にレッスン画面へのアクセスをガードし、
 * 設定画面への誘導メッセージを表示するコンポーネント。
 *
 * Requirements: 8.4
 */
function LessonGuard() {
  const { state } = useApp();
  const navigate = useNavigate();

  const hasApiKey = state.activeProvider !== null;

  if (!hasApiKey) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="h-7 w-7 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-amber-800">
            APIキーが設定されていません
          </h2>
          <p className="mb-6 text-sm text-amber-700">
            レッスンを始めるには、AIプロバイダーのAPIキーを設定してください。
            <br />
            OpenAI、Gemini、Claudeのいずれかに対応しています。
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            設定画面へ移動
          </button>
        </div>
      </div>
    );
  }

  return <LessonPageWithNavigation />;
}

// ---------------------------------------------------------------------------
// ナビゲーション統合されたページコンポーネント
// ---------------------------------------------------------------------------

/**
 * ホーム画面 - ナビゲーションコールバック付き
 * 「今日の会話を始める」ボタンでレッスン画面へ遷移し、
 * APIキー未設定時は設定画面へ誘導する。
 *
 * Requirements: 8.3, 8.4
 */
function HomePageWithNavigation() {
  const navigate = useNavigate();
  const { state, startLesson } = useApp();

  const handleNavigateSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  /**
   * レッスン開始ハンドラー
   * ホーム画面の「今日の会話を始める」ボタンから呼ばれる。
   * APIキーが設定されていればレッスン画面に遷移し、
   * レッスンを自動的に開始する。
   *
   * Requirements: 8.3
   */
  const handleStartLesson = useCallback(
    async (sceneId: string) => {
      if (!state.activeProvider) {
        navigate('/settings');
        return;
      }

      try {
        // レッスンを開始してからレッスン画面に遷移
        await startLesson(sceneId);
        navigate('/lesson');
      } catch {
        // エラーはAppContext経由でstate.errorに反映される
        // レッスン画面に遷移してエラーを表示
        navigate('/lesson');
      }
    },
    [state.activeProvider, startLesson, navigate],
  );

  return (
    <HomePage
      onNavigateSettings={handleNavigateSettings}
      onStartLesson={handleStartLesson}
    />
  );
}

/**
 * レッスン画面 - ナビゲーションコールバック付き
 * 評価完了時に評価画面へ遷移する。
 */
function LessonPageWithNavigation() {
  const navigate = useNavigate();

  const handleNavigateEvaluation = useCallback(() => {
    navigate('/evaluation');
  }, [navigate]);

  const handleNavigateHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <LessonPage
      onNavigateEvaluation={handleNavigateEvaluation}
      onNavigateHome={handleNavigateHome}
    />
  );
}

/**
 * 評価画面 - ナビゲーションコールバック付き
 * レッスン結果を保存してホームに戻る、またはもう一度練習する。
 */
function EvaluationPageWithNavigation() {
  const navigate = useNavigate();

  const handleNavigateHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleRetryLesson = useCallback(() => {
    navigate('/lesson');
  }, [navigate]);

  return (
    <EvaluationPage
      onNavigateHome={handleNavigateHome}
      onRetryLesson={handleRetryLesson}
    />
  );
}

/**
 * 認証画面 - 認証成功時にホームへ遷移
 */
function AuthPageWithNavigation() {
  const navigate = useNavigate();

  const handleAuthSuccess = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return <AuthPage onAuthSuccess={handleAuthSuccess} />;
}

// ---------------------------------------------------------------------------
// App layout
// ---------------------------------------------------------------------------

/**
 * メインレイアウト
 * ナビゲーションバーとルーティングされたページコンテンツを含む。
 */
function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* デスクトップ: 上部ナビゲーション */}
      <div className="hidden sm:block">
        <NavigationBar />
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 pb-20 sm:pb-4">
        <Routes>
          <Route path="/" element={<HomePageWithNavigation />} />
          <Route path="/lesson" element={<LessonGuard />} />
          <Route path="/evaluation" element={<EvaluationPageWithNavigation />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/auth" element={<AuthPageWithNavigation />} />
        </Routes>
      </main>

      {/* モバイル: 下部ナビゲーション */}
      <div className="sm:hidden">
        <NavigationBar />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root App component
// ---------------------------------------------------------------------------

function App() {
  return (
    <BrowserRouter>
      <AppContextProvider>
        <AppLayout />
      </AppContextProvider>
    </BrowserRouter>
  );
}

export default App;
