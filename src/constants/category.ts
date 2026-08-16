/**
 * The category taxonomy for the directory.
 *
 * Kept deliberately coarse. Category is the heaviest signal in the "related"
 * score (see constants/ranking.ts), so splitting hairs here — "text-generation"
 * vs "long-form-writing" — would fragment the graph and starve related lookups.
 * Finer distinctions belong in `tags`, which score lower but combine.
 */
export enum Category {
  TEXT_GENERATION = 'text-generation',
  IMAGE_GENERATION = 'image-generation',
  VIDEO_GENERATION = 'video-generation',
  AUDIO_AND_VOICE = 'audio-and-voice',
  CODE_ASSISTANT = 'code-assistant',
  CHATBOT = 'chatbot',
  PRODUCTIVITY = 'productivity',
  MARKETING = 'marketing',
  DESIGN = 'design',
  DATA_ANALYSIS = 'data-analysis',
  RESEARCH = 'research',
  AUTOMATION = 'automation',
  EDUCATION = 'education',
  CUSTOMER_SUPPORT = 'customer-support',
}

export const CATEGORIES = Object.values(Category);

export const CATEGORY_LABELS: Record<Category, string> = {
  [Category.TEXT_GENERATION]: 'Text Generation',
  [Category.IMAGE_GENERATION]: 'Image Generation',
  [Category.VIDEO_GENERATION]: 'Video Generation',
  [Category.AUDIO_AND_VOICE]: 'Audio & Voice',
  [Category.CODE_ASSISTANT]: 'Code Assistant',
  [Category.CHATBOT]: 'Chatbot',
  [Category.PRODUCTIVITY]: 'Productivity',
  [Category.MARKETING]: 'Marketing',
  [Category.DESIGN]: 'Design',
  [Category.DATA_ANALYSIS]: 'Data Analysis',
  [Category.RESEARCH]: 'Research',
  [Category.AUTOMATION]: 'Automation',
  [Category.EDUCATION]: 'Education',
  [Category.CUSTOMER_SUPPORT]: 'Customer Support',
};
