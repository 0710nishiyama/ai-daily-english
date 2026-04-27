/**
 * AuthManager - メールアドレスとパスワードによる簡易ユーザー認証コンポーネント
 *
 * localStorageベースの簡易登録・ログイン機能を提供する。
 * パスワードはWeb Crypto API（SHA-256）でハッシュ化して保存する。
 * ゲストモードもサポートし、登録なしで基本機能を利用可能にする。
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import * as StorageManager from '../infra/StorageManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** ユーザーアカウント情報 */
export interface UserAccount {
  email: string;
  passwordHash: string;
  createdAt: string;
  isGuest: boolean;
}

/** 認証結果 */
export interface AuthResult {
  success: boolean;
  errorMessage?: string;
  account?: UserAccount;
}

/** 認証状態 */
export type AuthState = 'authenticated' | 'guest' | 'unauthenticated';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** 登録済みアカウント一覧の型 */
type AccountsMap = Record<string, UserAccount>;

/**
 * StorageManagerからアカウント一覧を読み込む。
 */
function loadAccounts(): AccountsMap {
  return StorageManager.load<AccountsMap>('user_account') ?? {};
}

/**
 * アカウント一覧をStorageManagerに保存する。
 */
function saveAccounts(accounts: AccountsMap): void {
  StorageManager.save('user_account', accounts);
}

/** セッション情報のキー（sessionStorageで管理） */
const SESSION_KEY = 'ai_daily_english_session';

/** セッション情報 */
interface SessionData {
  email: string;
  isGuest: boolean;
}

/**
 * 現在のセッション情報を取得する。
 */
function getSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

/**
 * セッション情報を保存する。
 */
function setSession(data: SessionData): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

/**
 * セッション情報をクリアする。
 */
function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

/**
 * Web Crypto API（SHA-256）でパスワードをハッシュ化する。
 * Web Crypto API非対応の場合は簡易ハッシュにフォールバックする。
 *
 * @param password 平文パスワード
 * @returns ハッシュ化された文字列（hex）
 */
export async function hashPassword(password: string): Promise<string> {
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  ) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // フォールバック: 簡易ハッシュ（セキュリティ低下の警告あり）
  return simpleFallbackHash(password);
}

/**
 * Web Crypto API非対応時の簡易ハッシュ。
 * セキュリティは低いが、最低限の難読化を提供する。
 */
function simpleFallbackHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // 32bit整数に変換
  }
  return `fallback_${Math.abs(hash).toString(16)}`;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * メールアドレスの簡易バリデーション。
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * パスワードの簡易バリデーション（最低6文字）。
 */
function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 新規ユーザーを登録する。
 *
 * メールアドレスとパスワードでアカウントを作成し、ログイン状態にする。
 * メールアドレスが既に登録済みの場合はエラーを返す。
 *
 * Requirements: 11.1, 11.2, 11.3
 *
 * @param email メールアドレス
 * @param password パスワード（6文字以上）
 * @returns 登録結果
 */
export async function register(
  email: string,
  password: string,
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    return {
      success: false,
      errorMessage: '有効なメールアドレスを入力してください。',
    };
  }

  if (!isValidPassword(password)) {
    return {
      success: false,
      errorMessage: 'パスワードは6文字以上で入力してください。',
    };
  }

  const accounts = loadAccounts();

  if (accounts[normalizedEmail]) {
    return {
      success: false,
      errorMessage: 'このメールアドレスは既に登録されています。',
    };
  }

  const passwordHash = await hashPassword(password);
  const account: UserAccount = {
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
    isGuest: false,
  };

  accounts[normalizedEmail] = account;
  saveAccounts(accounts);

  // ログイン状態にする
  setSession({ email: normalizedEmail, isGuest: false });

  return { success: true, account };
}

/**
 * ログインする。
 *
 * メールアドレスとパスワードで認証し、成功時にログイン状態にする。
 *
 * Requirements: 11.2
 *
 * @param email メールアドレス
 * @param password パスワード
 * @returns ログイン結果
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const accounts = loadAccounts();
  const account = accounts[normalizedEmail];

  if (!account) {
    return {
      success: false,
      errorMessage: 'メールアドレスまたはパスワードが正しくありません。',
    };
  }

  const passwordHash = await hashPassword(password);

  if (account.passwordHash !== passwordHash) {
    return {
      success: false,
      errorMessage: 'メールアドレスまたはパスワードが正しくありません。',
    };
  }

  // ログイン状態にする
  setSession({ email: normalizedEmail, isGuest: false });

  return { success: true, account };
}

/**
 * ゲストモードで利用を開始する。
 *
 * ユーザー登録なしで基本機能を利用可能にする。
 *
 * Requirements: 11.4
 *
 * @returns ゲストアカウント情報
 */
export function loginAsGuest(): AuthResult {
  const guestAccount: UserAccount = {
    email: 'guest',
    passwordHash: '',
    createdAt: new Date().toISOString(),
    isGuest: true,
  };

  setSession({ email: 'guest', isGuest: true });

  return { success: true, account: guestAccount };
}

/**
 * ログアウトする。
 *
 * セッション情報をクリアする。
 */
export function logout(): void {
  clearSession();
}

/**
 * 現在の認証状態を取得する。
 *
 * @returns 認証状態（authenticated / guest / unauthenticated）
 */
export function getAuthState(): AuthState {
  const session = getSession();
  if (!session) return 'unauthenticated';
  if (session.isGuest) return 'guest';
  return 'authenticated';
}

/**
 * 現在ログイン中のアカウント情報を取得する。
 *
 * @returns ログイン中のアカウント情報、未ログイン時はnull
 */
export function getCurrentUser(): UserAccount | null {
  const session = getSession();
  if (!session) return null;

  if (session.isGuest) {
    return {
      email: 'guest',
      passwordHash: '',
      createdAt: '',
      isGuest: true,
    };
  }

  const accounts = loadAccounts();
  return accounts[session.email] ?? null;
}

/**
 * ユーザーが認証済み（ゲスト含む）かどうかを返す。
 */
export function isAuthenticated(): boolean {
  return getAuthState() !== 'unauthenticated';
}
