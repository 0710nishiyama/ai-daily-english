/**
 * カリキュラムデータ定義
 * 週ごとのテーマと30日間のカリキュラム構造を定義
 *
 * Requirements: 5.4, 10.3
 */

/**
 * 週ごとのテーマ定義
 */
export interface WeeklyTheme {
  week: number;
  theme: string;
  themeEn: string;
  description: string;
  descriptionEn: string;
}

/**
 * カリキュラム日ごとの定義
 */
export interface CurriculumDay {
  day: number;
  week: number;
  sceneId: string;
  focus: string;
  focusEn: string;
}

/**
 * 週ごとのテーマ
 */
export const WEEKLY_THEMES: readonly WeeklyTheme[] = [
  {
    week: 1,
    theme: '基本の挨拶と注文',
    themeEn: 'Basic Greetings & Ordering',
    description: '日常で最もよく使う挨拶と、カフェやレストランでの注文を練習します',
    descriptionEn: 'Practice the most common daily greetings and ordering at cafes and restaurants',
  },
  {
    week: 2,
    theme: '移動と宿泊',
    themeEn: 'Getting Around & Accommodation',
    description: '電車・タクシー・バスの利用やホテルでのやり取りを練習します',
    descriptionEn: 'Practice using trains, taxis, buses, and communicating at hotels',
  },
  {
    week: 3,
    theme: '買い物と日常会話',
    themeEn: 'Shopping & Daily Conversations',
    description: '買い物や友達との会話など、日常的なコミュニケーションを練習します',
    descriptionEn: 'Practice shopping and everyday communication with friends',
  },
  {
    week: 4,
    theme: 'スラングと自然な表現',
    themeEn: 'Slang & Natural Expressions',
    description: 'ネイティブが日常的に使うカジュアルな表現やスラングを練習します',
    descriptionEn: 'Practice casual expressions and slang commonly used by native speakers',
  },
];

/**
 * 30日間のカリキュラム構造
 */
export const CURRICULUM_DAYS: readonly CurriculumDay[] = [
  // Week 1: 基本の挨拶と注文
  { day: 1, week: 1, sceneId: 'cafe-order', focus: 'カフェでの注文', focusEn: 'Ordering at a cafe' },
  { day: 2, week: 1, sceneId: 'greeting-introduction', focus: '挨拶と自己紹介', focusEn: 'Greetings and self-introduction' },
  { day: 3, week: 1, sceneId: 'restaurant-order', focus: 'レストランでの注文', focusEn: 'Ordering at a restaurant' },
  { day: 4, week: 1, sceneId: 'fast-food-order', focus: 'ファストフードの注文', focusEn: 'Ordering fast food' },
  { day: 5, week: 1, sceneId: 'convenience-store', focus: 'コンビニでの買い物', focusEn: 'Shopping at a convenience store' },
  { day: 6, week: 1, sceneId: 'small-talk-weather', focus: '天気の雑談', focusEn: 'Small talk about weather' },
  { day: 7, week: 1, sceneId: 'thanking-someone', focus: 'お礼を言う', focusEn: 'Expressing gratitude' },

  // Week 2: 移動と宿泊
  { day: 8, week: 2, sceneId: 'asking-directions', focus: '道を尋ねる', focusEn: 'Asking for directions' },
  { day: 9, week: 2, sceneId: 'train-station', focus: '駅での会話', focusEn: 'At the train station' },
  { day: 10, week: 2, sceneId: 'taxi-ride', focus: 'タクシーの利用', focusEn: 'Taking a taxi' },
  { day: 11, week: 2, sceneId: 'hotel-checkin', focus: 'ホテルチェックイン', focusEn: 'Hotel check-in' },
  { day: 12, week: 2, sceneId: 'hotel-request', focus: 'ホテルでのリクエスト', focusEn: 'Hotel room requests' },
  { day: 13, week: 2, sceneId: 'bus-ride', focus: 'バスの利用', focusEn: 'Taking a bus' },
  { day: 14, week: 2, sceneId: 'giving-directions', focus: '道を教える', focusEn: 'Giving directions' },

  // Week 3: 買い物と日常会話
  { day: 15, week: 3, sceneId: 'clothing-shopping', focus: '洋服の買い物', focusEn: 'Shopping for clothes' },
  { day: 16, week: 3, sceneId: 'grocery-shopping', focus: 'スーパーでの買い物', focusEn: 'Grocery shopping' },
  { day: 17, week: 3, sceneId: 'souvenir-shopping', focus: 'お土産の購入', focusEn: 'Buying souvenirs' },
  { day: 18, week: 3, sceneId: 'making-plans', focus: '予定を立てる', focusEn: 'Making plans with friends' },
  { day: 19, week: 3, sceneId: 'phone-call', focus: '電話をかける', focusEn: 'Making a phone call' },
  { day: 20, week: 3, sceneId: 'returning-item', focus: '商品の返品', focusEn: 'Returning an item' },
  { day: 21, week: 3, sceneId: 'asking-opinions', focus: '意見を聞く', focusEn: 'Asking for opinions' },

  // Week 4: スラングと自然な表現
  { day: 22, week: 4, sceneId: 'casual-greetings', focus: 'カジュアルな挨拶', focusEn: 'Casual greetings & slang' },
  { day: 23, week: 4, sceneId: 'expressing-feelings', focus: '気持ちの表現', focusEn: 'Expressing feelings naturally' },
  { day: 24, week: 4, sceneId: 'agreeing-disagreeing', focus: '賛成・反対', focusEn: 'Agreeing & disagreeing casually' },
  { day: 25, week: 4, sceneId: 'telling-stories', focus: 'エピソードを話す', focusEn: 'Telling stories & anecdotes' },
  { day: 26, week: 4, sceneId: 'making-suggestions', focus: '提案する', focusEn: 'Making casual suggestions' },
  { day: 27, week: 4, sceneId: 'complimenting', focus: '褒める', focusEn: 'Giving & receiving compliments' },
  { day: 28, week: 4, sceneId: 'saying-goodbye', focus: '別れの挨拶', focusEn: 'Casual goodbyes' },
  { day: 29, week: 4, sceneId: 'handling-misunderstanding', focus: '誤解を解く', focusEn: 'Handling misunderstandings' },
  { day: 30, week: 4, sceneId: 'review-freestyle', focus: '自由会話レビュー', focusEn: 'Free conversation review' },
];

/**
 * 週番号からテーマを取得するためのマップ
 */
export const WEEK_THEME_MAP: ReadonlyMap<number, WeeklyTheme> = new Map(
  WEEKLY_THEMES.map((theme) => [theme.week, theme])
);

/**
 * カリキュラム日からカリキュラム情報を取得するためのマップ
 */
export const DAY_MAP: ReadonlyMap<number, CurriculumDay> = new Map(
  CURRICULUM_DAYS.map((day) => [day.day, day])
);

/**
 * カリキュラムの総日数
 */
export const TOTAL_CURRICULUM_DAYS = 30 as const;
