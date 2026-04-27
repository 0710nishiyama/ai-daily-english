/**
 * SettingsPage - 設定画面（APIキー管理）
 *
 * AIプロバイダー選択、APIキー入力・接続テスト・削除、
 * 推定コスト表示、再生速度・ヒント表示・日本語表示の設定UIを提供する。
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 12.1, 12.2
 */

import { useState, useCallback, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { SpeechSynthesizer } from '../infra/SpeechSynthesizer';
import type { AIProvider, ConnectionTestResult, CostEstimate } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 利用可能なAIプロバイダー一覧 */
const PROVIDERS: { id: AIProvider; label: string; description: string }[] = [
  { id: 'openai', label: 'OpenAI', description: 'GPT-4o-mini' },
  { id: 'gemini', label: 'Gemini', description: 'Gemini Flash' },
  { id: 'claude', label: 'Claude', description: 'Claude Haiku' },
];

/** 再生速度の選択肢 */
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** プロバイダー選択タブ */
function ProviderTabs({
  selected,
  onSelect,
}: {
  selected: AIProvider;
  onSelect: (provider: AIProvider) => void;
}) {
  return (
    <div className="flex gap-2" role="tablist" aria-label="AIプロバイダー選択">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={selected === p.id}
          onClick={() => onSelect(p.id)}
          className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
            selected === p.id
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span className="block font-semibold">{p.label}</span>
          <span className="block text-xs opacity-80">{p.description}</span>
        </button>
      ))}
    </div>
  );
}

/** 接続テスト結果の表示 */
function ConnectionResult({ result }: { result: ConnectionTestResult }) {
  if (result.success) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>接続成功（{result.latencyMs}ms）</span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span>{result.errorMessage ?? '接続に失敗しました'}</span>
    </div>
  );
}

/** コスト推定表示 */
function CostDisplay({ cost }: { cost: CostEstimate }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <h4 className="mb-2 text-sm font-medium text-gray-700">推定API利用コスト</h4>
      <div className="flex gap-6">
        <div>
          <p className="text-xs text-gray-500">1レッスンあたり</p>
          <p className="text-lg font-semibold text-gray-900">
            ${cost.perLesson.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">月間（1日1レッスン）</p>
          <p className="text-lg font-semibold text-gray-900">
            ${cost.perMonth.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SettingsPage() {
  const {
    state,
    dispatch,
    saveApiKey,
    deleteApiKey,
    testConnection,
    getEstimatedCost,
  } = useApp();

  // ローカルUI状態
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(
    state.activeProvider ?? 'openai',
  );
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // 設定値
  const { speechRate, showHints, showJapanese, selectedVoiceName } = state.settings;

  // コスト推定
  const cost = getEstimatedCost(selectedProvider);

  // 音声一覧の取得（ブラウザの音声読み込みは非同期のため、stateで管理）
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewSynthesizer] = useState(() => new SpeechSynthesizer());

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis
        .getVoices()
        .filter((v) => v.lang.startsWith('en-US') || v.lang.startsWith('en-'));
      setAvailableVoices(voices);
    };

    // 一部ブラウザでは voiceschanged イベントで音声が読み込まれる
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      previewSynthesizer.dispose();
    };
  }, [previewSynthesizer]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  /** APIキーの保存 */
  const handleSaveApiKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setTestResult(null);

    try {
      await saveApiKey(selectedProvider, apiKeyInput.trim());
      setApiKeyInput('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // エラーはAppContextのstateに反映される
    } finally {
      setIsSaving(false);
    }
  }, [apiKeyInput, selectedProvider, saveApiKey]);

  /** 接続テスト */
  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(selectedProvider);
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        latencyMs: 0,
        errorMessage: '接続テストに失敗しました。',
      });
    } finally {
      setIsTesting(false);
    }
  }, [selectedProvider, testConnection]);

  /** APIキーの削除 */
  const handleDeleteApiKey = useCallback(async () => {
    await deleteApiKey(selectedProvider);
    setDeleteConfirm(false);
    setTestResult(null);
    setApiKeyInput('');
  }, [selectedProvider, deleteApiKey]);

  /** プロバイダー切り替え */
  const handleProviderChange = useCallback((provider: AIProvider) => {
    setSelectedProvider(provider);
    setApiKeyInput('');
    setTestResult(null);
    setSaveSuccess(false);
    setDeleteConfirm(false);
  }, []);

  /** 再生速度変更 */
  const handleSpeechRateChange = useCallback(
    (rate: number) => {
      dispatch({ type: 'UPDATE_SETTINGS', settings: { speechRate: rate } });
    },
    [dispatch],
  );

  /** ヒント表示切り替え */
  const handleShowHintsChange = useCallback(
    (show: boolean) => {
      dispatch({ type: 'UPDATE_SETTINGS', settings: { showHints: show } });
    },
    [dispatch],
  );

  /** 日本語表示切り替え */
  const handleShowJapaneseChange = useCallback(
    (show: boolean) => {
      dispatch({ type: 'UPDATE_SETTINGS', settings: { showJapanese: show } });
    },
    [dispatch],
  );

  /** 音声変更 */
  const handleVoiceChange = useCallback(
    (voiceName: string) => {
      const value = voiceName === '' ? null : voiceName;
      dispatch({ type: 'UPDATE_SETTINGS', settings: { selectedVoiceName: value } });
    },
    [dispatch],
  );

  /** 音声プレビュー */
  const handleVoicePreview = useCallback(
    (voiceName: string | null) => {
      previewSynthesizer.setVoice(voiceName);
      previewSynthesizer.setRate(speechRate);
      previewSynthesizer.speak('Hello! How are you doing today? Welcome to AI Daily English.');
    },
    [previewSynthesizer, speechRate],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const isActiveProvider = state.activeProvider === selectedProvider;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4 sm:p-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          AIプロバイダーの設定と学習オプションを管理します
        </p>
      </div>

      {/* ===== APIキー設定セクション ===== */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          AIプロバイダー設定
        </h2>

        {/* プロバイダー選択 */}
        <ProviderTabs selected={selectedProvider} onSelect={handleProviderChange} />

        {/* アクティブプロバイダー表示 */}
        {isActiveProvider && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            現在のアクティブプロバイダー
          </div>
        )}

        {/* APIキー入力 */}
        <div className="mt-5">
          <label
            htmlFor="api-key-input"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            APIキー
          </label>
          <div className="flex gap-2">
            <input
              id="api-key-input"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={`${PROVIDERS.find((p) => p.id === selectedProvider)?.label} APIキーを入力`}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoComplete="off"
            />
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim() || isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>

          {/* 保存成功メッセージ */}
          {saveSuccess && (
            <p className="mt-2 text-sm text-green-600">
              APIキーを保存しました
            </p>
          )}

          {/* エラーメッセージ */}
          {state.error && (
            <p className="mt-2 text-sm text-red-600">{state.error}</p>
          )}
        </div>

        {/* 接続テスト・削除ボタン */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTesting ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                テスト中...
              </span>
            ) : (
              '接続テスト'
            )}
          </button>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
            >
              APIキーを削除
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">本当に削除しますか？</span>
              <button
                onClick={handleDeleteApiKey}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
              >
                削除する
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>

        {/* 接続テスト結果 */}
        {testResult && <ConnectionResult result={testResult} />}

        {/* コスト推定 */}
        <div className="mt-5">
          <CostDisplay cost={cost} />
        </div>
      </section>

      {/* ===== 学習設定セクション ===== */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          学習設定
        </h2>

        {/* 再生速度 */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            再生速度
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label="再生速度">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                role="radio"
                aria-checked={speechRate === speed}
                onClick={() => handleSpeechRateChange(speed)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  speechRate === speed
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            AI音声の再生速度を調整します（0.5x〜1.5x）
          </p>
        </div>

        {/* 音声選択 */}
        <div className="mb-6">
          <label
            htmlFor="voice-select"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            音声
          </label>
          {availableVoices.length > 0 ? (
            <div className="flex gap-2">
              <select
                id="voice-select"
                value={selectedVoiceName ?? ''}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">自動選択（おすすめ）</option>
                {availableVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleVoicePreview(selectedVoiceName)}
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                aria-label="音声をプレビュー"
              >
                ▶ 試聴
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              利用可能な英語音声がありません
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            AIの返答を読み上げる音声を選択します
          </p>
        </div>

        {/* ヒント表示 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">ヒント表示</p>
            <p className="text-xs text-gray-500">
              会話中に日本語ヒントと例文を表示します
            </p>
          </div>
          <button
            role="switch"
            aria-checked={showHints}
            onClick={() => handleShowHintsChange(!showHints)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              showHints ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span className="sr-only">ヒント表示を切り替え</span>
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                showHints ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 日本語表示 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">日本語表示</p>
            <p className="text-xs text-gray-500">
              AIの返答に日本語訳を表示します
            </p>
          </div>
          <button
            role="switch"
            aria-checked={showJapanese}
            onClick={() => handleShowJapaneseChange(!showJapanese)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              showJapanese ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span className="sr-only">日本語表示を切り替え</span>
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                showJapanese ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
