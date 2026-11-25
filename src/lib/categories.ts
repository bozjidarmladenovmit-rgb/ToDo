import type { CategoryId } from './types';

export interface CategoryInfo {
  id: CategoryId;
  emoji: string;
  color: string;
  /** Whether the location / travel-time fields make sense for this section. */
  usesLocation: boolean;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'medication', emoji: '💊', color: '#E11D48', usesLocation: false },
  { id: 'doctor', emoji: '🩺', color: '#0EA5E9', usesLocation: true },
  { id: 'sport', emoji: '🏋️', color: '#16A34A', usesLocation: true },
  { id: 'hobby', emoji: '🎨', color: '#A855F7', usesLocation: true },
  { id: 'kids', emoji: '👨‍👩‍👧', color: '#F59E0B', usesLocation: true },
  { id: 'work', emoji: '💼', color: '#475569', usesLocation: true },
  { id: 'shopping', emoji: '🛒', color: '#EA580C', usesLocation: false },
  { id: 'general', emoji: '📌', color: '#4F46E5', usesLocation: true },
];

export function getCategory(id: string): CategoryInfo {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
