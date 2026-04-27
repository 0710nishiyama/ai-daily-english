/**
 * Speech recognition and synthesis related types
 * 音声認識・音声合成関連の型定義
 */

export type RecognitionState = 'idle' | 'listening' | 'processing';

export interface SpeechRecognitionError {
  type: 'no-speech' | 'audio-capture' | 'not-allowed' | 'network' | 'unknown';
  message: string;
}
