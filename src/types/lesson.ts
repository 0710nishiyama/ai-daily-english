/**
 * Lesson and curriculum related types
 * レッスン・カリキュラム関連の型定義
 */

import type { ConversationTurn } from './common';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Scene {
  id: string;
  name: string;
  nameJa: string;
  description: string;
  descriptionJa: string;
  keyPhrases: string[];
  week: number;
  day: number;
}

export interface SceneDetail extends Scene {
  conversationGoal: string;
  conversationGoalJa: string;
  exampleDialogue: ConversationTurn[];
}

export type SceneStatus = 'not_started' | 'in_progress' | 'completed';

export interface CurriculumProgress {
  currentDay: number;
  completedDays: number;
  totalDays: 30;
  completionRate: number;
  weeklyTheme: string;
}

export interface ListeningQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
