/**
 * SpeechRecognizer - Web Speech Recognition APIをラップし、音声認識機能を提供するコンポーネント
 *
 * ブラウザのWeb Speech Recognition APIを使用して英語（en-US）の音声認識を行う。
 * マイク拒否時・認識失敗時のエラーハンドリング、非対応ブラウザ向けのフォールバック検出を含む。
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import type { RecognitionState, SpeechRecognitionError } from '../types';

/** Web Speech Recognition APIのブラウザ互換型定義 */
type SpeechRecognitionConstructor = new () => SpeechRecognition;

/**
 * ブラウザがWeb Speech Recognition APIをサポートしているかを判定する。
 */
export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

/**
 * SpeechRecognition コンストラクタを取得する。
 * 標準APIとwebkitプレフィックス版の両方をチェックする。
 */
function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as Record<string, SpeechRecognitionConstructor>)
      .SpeechRecognition ??
    (window as unknown as Record<string, SpeechRecognitionConstructor>)
      .webkitSpeechRecognition ??
    null
  );
}

/** コールバック型定義 */
type ResultCallback = (text: string) => void;
type ErrorCallback = (error: SpeechRecognitionError) => void;
type StateChangeCallback = (state: RecognitionState) => void;

/**
 * SpeechRecognizer クラス
 *
 * Web Speech Recognition APIをラップし、以下の機能を提供する:
 * - 音声認識の開始・停止
 * - 認識状態の管理（idle / listening / processing）
 * - 認識結果・エラー・状態変更のコールバック
 * - 認識言語を英語（en-US）に固定
 * - マイク拒否時・認識失敗時のエラーハンドリング
 */
export class SpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private state: RecognitionState = 'idle';
  private resultCallbacks: ResultCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private stateChangeCallbacks: StateChangeCallback[] = [];
  private readonly supported: boolean;

  constructor() {
    this.supported = isSpeechRecognitionSupported();

    if (this.supported) {
      this.initRecognition();
    }
  }

  /**
   * SpeechRecognition インスタンスを初期化し、イベントハンドラを設定する。
   */
  private initRecognition(): void {
    const Constructor = getSpeechRecognitionConstructor();
    if (!Constructor) return;

    this.recognition = new Constructor();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.updateState('processing');

      const result = event.results[event.results.length - 1];
      if (result?.isFinal) {
        const transcript = result[0]?.transcript ?? '';
        if (transcript.trim()) {
          this.notifyResult(transcript.trim());
        } else {
          this.notifyError({
            type: 'no-speech',
            message: '音声を認識できませんでした。もう一度お試しください',
          });
        }
      }

      this.updateState('idle');
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const error = this.mapRecognitionError(event.error);
      this.notifyError(error);
      this.updateState('idle');
    };

    this.recognition.onstart = () => {
      this.updateState('listening');
    };

    this.recognition.onend = () => {
      // Only reset to idle if we're still in listening state
      // (processing → idle is handled in onresult)
      if (this.state === 'listening') {
        this.updateState('idle');
      }
    };
  }

  /**
   * 音声認識を開始する。
   *
   * マイクボタン押下時に呼び出される。
   * ブラウザ非対応の場合はエラーコールバックを発火する。
   * 既に認識中の場合は何もしない。
   */
  startRecognition(): void {
    if (!this.supported || !this.recognition) {
      this.notifyError({
        type: 'unknown',
        message:
          'お使いのブラウザは音声認識に対応していません。Chrome等の対応ブラウザをご利用ください',
      });
      return;
    }

    if (this.state !== 'idle') {
      return;
    }

    try {
      this.recognition.start();
    } catch {
      // Already started — ignore InvalidStateError
    }
  }

  /**
   * 音声認識を停止する。
   */
  stopRecognition(): void {
    if (!this.recognition) return;

    try {
      this.recognition.stop();
    } catch {
      // Already stopped — ignore
    }
    this.updateState('idle');
  }

  /**
   * 現在音声認識中かどうかを返す。
   */
  isListening(): boolean {
    return this.state === 'listening';
  }

  /**
   * 現在の認識状態を返す。
   */
  getState(): RecognitionState {
    return this.state;
  }

  /**
   * ブラウザが音声認識をサポートしているかを返す。
   */
  isSupported(): boolean {
    return this.supported;
  }

  /**
   * 認識結果のコールバックを登録する。
   * 認識が完了し、テキストが取得できた場合に呼び出される。
   */
  onResult(callback: ResultCallback): void {
    this.resultCallbacks.push(callback);
  }

  /**
   * エラーのコールバックを登録する。
   * マイク拒否、認識失敗、ブラウザ非対応等のエラー時に呼び出される。
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * 認識状態変更のコールバックを登録する。
   * idle / listening / processing の状態遷移時に呼び出される。
   */
  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * 全コールバックを解除する。
   * コンポーネントのアンマウント時等に呼び出す。
   */
  removeAllListeners(): void {
    this.resultCallbacks = [];
    this.errorCallbacks = [];
    this.stateChangeCallbacks = [];
  }

  /**
   * リソースを解放する。
   * 認識を停止し、全コールバックを解除する。
   */
  dispose(): void {
    this.stopRecognition();
    this.removeAllListeners();
    this.recognition = null;
  }

  // --- Private helpers ---

  private updateState(newState: RecognitionState): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const cb of this.stateChangeCallbacks) {
      cb(newState);
    }
  }

  private notifyResult(text: string): void {
    for (const cb of this.resultCallbacks) {
      cb(text);
    }
  }

  private notifyError(error: SpeechRecognitionError): void {
    for (const cb of this.errorCallbacks) {
      cb(error);
    }
  }

  /**
   * Web Speech APIのエラーコードをアプリケーション固有のエラー型にマッピングする。
   */
  private mapRecognitionError(
    errorCode: SpeechRecognitionErrorCode
  ): SpeechRecognitionError {
    switch (errorCode) {
      case 'no-speech':
        return {
          type: 'no-speech',
          message: '音声を認識できませんでした。もう一度お試しください',
        };
      case 'audio-capture':
        return {
          type: 'audio-capture',
          message:
            'マイクが検出できません。マイクが接続されているか確認してください',
        };
      case 'not-allowed':
        return {
          type: 'not-allowed',
          message: 'マイクへのアクセスを許可してください',
        };
      case 'network':
        return {
          type: 'network',
          message:
            'ネットワークエラーが発生しました。インターネット接続を確認してください',
        };
      default:
        return {
          type: 'unknown',
          message: '音声認識中にエラーが発生しました。もう一度お試しください',
        };
    }
  }
}
