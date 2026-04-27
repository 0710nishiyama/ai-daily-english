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
  private unlocked: boolean = false;
  /** ユーザーが選択した音声名（nullの場合は自動選択） */
  private selectedVoiceName: string | null = null;

  constructor() {
    this.supported = isSpeechSynthesisSupported();
  }

  /**
   * ブラウザの自動再生ポリシーを解除するためのウォームアップ呼び出し。
   * ユーザーのクリックイベントハンドラ内（async処理の前）で呼び出すこと。
   * 空の発話を即座にキャンセルすることで、以降の speak() が許可される。
   */
  unlock(): void {
    if (!this.supported || this.unlocked) return;
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    utterance.rate = 1;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.cancel();
    this.unlocked = true;
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
   * 使用する音声を名前で指定する。
   * nullを指定すると自動選択に戻る。
   *
   * @param voiceName 音声名（SpeechSynthesisVoice.name）、またはnull
   */
  setVoice(voiceName: string | null): void {
    this.selectedVoiceName = voiceName;
  }

  /**
   * 現在選択されている音声名を取得する。
   * nullの場合は自動選択。
   */
  getVoiceName(): string | null {
    return this.selectedVoiceName;
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
   *
   * 選択優先順位:
   * 1. ユーザーが明示的に選択した音声（selectedVoiceName）
   * 2. 高品質な en-US 音声（名前に "Google", "Samantha", "Daniel", "Karen", "Moira" 等を含む）
   * 3. その他の en-US 音声
   * 4. en- で始まる任意の音声
   */
  private selectEnglishVoice(): SpeechSynthesisVoice | null {
    if (!this.supported) return null;

    const voices = window.speechSynthesis.getVoices();

    // 1. ユーザーが選択した音声を優先
    if (this.selectedVoiceName) {
      const selected = voices.find((v) => v.name === this.selectedVoiceName);
      if (selected) return selected;
    }

    // 英語音声のみフィルタ
    const englishVoices = voices.filter(
      (v) => v.lang === 'en-US' || v.lang.startsWith('en-'),
    );

    if (englishVoices.length === 0) return null;

    // 2. 高品質な音声を優先（ブラウザ/OS固有の良質な音声名）
    const preferredNames = [
      'Google US English',
      'Google UK English Female',
      'Google UK English Male',
      'Samantha',       // macOS / iOS - 女性、自然な声
      'Daniel',         // macOS / iOS - 男性（英国英語）
      'Karen',          // macOS / iOS - 女性（オーストラリア英語）
      'Moira',          // macOS / iOS - 女性（アイルランド英語）
      'Alex',           // macOS - 男性
      'Tessa',          // macOS - 女性（南アフリカ英語）
      'Microsoft Zira',  // Windows - 女性
      'Microsoft David', // Windows - 男性
      'Microsoft Mark',  // Windows - 男性
    ];

    for (const name of preferredNames) {
      const voice = englishVoices.find((v) =>
        v.name.toLowerCase().includes(name.toLowerCase()),
      );
      if (voice) return voice;
    }

    // 3. en-US を優先
    const usVoice = englishVoices.find((v) => v.lang === 'en-US');
    if (usVoice) return usVoice;

    // 4. 任意の英語音声
    return englishVoices[0];
  }
}
