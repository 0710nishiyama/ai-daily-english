/**
 * AppContext - アプリケーション全体の状態管理
 *
 * React Context + useReducerで以下の状態を管理する:
 * - アクティブプロバイダー
 * - レッスン状態
 * - ユーザー設定
 * - 認証状態
 *
 * 各コアコンポーネント（ConversationEngine、LessonManager、EvaluationEngine、ProgressTracker）
 * のインスタンス管理も提供する。
 *
 * Requirements: 全体
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';

import type {
  AIProvider,
  DifficultyLevel,
  ConversationTurn,
  EvaluationResult,
  LessonResult,
  DaySummary,
  Scene,
  SceneStatus,
  CurriculumProgress,
  CostEstimate,
  ConnectionTestResult,
  HintData,
  ListeningQuiz,
  WeakArea,
} from '../types';

import { ConversationEngine } from '../core/ConversationEngine';
import { EvaluationEngine } from '../core/EvaluationEngine';
import * as LessonManager from '../core/LessonManager';
import * as ProgressTracker from '../core/ProgressTracker';
import * as APIKeyManager from '../infra/APIKeyManager';
import { createAdapter } from '../infra/AIProviderAdapter';
import type { AuthState, UserAccount } from '../core/AuthManager';
import * as AuthManager from '../core/AuthManager';

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

/** レッスンの進行フェーズ */
export type LessonPhase =
  | 'idle'
  | 'scene_select'
  | 'conversation'
  | 'evaluation'
  | 'completed';

/** ユーザー設定 */
export interface UserSettings {
  speechRate: number;
  showHints: boolean;
  showJapanese: boolean;
  difficultyLevel: DifficultyLevel;
  monthlyLessonLimit: number;
  /** 選択された音声名（nullの場合は自動選択） */
  selectedVoiceName: string | null;
}

/** アプリケーション全体の状態 */
export interface AppState {
  // 認証
  authState: AuthState;
  currentUser: UserAccount | null;

  // AIプロバイダー
  activeProvider: AIProvider | null;

  // レッスン状態
  lessonPhase: LessonPhase;
  currentSceneId: string | null;
  conversationHistory: ConversationTurn[];
  evaluationResult: EvaluationResult | null;
  lessonStartTime: number | null;

  // ユーザー設定
  settings: UserSettings;

  // UI状態
  isLoading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type AppAction =
  | { type: 'SET_AUTH'; authState: AuthState; user: UserAccount | null }
  | { type: 'SET_ACTIVE_PROVIDER'; provider: AIProvider | null }
  | { type: 'SET_LESSON_PHASE'; phase: LessonPhase }
  | { type: 'SET_CURRENT_SCENE'; sceneId: string | null }
  | { type: 'SET_CONVERSATION_HISTORY'; history: ConversationTurn[] }
  | { type: 'ADD_CONVERSATION_TURN'; turn: ConversationTurn }
  | { type: 'SET_EVALUATION_RESULT'; result: EvaluationResult | null }
  | { type: 'SET_LESSON_START_TIME'; time: number | null }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<UserSettings> }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET_LESSON' };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: UserSettings = {
  speechRate: 1.0,
  showHints: true,
  showJapanese: true,
  difficultyLevel: 'beginner',
  monthlyLessonLimit: 0,
  selectedVoiceName: null,
};

function createInitialState(): AppState {
  return {
    authState: AuthManager.getAuthState(),
    currentUser: AuthManager.getCurrentUser(),
    activeProvider: APIKeyManager.getActiveProvider(),
    lessonPhase: 'idle',
    currentSceneId: null,
    conversationHistory: [],
    evaluationResult: null,
    lessonStartTime: null,
    settings: { ...DEFAULT_SETTINGS },
    isLoading: false,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_AUTH':
      return {
        ...state,
        authState: action.authState,
        currentUser: action.user,
      };

    case 'SET_ACTIVE_PROVIDER':
      return {
        ...state,
        activeProvider: action.provider,
      };

    case 'SET_LESSON_PHASE':
      return {
        ...state,
        lessonPhase: action.phase,
      };

    case 'SET_CURRENT_SCENE':
      return {
        ...state,
        currentSceneId: action.sceneId,
      };

    case 'SET_CONVERSATION_HISTORY':
      return {
        ...state,
        conversationHistory: action.history,
      };

    case 'ADD_CONVERSATION_TURN':
      return {
        ...state,
        conversationHistory: [...state.conversationHistory, action.turn],
      };

    case 'SET_EVALUATION_RESULT':
      return {
        ...state,
        evaluationResult: action.result,
      };

    case 'SET_LESSON_START_TIME':
      return {
        ...state,
        lessonStartTime: action.time,
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.isLoading,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
      };

    case 'RESET_LESSON':
      return {
        ...state,
        lessonPhase: 'idle',
        currentSceneId: null,
        conversationHistory: [],
        evaluationResult: null,
        lessonStartTime: null,
        error: null,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------

export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;

  // 認証アクション
  register: (email: string, password: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  loginAsGuest: () => void;
  logout: () => void;

  // APIキー管理アクション
  saveApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
  deleteApiKey: (provider: AIProvider) => Promise<void>;
  testConnection: (provider: AIProvider) => Promise<ConnectionTestResult>;
  getEstimatedCost: (provider: AIProvider) => CostEstimate;

  // レッスンアクション
  startLesson: (sceneId: string) => Promise<ConversationTurn>;
  sendMessage: (userText: string) => Promise<ConversationTurn>;
  getHint: () => Promise<HintData>;
  isLessonComplete: () => boolean;
  evaluateLesson: () => Promise<EvaluationResult>;
  saveLessonResult: (result: LessonResult) => void;

  // シーン・カリキュラム
  getScenes: () => Scene[];
  getSceneStatus: (sceneId: string) => SceneStatus;
  getTodayRecommendation: () => Scene;
  getCurriculumProgress: () => CurriculumProgress;
  generateListeningQuiz: (turnText: string) => ListeningQuiz;

  // 進捗
  getHistory: (limit?: number) => LessonResult[];
  getStreak: () => number;
  getSceneScores: () => Map<string, number>;
  getWeakAreas: () => WeakArea[];
  getCompletionRate: () => number;
  getTodaySummary: () => DaySummary;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AppContext = createContext<AppContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  // コアコンポーネントのインスタンスをrefで管理
  const conversationEngineRef = useRef<ConversationEngine | null>(null);
  const evaluationEngineRef = useRef<EvaluationEngine | null>(null);

  // アクティブプロバイダー変更時にエンジンインスタンスをリセット
  useEffect(() => {
    conversationEngineRef.current = null;
    evaluationEngineRef.current = null;
  }, [state.activeProvider]);

  /**
   * 現在のプロバイダーでAIProviderAdapterを生成する。
   * APIキーが未設定の場合はエラーをスローする。
   */
  const getOrCreateAdapter = useCallback(async () => {
    const provider = state.activeProvider;
    if (!provider) {
      throw new Error('AIプロバイダーが設定されていません。設定画面でAPIキーを登録してください。');
    }

    const apiKey = await APIKeyManager.getApiKey(provider);
    if (!apiKey) {
      throw new Error('APIキーが設定されていません。設定画面でAPIキーを登録してください。');
    }

    return createAdapter(provider, apiKey);
  }, [state.activeProvider]);

  // -----------------------------------------------------------------------
  // 認証アクション
  // -----------------------------------------------------------------------

  const register = useCallback(async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const result = await AuthManager.register(email, password);
      if (result.success && result.account) {
        dispatch({
          type: 'SET_AUTH',
          authState: 'authenticated',
          user: result.account,
        });
        return true;
      }
      dispatch({ type: 'SET_ERROR', error: result.errorMessage ?? '登録に失敗しました。' });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, []);

  const loginAction = useCallback(async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const result = await AuthManager.login(email, password);
      if (result.success && result.account) {
        dispatch({
          type: 'SET_AUTH',
          authState: 'authenticated',
          user: result.account,
        });
        return true;
      }
      dispatch({ type: 'SET_ERROR', error: result.errorMessage ?? 'ログインに失敗しました。' });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, []);

  const loginAsGuest = useCallback(() => {
    const result = AuthManager.loginAsGuest();
    if (result.success && result.account) {
      dispatch({
        type: 'SET_AUTH',
        authState: 'guest',
        user: result.account,
      });
    }
  }, []);

  const logoutAction = useCallback(() => {
    AuthManager.logout();
    dispatch({
      type: 'SET_AUTH',
      authState: 'unauthenticated',
      user: null,
    });
    dispatch({ type: 'RESET_LESSON' });
  }, []);

  // -----------------------------------------------------------------------
  // APIキー管理アクション
  // -----------------------------------------------------------------------

  const saveApiKey = useCallback(async (provider: AIProvider, apiKey: string) => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      await APIKeyManager.saveApiKey(provider, apiKey);
      dispatch({ type: 'SET_ACTIVE_PROVIDER', provider });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'APIキーの保存に失敗しました。';
      dispatch({ type: 'SET_ERROR', error: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, []);

  const deleteApiKey = useCallback(async (provider: AIProvider) => {
    await APIKeyManager.deleteApiKey(provider);
    if (state.activeProvider === provider) {
      dispatch({ type: 'SET_ACTIVE_PROVIDER', provider: null });
    }
  }, [state.activeProvider]);

  const testConnection = useCallback(async (provider: AIProvider) => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      return await APIKeyManager.testConnection(provider);
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, []);

  const getEstimatedCost = useCallback((provider: AIProvider) => {
    return APIKeyManager.getEstimatedCost(provider);
  }, []);

  // -----------------------------------------------------------------------
  // レッスンアクション
  // -----------------------------------------------------------------------

  const startLesson = useCallback(async (sceneId: string): Promise<ConversationTurn> => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const adapter = await getOrCreateAdapter();
      const engine = new ConversationEngine(adapter);
      conversationEngineRef.current = engine;

      // EvaluationEngineも同じアダプターで初期化
      evaluationEngineRef.current = new EvaluationEngine(adapter);

      const firstTurn = await engine.startLesson(sceneId, state.settings.difficultyLevel);

      dispatch({ type: 'SET_CURRENT_SCENE', sceneId });
      dispatch({ type: 'SET_LESSON_PHASE', phase: 'conversation' });
      dispatch({ type: 'SET_CONVERSATION_HISTORY', history: engine.getHistory() });
      dispatch({ type: 'SET_LESSON_START_TIME', time: Date.now() });

      // シーンを進行中にマーク
      LessonManager.markSceneInProgress(sceneId);

      return firstTurn;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'レッスンの開始に失敗しました。';
      dispatch({ type: 'SET_ERROR', error: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, [getOrCreateAdapter, state.settings.difficultyLevel]);

  const sendMessage = useCallback(async (userText: string): Promise<ConversationTurn> => {
    const engine = conversationEngineRef.current;
    if (!engine) {
      throw new Error('レッスンが開始されていません。');
    }

    dispatch({ type: 'SET_LOADING', isLoading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const turn = await engine.sendMessage(userText);
      dispatch({ type: 'SET_CONVERSATION_HISTORY', history: engine.getHistory() });
      return turn;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'メッセージの送信に失敗しました。';
      dispatch({ type: 'SET_ERROR', error: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, []);

  const getHint = useCallback(async (): Promise<HintData> => {
    const engine = conversationEngineRef.current;
    if (!engine) {
      throw new Error('レッスンが開始されていません。');
    }
    return engine.getHint();
  }, []);

  const isLessonComplete = useCallback((): boolean => {
    const engine = conversationEngineRef.current;
    if (!engine) return false;
    return engine.isLessonComplete();
  }, []);

  const evaluateLesson = useCallback(async (): Promise<EvaluationResult> => {
    const engine = evaluationEngineRef.current;
    if (!engine) {
      throw new Error('評価エンジンが初期化されていません。');
    }

    dispatch({ type: 'SET_LOADING', isLoading: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const history = conversationEngineRef.current?.getHistory() ?? [];
      const sceneId = state.currentSceneId ?? '';
      const result = await engine.evaluate(history, sceneId);

      dispatch({ type: 'SET_EVALUATION_RESULT', result });
      dispatch({ type: 'SET_LESSON_PHASE', phase: 'evaluation' });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '評価に失敗しました。';
      dispatch({ type: 'SET_ERROR', error: message });
      throw err;
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, [state.currentSceneId]);

  const saveLessonResult = useCallback((result: LessonResult) => {
    ProgressTracker.saveResult(result);

    // シーンを完了にマーク
    if (state.currentSceneId) {
      LessonManager.markSceneCompleted(state.currentSceneId);
    }

    // 月間利用回数をインクリメント
    APIKeyManager.incrementMonthlyUsage();

    dispatch({ type: 'SET_LESSON_PHASE', phase: 'completed' });
  }, [state.currentSceneId]);

  // -----------------------------------------------------------------------
  // シーン・カリキュラム（LessonManagerへの委譲）
  // -----------------------------------------------------------------------

  const getScenes = useCallback(() => LessonManager.getScenes(), []);
  const getSceneStatus = useCallback((sceneId: string) => LessonManager.getSceneStatus(sceneId), []);
  const getTodayRecommendation = useCallback(() => LessonManager.getTodayRecommendation(), []);
  const getCurriculumProgress = useCallback(() => LessonManager.getCurriculumProgress(), []);
  const generateListeningQuiz = useCallback(
    (turnText: string) => LessonManager.generateListeningQuiz(turnText),
    [],
  );

  // -----------------------------------------------------------------------
  // 進捗（ProgressTrackerへの委譲）
  // -----------------------------------------------------------------------

  const getHistory = useCallback((limit?: number) => ProgressTracker.getHistory(limit), []);
  const getStreak = useCallback(() => ProgressTracker.getStreak(), []);
  const getSceneScores = useCallback(() => ProgressTracker.getSceneScores(), []);
  const getWeakAreas = useCallback(() => ProgressTracker.getWeakAreas(), []);
  const getCompletionRate = useCallback(() => ProgressTracker.getCompletionRate(), []);
  const getTodaySummary = useCallback(() => ProgressTracker.getTodaySummary(), []);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,

      // 認証
      register,
      login: loginAction,
      loginAsGuest,
      logout: logoutAction,

      // APIキー管理
      saveApiKey,
      deleteApiKey,
      testConnection,
      getEstimatedCost,

      // レッスン
      startLesson,
      sendMessage,
      getHint,
      isLessonComplete,
      evaluateLesson,
      saveLessonResult,

      // シーン・カリキュラム
      getScenes,
      getSceneStatus,
      getTodayRecommendation,
      getCurriculumProgress,
      generateListeningQuiz,

      // 進捗
      getHistory,
      getStreak,
      getSceneScores,
      getWeakAreas,
      getCompletionRate,
      getTodaySummary,
    }),
    [
      state,
      register,
      loginAction,
      loginAsGuest,
      logoutAction,
      saveApiKey,
      deleteApiKey,
      testConnection,
      getEstimatedCost,
      startLesson,
      sendMessage,
      getHint,
      isLessonComplete,
      evaluateLesson,
      saveLessonResult,
      getScenes,
      getSceneStatus,
      getTodayRecommendation,
      getCurriculumProgress,
      generateListeningQuiz,
      getHistory,
      getStreak,
      getSceneScores,
      getWeakAreas,
      getCompletionRate,
      getTodaySummary,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * AppContextの値を取得するカスタムフック。
 * AppContextProvider内でのみ使用可能。
 */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppContextProvider');
  }
  return context;
}
