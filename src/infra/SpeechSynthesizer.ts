/**
 * SpeechSynthesizer - Web Speech Synthesis APIをラップし、英語音声合成機能を提供するコンポーネント
 *
 * ブラウザのWeb Speech Synthesis APIを使用してAIの返答テキストを英語音声で再生する。
 * 再生速度のクランプ（0.5〜1.5）、非対応ブラウザ向けのフォールバック検出を含む。
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

/** 再生速度の最小値 */
const MIN_RATE = 0.5;

/** 再生速度の最大値 */
const MAX_RATE = 1.5;

/** デフォルトの再生速度（通常速度） */
const DEFAULT_RATE = 1.0;

/**
 * ブラウザがWeb Speech Synthesis APIをサポートしているかを判定する。
 */
export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * 数値を指定範囲にクランプする。
 * 再生速度の制限に使用する。
 */
export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return DEFAULT_RATE;
  }
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

/**
 * SpeechSynthesizer クラス
 *
 * Web Speech Synthesis APIをラップし、以下の機能を提供する:
 * - テキストの英語音声再生
 * - 再生の停止
 * - 直前の発話のリプレイ
 * - 再生速度の設定・取得（0.5〜1.5にクランプ）
 * - 再生状態の取得
 * - 利用可能な英語音声の取得
 */
export class SpeechSynthesizer {
  private rate: number = DEFAULT_RATE;
  private lastText: string = '';
  private speaking: boolean = false;
  private readonly supported: boolean;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.supported = isSpeechSynthesisSupported();
  }

  /**
   * テキストを英語音声で再生する。
   *
   * AIの返答テキストを受け取り、Web Speech Synthesis APIで音声再生する。
   * 再生完了またはエラー時にPromiseが解決される。
   * 既に再生中の場合は現在の再生を停止してから新しいテキストを再生する。
   *
   * @param text 再生するテキスト
   * @throws Error ブラウザ非対応時
   */
  async speak(text: string): Promise<void> {
    if (!this.supported) {
      throw new Error(
        'お使いのブラウザは音声再生に対応していません'
      );
    }

    if (!text.trim()) {
      return;
    }

    // 既に再生中なら停止
    this.stop();

    this.lastText = text;

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = this.rate;

      // 英語音声を選択（利用可能な場合）
      const voice = this.selectEnglishVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        this.speaking = true;
      };

      utterance.onend = () => {
        this.speaking = false;
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        this.speaking = false;
        this.currentUtterance = null;

        // 'canceled' is expected when stop() is called during playback
        if (event.error === 'canceled') {
          resolve();
          return;
        }

        reject(
          new Error(`音声再生中にエラーが発生しました: ${event.error}`)
        );
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * 音声再生を即座に停止する。
   */
  stop(): void {
    if (!this.supported) return;

    window.speechSynthesis.cancel();
    this.speaking = false;
    this.currentUtterance = null;
  }

  /**
   * 直前のAI返答音声を再度再生する。
   *
   * lastTextが空の場合は何もしない。
   */
  async replay(): Promise<void> {
    if (!this.lastText) {
      return;
    }
    return this.speak(this.lastText);
  }

  /**
   * 再生速度を設定する。
   * 入力値は0.5〜1.5の範囲にクランプされる。
   * NaN/Infinityの場合はデフォルト速度（1.0）にリセットされる。
   *
   * @param rate 再生速度（0.5〜1.5）
   */
  setRate(rate: number): void {
    this.rate = clampRate(rate);
  }

  /**
   * 現在の再生速度を取得する。
   */
  getRate(): number {
    return this.rate;
  }

  /**
   * 現在音声を再生中かどうかを返す。
   */
  isSpeaking(): boolean {
    return this.speaking && this.currentUtterance !== null;
  }

  /**
   * ブラウザが音声合成をサポートしているかを返す。
   */
  isSupported(): boolean {
    return this.supported;
  }

  /**
   * 利用可能な英語音声の一覧を取得する。
   * en-US および en で始まる言語の音声をフィルタリングして返す。
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.supported) return [];

    return window.speechSynthesis
      .getVoices()
      .filter(
        (voice) =>
          voice.lang.startsWith('en-US') || voice.lang.startsWith('en-')
      );
  }

  /**
   * リソースを解放する。
   * 再生を停止し、内部状態をリセットする。
   */
  dispose(): void {
    this.stop();
    this.lastText = '';
    this.currentUtterance = null;
  }

  // --- Private helpers ---

  /**
   * 利用可能な英語音声から最適な音声を選択する。
   * en-US を優先し、見つからない場合は en- で始まる音声を返す。
   */
  private selectEnglishVoice(): SpeechSynthesisVoice | null {
    if (!this.supported) return null;

    const voices = window.speechSynthesis.getVoices();

    // en-US の音声を優先
    const usVoice = voices.find((v) => v.lang === 'en-US');
    if (usVoice) return usVoice;

    // en- で始まる音声にフォールバック
    const enVoice = voices.find((v) => v.lang.startsWith('en-'));
    if (enVoice) return enVoice;

    return null;
  }
}
