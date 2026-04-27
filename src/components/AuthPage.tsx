/**
 * AuthPage - 認証画面（登録・ログイン）
 *
 * メールアドレスとパスワードによる登録・ログインフォーム、
 * ゲストモードでの利用開始ボタンを提供する。
 * 重複メールエラーなどのエラーメッセージをインライン表示する。
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 認証モード: 登録 or ログイン */
type AuthMode = 'register' | 'login';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** モード切り替えタブ */
function AuthModeTabs({
  mode,
  onChangeMode,
}: {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
}) {
  return (
    <div className="flex" role="tablist" aria-label="認証モード切り替え">
      <button
        role="tab"
        aria-selected={mode === 'register'}
        onClick={() => onChangeMode('register')}
        className={`flex-1 border-b-2 py-3 text-center text-sm font-medium transition-colors ${
          mode === 'register'
            ? 'border-blue-600 text-blue-600'
            : 'border-gray-200 text-gray-500 hover:text-gray-700'
        }`}
      >
        登録
      </button>
      <button
        role="tab"
        aria-selected={mode === 'login'}
        onClick={() => onChangeMode('login')}
        className={`flex-1 border-b-2 py-3 text-center text-sm font-medium transition-colors ${
          mode === 'login'
            ? 'border-blue-600 text-blue-600'
            : 'border-gray-200 text-gray-500 hover:text-gray-700'
        }`}
      >
        ログイン
      </button>
    </div>
  );
}

/** エラーメッセージ表示 */
function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"
    >
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/** 登録フォーム */
function RegisterForm({
  onSubmit,
  isLoading,
  localError,
}: {
  onSubmit: (email: string, password: string) => void;
  isLoading: boolean;
  localError: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(null);

      if (password.length < 6) {
        setValidationError('パスワードは6文字以上で入力してください。');
        return;
      }

      if (password !== confirmPassword) {
        setValidationError('パスワードが一致しません。');
        return;
      }

      onSubmit(email, password);
    },
    [email, password, confirmPassword, onSubmit],
  );

  const displayError = validationError ?? localError;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {displayError && <ErrorMessage message={displayError} />}

      <div>
        <label
          htmlFor="register-email"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          メールアドレス
        </label>
        <input
          id="register-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@mail.com"
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="register-password"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          パスワード（6文字以上）
        </label>
        <input
          id="register-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6文字以上"
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="register-confirm-password"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          パスワード（確認）
        </label>
        <input
          id="register-confirm-password"
          type="password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="もう一度入力"
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !email || !password || !confirmPassword}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? '登録中...' : 'アカウントを作成'}
      </button>
    </form>
  );
}

/** ログインフォーム */
function LoginForm({
  onSubmit,
  isLoading,
  localError,
}: {
  onSubmit: (email: string, password: string) => void;
  isLoading: boolean;
  localError: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(email, password);
    },
    [email, password, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {localError && <ErrorMessage message={localError} />}

      <div>
        <label
          htmlFor="login-email"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          メールアドレス
        </label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@mail.com"
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="login-password"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          パスワード
        </label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワードを入力"
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !email || !password}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  );
}

/** ゲストモード開始ボタン */
function GuestModeButton({
  onGuestLogin,
}: {
  onGuestLogin: () => void;
}) {
  return (
    <div className="text-center">
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-3 text-sm text-gray-500">または</span>
        </div>
      </div>
      <button
        onClick={onGuestLogin}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        ゲストとして利用する
      </button>
      <p className="mt-2 text-xs text-gray-500">
        登録なしで基本機能をお試しいただけます
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface AuthPageProps {
  /** 認証成功時のコールバック */
  onAuthSuccess?: () => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const { state, register, login, loginAsGuest, dispatch } = useApp();

  const [mode, setMode] = useState<AuthMode>('register');

  /** モード切り替え時にエラーをクリア */
  const handleChangeMode = useCallback(
    (newMode: AuthMode) => {
      setMode(newMode);
      dispatch({ type: 'SET_ERROR', error: null });
    },
    [dispatch],
  );

  /** 登録ハンドラー */
  const handleRegister = useCallback(
    async (email: string, password: string) => {
      const success = await register(email, password);
      if (success) {
        onAuthSuccess?.();
      }
    },
    [register, onAuthSuccess],
  );

  /** ログインハンドラー */
  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const success = await login(email, password);
      if (success) {
        onAuthSuccess?.();
      }
    },
    [login, onAuthSuccess],
  );

  /** ゲストモードハンドラー */
  const handleGuestLogin = useCallback(() => {
    loginAsGuest();
    onAuthSuccess?.();
  }, [loginAsGuest, onAuthSuccess]);

  return (
    <div className="mx-auto max-w-md space-y-6 p-4 sm:p-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">AI Daily English</h1>
        <p className="mt-1 text-sm text-gray-500">
          毎日5〜10分の英会話トレーニング
        </p>
      </div>

      {/* 認証フォームカード */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* タブ */}
        <AuthModeTabs mode={mode} onChangeMode={handleChangeMode} />

        {/* フォーム */}
        <div className="p-6">
          {mode === 'register' ? (
            <RegisterForm
              onSubmit={handleRegister}
              isLoading={state.isLoading}
              localError={state.error}
            />
          ) : (
            <LoginForm
              onSubmit={handleLogin}
              isLoading={state.isLoading}
              localError={state.error}
            />
          )}
        </div>
      </div>

      {/* ゲストモード */}
      <GuestModeButton onGuestLogin={handleGuestLogin} />
    </div>
  );
}
