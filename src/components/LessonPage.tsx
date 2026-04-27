/**
 * LessonPage - レッスン画面
 *
 * シーン選択、会話、聞き取りクイズ、評価トリガーの各フェーズを管理する。
 * SpeechRecognizer / SpeechSynthesizer を直接インスタンス化し、
 * useEffect で dispose する。
 *
 * Requirements: 2.1, 2.2, 2.3, 3.1, 3.4, 3.5, 4.1, 4.8, 5.1, 5.2, 5.3,
 *               9.1, 9.2, 9.3, 10.1, 10.2
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { SpeechRecognizer } from '../infra/SpeechRecognizer';
import { SpeechSynthesizer } from '../infra/SpeechSynthesizer';
import type {
  Scene,
  SceneStatus,
  ConversationTurn,
  NaturalExpression,
  HintData,
  ListeningQuiz,
  RecognitionState,
} from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 再生速度の選択肢 */
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5];

/** 週ごとのテーマ（日本語） */
const WEEKLY_THEMES: Record<number, string> = {
  1: '基本の挨拶と注文',
  2: '移動と宿泊',
  3: '買い物と日常会話',
  4: 'スラングと自然な表現',
};

// ---------------------------------------------------------------------------
// Internal phase type
// ---------------------------------------------------------------------------

type InternalPhase =
  | 'scene_select'
  | 'conversation'
  | 'listening_quiz'
  | 'evaluation_trigger';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** シーンカード */
function SceneCard({
  scene,
  status,
  onSelect,
}: {
  scene: Scene;
  status: SceneStatus;
  onSelect: (id: string) => void;
}) {
  const statusBadge = {
    not_started: { label: '未着手', color: 'bg-gray-100 text-gray-600' },
    in_progress: { label: '進行中', color: 'bg-yellow-100 text-yellow-700' },
    completed: { label: '完了', color: 'bg-green-100 text-green-700' },
  }[status];

  return (
    <button
      onClick={() => onSelect(scene.id)}
      className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
      aria-label={`${scene.nameJa} - ${scene.name}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.color}`}
        >
          {statusBadge.label}
        </span>
        <span className="text-xs text-gray-400">
          Day {scene.day}
        </span>
      </div>
      <p className="font-semibold text-gray-900">{scene.nameJa}</p>
      <p className="text-sm text-gray-500">{scene.name}</p>
      <p className="mt-1 text-xs text-gray-500">{scene.descriptionJa}</p>
      {scene.keyPhrases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {scene.keyPhrases.slice(0, 3).map((phrase) => (
            <span
              key={phrase}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
            >
              {phrase}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/** シーン選択フェーズ */
function SceneSelectPhase({
  scenes,
  getSceneStatus,
  onSelectScene,
}: {
  scenes: Scene[];
  getSceneStatus: (id: string) => SceneStatus;
  onSelectScene: (id: string) => void;
}) {
  // 週ごとにグループ化
  const grouped = useMemo(() => {
    const map = new Map<number, Scene[]>();
    for (const s of scenes) {
      const list = map.get(s.week) ?? [];
      list.push(s);
      map.set(s.week, list);
    }
    return map;
  }, [scenes]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">シーン選択</h1>
        <p className="mt-1 text-sm text-gray-500">
          練習したいシーンを選んでください
        </p>
      </div>

      {Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([week, weekScenes]) => (
          <section key={week}>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Week {week}: {WEEKLY_THEMES[week] ?? ''}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {weekScenes
                .sort((a, b) => a.day - b.day)
                .map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    status={getSceneStatus(scene.id)}
                    onSelect={onSelectScene}
                  />
                ))}
            </div>
          </section>
        ))}
    </div>
  );
}

/** 音声認識インジケーター */
function RecognitionIndicator({ state }: { state: RecognitionState }) {
  if (state === 'idle') return null;

  const label = state === 'listening' ? '聞き取り中...' : '処理中...';
  return (
    <div
      className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      </span>
      {label}
    </div>
  );
}

/** 会話バブル */
function ConversationBubble({
  turn,
  showJapanese,
  onShowExpressions,
}: {
  turn: ConversationTurn;
  showJapanese: boolean;
  onShowExpressions?: (expressions: NaturalExpression[]) => void;
}) {
  const isUser = turn.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <p className="text-sm leading-relaxed">{turn.text}</p>
        {!isUser &&
          turn.naturalExpressions &&
          turn.naturalExpressions.length > 0 &&
          showJapanese && (
            <button
              onClick={() => onShowExpressions?.(turn.naturalExpressions!)}
              className="mt-2 text-xs text-blue-600 underline hover:text-blue-800"
              aria-label="自然表現の解説を表示"
            >
              💡 自然表現の解説を見る
            </button>
          )}
      </div>
    </div>
  );
}

/** 自然表現の解説モーダル */
function NaturalExpressionsPanel({
  expressions,
  onClose,
}: {
  expressions: NaturalExpression[];
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-900">
          💡 自然表現・スラング解説
        </h3>
        <button
          onClick={onClose}
          className="text-sm text-blue-600 hover:text-blue-800"
          aria-label="解説を閉じる"
        >
          ✕
        </button>
      </div>
      <div className="space-y-3">
        {expressions.map((expr, i) => (
          <div key={i} className="rounded-lg bg-white p-3">
            <p className="font-medium text-gray-900">
              &ldquo;{expr.expression}&rdquo;
            </p>
            <p className="mt-1 text-sm text-gray-600">
              意味: {expr.meaning}
            </p>
            <p className="text-xs text-gray-500">
              使用場面: {expr.usageContext}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** ヒント表示パネル */
function HintPanel({ hint }: { hint: HintData }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-amber-900">
        🇯🇵 日本語ヒント
      </h3>
      <p className="text-sm text-amber-800">{hint.japaneseHint}</p>
      {hint.examplePhrases.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-amber-700">例文:</p>
          <ul className="space-y-1">
            {hint.examplePhrases.map((phrase, i) => (
              <li
                key={i}
                className="rounded bg-white px-3 py-1.5 text-sm text-gray-800"
              >
                {phrase}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 音声コントロールバー */
function VoiceControlBar({
  isSpeaking,
  currentRate,
  onStop,
  onReplay,
  onRateChange,
}: {
  isSpeaking: boolean;
  currentRate: number;
  onStop: () => void;
  onReplay: () => void;
  onRateChange: (rate: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <button
        onClick={onStop}
        disabled={!isSpeaking}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="音声停止"
      >
        ⏹ 停止
      </button>
      <button
        onClick={onReplay}
        disabled={isSpeaking}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="リプレイ"
      >
        🔁 リプレイ
      </button>
      <div className="ml-auto flex items-center gap-1">
        <span className="text-xs text-gray-500">速度:</span>
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => onRateChange(speed)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              currentRate === speed
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-200'
            }`}
            aria-label={`再生速度 ${speed}倍`}
            aria-pressed={currentRate === speed}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}


/** 聞き取りクイズ */
function ListeningQuizPanel({
  quiz,
  onAnswer,
  selectedIndex,
  answered,
}: {
  quiz: ListeningQuiz;
  onAnswer: (index: number) => void;
  selectedIndex: number | null;
  answered: boolean;
}) {
  const isCorrect = selectedIndex === quiz.correctIndex;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-indigo-900">
        🎧 聞き取りクイズ
      </h3>
      <p className="mb-3 text-sm text-indigo-800">{quiz.question}</p>
      <div className="space-y-2">
        {quiz.options.map((option, i) => {
          let optionStyle = 'border-gray-200 bg-white text-gray-800 hover:border-indigo-300';
          if (answered) {
            if (i === quiz.correctIndex) {
              optionStyle = 'border-green-400 bg-green-50 text-green-800';
            } else if (i === selectedIndex && !isCorrect) {
              optionStyle = 'border-red-400 bg-red-50 text-red-800';
            } else {
              optionStyle = 'border-gray-200 bg-gray-50 text-gray-500';
            }
          } else if (i === selectedIndex) {
            optionStyle = 'border-indigo-400 bg-indigo-100 text-indigo-800';
          }

          return (
            <button
              key={i}
              onClick={() => !answered && onAnswer(i)}
              disabled={answered}
              className={`w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${optionStyle} disabled:cursor-default`}
              aria-label={`選択肢 ${i + 1}: ${option}`}
            >
              <span className="mr-2 font-medium">
                {String.fromCharCode(65 + i)}.
              </span>
              {option}
              {answered && i === quiz.correctIndex && (
                <span className="ml-2">✓</span>
              )}
              {answered && i === selectedIndex && !isCorrect && (
                <span className="ml-2">✗</span>
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div
          className={`mt-3 rounded-lg p-3 text-sm ${
            isCorrect
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
          role="alert"
        >
          <p className="font-medium">
            {isCorrect ? '🎉 正解！' : '❌ 不正解'}
          </p>
          <p className="mt-1">{quiz.explanation}</p>
        </div>
      )}
    </div>
  );
}

/** テキスト入力フォールバック（音声認識非対応時） */
function TextInputFallback({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="英語で入力してください..."
        disabled={disabled}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        aria-label="英語テキスト入力"
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        送信
      </button>
    </form>
  );
}

/** 会話フェーズ */
function ConversationPhase({
  conversationHistory,
  recognitionState,
  isSpeaking,
  speechRate,
  showHints,
  showJapanese,
  isLoading,
  error,
  speechRecSupported,
  hint,
  quiz,
  quizAnswered,
  quizSelectedIndex,
  lessonComplete,
  onMicToggle,
  onSendText,
  onStop,
  onReplay,
  onRateChange,
  onRequestHint,
  onQuizAnswer,
  onContinueAfterQuiz,
  onEvaluate,
  expressionsToShow,
  onShowExpressions,
  onCloseExpressions,
}: {
  conversationHistory: ConversationTurn[];
  recognitionState: RecognitionState;
  isSpeaking: boolean;
  speechRate: number;
  showHints: boolean;
  showJapanese: boolean;
  isLoading: boolean;
  error: string | null;
  speechRecSupported: boolean;
  hint: HintData | null;
  quiz: ListeningQuiz | null;
  quizAnswered: boolean;
  quizSelectedIndex: number | null;
  lessonComplete: boolean;
  onMicToggle: () => void;
  onSendText: (text: string) => void;
  onStop: () => void;
  onReplay: () => void;
  onRateChange: (rate: number) => void;
  onRequestHint: () => void;
  onQuizAnswer: (index: number) => void;
  onContinueAfterQuiz: () => void;
  onEvaluate: () => void;
  expressionsToShow: NaturalExpression[] | null;
  onShowExpressions: (expressions: NaturalExpression[]) => void;
  onCloseExpressions: () => void;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが追加されたらスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory.length]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col p-4 sm:p-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* ヘッダー */}
      <div className="mb-4">
        <h1 className="text-lg font-bold text-gray-900">会話レッスン</h1>
      </div>

      {/* 音声コントロール */}
      <VoiceControlBar
        isSpeaking={isSpeaking}
        currentRate={speechRate}
        onStop={onStop}
        onReplay={onReplay}
        onRateChange={onRateChange}
      />

      {/* 会話履歴 */}
      <div
        className="my-4 flex-1 space-y-3 overflow-y-auto"
        role="log"
        aria-label="会話履歴"
        aria-live="polite"
      >
        {conversationHistory.map((turn, i) => (
          <ConversationBubble
            key={i}
            turn={turn}
            showJapanese={showJapanese}
            onShowExpressions={onShowExpressions}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* 自然表現の解説 */}
      {expressionsToShow && (
        <div className="mb-3">
          <NaturalExpressionsPanel
            expressions={expressionsToShow}
            onClose={onCloseExpressions}
          />
        </div>
      )}

      {/* ヒント表示 */}
      {hint && showHints && (
        <div className="mb-3">
          <HintPanel hint={hint} />
        </div>
      )}

      {/* 聞き取りクイズ */}
      {quiz && (
        <div className="mb-3">
          <ListeningQuizPanel
            quiz={quiz}
            onAnswer={onQuizAnswer}
            selectedIndex={quizSelectedIndex}
            answered={quizAnswered}
          />
          {quizAnswered && (
            <button
              onClick={onContinueAfterQuiz}
              className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              次へ進む
            </button>
          )}
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div
          className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ローディング */}
      {isLoading && (
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-500" role="status">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          AIが考え中...
        </div>
      )}

      {/* レッスン完了 → 評価ボタン */}
      {lessonComplete && !quiz && (
        <div className="mb-3">
          <button
            onClick={onEvaluate}
            disabled={isLoading}
            className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 text-center font-bold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
          >
            🎯 レッスンを評価する
          </button>
        </div>
      )}

      {/* 入力エリア */}
      {!lessonComplete && !quiz && (
        <div className="space-y-2">
          {/* 認識インジケーター */}
          <RecognitionIndicator state={recognitionState} />

          <div className="flex items-center gap-2">
            {/* マイクボタン */}
            {speechRecSupported ? (
              <button
                onClick={onMicToggle}
                disabled={isLoading || isSpeaking}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl shadow-lg transition-all ${
                  recognitionState === 'listening'
                    ? 'animate-pulse bg-red-500 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                aria-label={
                  recognitionState === 'listening'
                    ? '音声認識を停止'
                    : '音声認識を開始'
                }
              >
                🎤
              </button>
            ) : null}

            {/* テキスト入力フォールバック */}
            <div className="flex-1">
              <TextInputFallback
                onSend={onSendText}
                disabled={isLoading || isSpeaking}
              />
            </div>
          </div>

          {/* ヒントボタン */}
          {showHints && !hint && (
            <button
              onClick={onRequestHint}
              disabled={isLoading}
              className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              🇯🇵 ヒントを表示
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface LessonPageProps {
  /** 評価画面への遷移コールバック */
  onNavigateEvaluation?: () => void;
  /** ホーム画面への遷移コールバック */
  onNavigateHome?: () => void;
}

export function LessonPage({
  onNavigateEvaluation,
}: LessonPageProps) {
  const {
    state,
    dispatch,
    startLesson,
    sendMessage,
    getHint,
    isLessonComplete,
    evaluateLesson,
    getScenes,
    getSceneStatus,
    generateListeningQuiz,
  } = useApp();

  // -----------------------------------------------------------------------
  // Local state
  // -----------------------------------------------------------------------

  const [internalPhase, setInternalPhase] = useState<InternalPhase>('scene_select');
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(state.settings.speechRate);
  const [hint, setHint] = useState<HintData | null>(null);
  const [quiz, setQuiz] = useState<ListeningQuiz | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizSelectedIndex, setQuizSelectedIndex] = useState<number | null>(null);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [expressionsToShow, setExpressionsToShow] = useState<NaturalExpression[] | null>(null);

  // -----------------------------------------------------------------------
  // Refs for speech instances
  // -----------------------------------------------------------------------

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const synthesizerRef = useRef<SpeechSynthesizer | null>(null);

  // -----------------------------------------------------------------------
  // Initialize / dispose speech instances
  // -----------------------------------------------------------------------

  useEffect(() => {
    const recognizer = new SpeechRecognizer();
    const synthesizer = new SpeechSynthesizer();

    recognizerRef.current = recognizer;
    synthesizerRef.current = synthesizer;

    // Set initial rate and voice from settings
    synthesizer.setRate(state.settings.speechRate);
    synthesizer.setVoice(state.settings.selectedVoiceName);

    // Register callbacks
    recognizer.onStateChange((s) => setRecognitionState(s));

    return () => {
      recognizer.dispose();
      synthesizer.dispose();
      recognizerRef.current = null;
      synthesizerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync voice and rate settings when they change
  useEffect(() => {
    if (synthesizerRef.current) {
      synthesizerRef.current.setRate(state.settings.speechRate);
      synthesizerRef.current.setVoice(state.settings.selectedVoiceName);
    }
  }, [state.settings.speechRate, state.settings.selectedVoiceName]);

  // Sync lesson phase from context
  useEffect(() => {
    if (state.lessonPhase === 'conversation' && internalPhase === 'scene_select') {
      setInternalPhase('conversation');
    }
    if (state.lessonPhase === 'evaluation') {
      onNavigateEvaluation?.();
    }
  }, [state.lessonPhase, internalPhase, onNavigateEvaluation]);

  // -----------------------------------------------------------------------
  // Scenes
  // -----------------------------------------------------------------------

  const scenes = useMemo(() => getScenes(), [getScenes]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  /** シーン選択 → レッスン開始 */
  const handleSelectScene = useCallback(
    async (sceneId: string) => {
      // ユーザーのクリック直後に音声合成をアンロック（自動再生ポリシー対策）
      synthesizerRef.current?.unlock();

      dispatch({ type: 'SET_ERROR', error: null });
      setHint(null);
      setQuiz(null);
      setQuizAnswered(false);
      setQuizSelectedIndex(null);
      setLessonComplete(false);
      setExpressionsToShow(null);

      try {
        const firstTurn = await startLesson(sceneId);
        setInternalPhase('conversation');

        // AI の最初の発話を自動再生
        const synth = synthesizerRef.current;
        if (synth?.isSupported()) {
          setIsSpeaking(true);
          try {
            await synth.speak(firstTurn.text);
          } catch {
            // 音声再生失敗は無視（テキストは表示される）
          } finally {
            setIsSpeaking(false);
          }
        }

        // 聞き取りクイズを生成
        try {
          const q = generateListeningQuiz(firstTurn.text);
          setQuiz(q);
        } catch {
          // クイズ生成失敗は無視
        }
      } catch {
        // エラーは AppContext 経由で state.error に反映される
      }
    },
    [startLesson, dispatch, generateListeningQuiz],
  );

  /** マイクトグル */
  const handleMicToggle = useCallback(() => {
    // ユーザーのクリック直後に音声合成をアンロック（自動再生ポリシー対策）
    synthesizerRef.current?.unlock();

    const rec = recognizerRef.current;
    if (!rec) return;

    if (rec.isListening()) {
      rec.stopRecognition();
    } else {
      // 結果コールバックを一度だけ登録（重複防止のため removeAllListeners → 再登録）
      rec.removeAllListeners();
      rec.onStateChange((s) => setRecognitionState(s));
      rec.onResult(async (text) => {
        // ユーザー発話を送信
        try {
          const aiTurn = await sendMessage(text);

          // AI返答を自動再生
          const synth = synthesizerRef.current;
          if (synth?.isSupported()) {
            setIsSpeaking(true);
            try {
              await synth.speak(aiTurn.text);
            } catch {
              // ignore
            } finally {
              setIsSpeaking(false);
            }
          }

          // レッスン完了チェック
          if (isLessonComplete()) {
            setLessonComplete(true);
          } else {
            // 聞き取りクイズを生成
            try {
              const q = generateListeningQuiz(aiTurn.text);
              setQuiz(q);
              setQuizAnswered(false);
              setQuizSelectedIndex(null);
            } catch {
              // ignore
            }
          }

          // ヒントをリセット
          setHint(null);
          setExpressionsToShow(null);
        } catch {
          // エラーは AppContext 経由
        }
      });
      rec.onError((err) => {
        dispatch({ type: 'SET_ERROR', error: err.message });
      });

      rec.startRecognition();
    }
  }, [sendMessage, isLessonComplete, generateListeningQuiz, dispatch]);

  /** テキスト送信 */
  const handleSendText = useCallback(
    async (text: string) => {
      // ユーザーのクリック直後に音声合成をアンロック（自動再生ポリシー対策）
      synthesizerRef.current?.unlock();

      try {
        const aiTurn = await sendMessage(text);

        // AI返答を自動再生
        const synth = synthesizerRef.current;
        if (synth?.isSupported()) {
          setIsSpeaking(true);
          try {
            await synth.speak(aiTurn.text);
          } catch {
            // ignore
          } finally {
            setIsSpeaking(false);
          }
        }

        // レッスン完了チェック
        if (isLessonComplete()) {
          setLessonComplete(true);
        } else {
          // 聞き取りクイズを生成
          try {
            const q = generateListeningQuiz(aiTurn.text);
            setQuiz(q);
            setQuizAnswered(false);
            setQuizSelectedIndex(null);
          } catch {
            // ignore
          }
        }

        setHint(null);
        setExpressionsToShow(null);
      } catch {
        // エラーは AppContext 経由
      }
    },
    [sendMessage, isLessonComplete, generateListeningQuiz],
  );

  /** 音声停止 */
  const handleStop = useCallback(() => {
    synthesizerRef.current?.stop();
    setIsSpeaking(false);
  }, []);

  /** リプレイ */
  const handleReplay = useCallback(async () => {
    const synth = synthesizerRef.current;
    if (!synth) return;
    setIsSpeaking(true);
    try {
      await synth.replay();
    } catch {
      // ignore
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  /** 再生速度変更 */
  const handleRateChange = useCallback(
    (rate: number) => {
      setSpeechRate(rate);
      synthesizerRef.current?.setRate(rate);
      dispatch({ type: 'UPDATE_SETTINGS', settings: { speechRate: rate } });
    },
    [dispatch],
  );

  /** ヒント取得 */
  const handleRequestHint = useCallback(async () => {
    try {
      const h = await getHint();
      setHint(h);
    } catch {
      dispatch({
        type: 'SET_ERROR',
        error: 'ヒントの取得に失敗しました。',
      });
    }
  }, [getHint, dispatch]);

  /** クイズ回答 */
  const handleQuizAnswer = useCallback((index: number) => {
    setQuizSelectedIndex(index);
    setQuizAnswered(true);
  }, []);

  /** クイズ後に続行 */
  const handleContinueAfterQuiz = useCallback(() => {
    setQuiz(null);
    setQuizAnswered(false);
    setQuizSelectedIndex(null);
  }, []);

  /** 評価実行 */
  const handleEvaluate = useCallback(async () => {
    try {
      await evaluateLesson();
      // evaluateLesson が state.lessonPhase を 'evaluation' に変更 → useEffect で遷移
    } catch {
      // エラーは AppContext 経由
    }
  }, [evaluateLesson]);

  /** 自然表現の表示 */
  const handleShowExpressions = useCallback(
    (expressions: NaturalExpression[]) => {
      setExpressionsToShow(expressions);
    },
    [],
  );

  /** 自然表現の非表示 */
  const handleCloseExpressions = useCallback(() => {
    setExpressionsToShow(null);
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  // シーン選択フェーズ
  if (internalPhase === 'scene_select') {
    return (
      <SceneSelectPhase
        scenes={scenes}
        getSceneStatus={getSceneStatus}
        onSelectScene={handleSelectScene}
      />
    );
  }

  // 会話フェーズ
  return (
    <ConversationPhase
      conversationHistory={state.conversationHistory}
      recognitionState={recognitionState}
      isSpeaking={isSpeaking}
      speechRate={speechRate}
      showHints={state.settings.showHints}
      showJapanese={state.settings.showJapanese}
      isLoading={state.isLoading}
      error={state.error}
      speechRecSupported={recognizerRef.current?.isSupported() ?? false}
      hint={hint}
      quiz={quiz}
      quizAnswered={quizAnswered}
      quizSelectedIndex={quizSelectedIndex}
      lessonComplete={lessonComplete}
      onMicToggle={handleMicToggle}
      onSendText={handleSendText}
      onStop={handleStop}
      onReplay={handleReplay}
      onRateChange={handleRateChange}
      onRequestHint={handleRequestHint}
      onQuizAnswer={handleQuizAnswer}
      onContinueAfterQuiz={handleContinueAfterQuiz}
      onEvaluate={handleEvaluate}
      expressionsToShow={expressionsToShow}
      onShowExpressions={handleShowExpressions}
      onCloseExpressions={handleCloseExpressions}
    />
  );
}
