/**
 * Progress tracking related types
 * 進捗管理関連の型定義
 */

export interface LessonResult {
  id: string;
  date: string;
  sceneId: string;
  sceneName: string;
  totalScore: number;
  grammarScore: number;
  naturalnessScore: number;
  responseContentScore: number;
  conversationTurns: number;
  durationMinutes: number;
}

export interface WeakArea {
  type: 'scene' | 'skill';
  name: string;
  averageScore: number;
}

export interface DaySummary {
  hasCompletedToday: boolean;
  streak: number;
  recentScore: number | null;
  recommendedScene: string;
}
