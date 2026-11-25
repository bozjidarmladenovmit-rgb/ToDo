export type CategoryId =
  | 'medication'
  | 'doctor'
  | 'sport'
  | 'hobby'
  | 'kids'
  | 'work'
  | 'shopping'
  | 'general';

/** How a reminder repeats. Weekdays use JS numbering: 0 = Sunday … 6 = Saturday. */
export type Repeat =
  | { kind: 'none' }
  | { kind: 'daily' }
  | { kind: 'weekly'; weekdays: number[] }
  | { kind: 'interval'; hours: number }
  | { kind: 'monthly' };

export interface Reminder {
  id: string;
  title: string;
  category: CategoryId;
  notes?: string;
  /** First occurrence, ISO string. */
  startAt: string;
  repeat: Repeat;
  /** Last day on which the reminder may occur (ISO), optional. */
  endAt?: string;
  /** Minutes needed to get ready before leaving. */
  prepMinutes?: number;
  /** Minutes needed to travel to the location (Phase 2 will calculate it automatically). */
  travelMinutes?: number;
  /** Where the activity happens (free text for now). */
  location?: string;
  /** Family member the reminder is for, e.g. a child's name. */
  person?: string;
  enabled: boolean;
  createdAt: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  bought: boolean;
  createdAt: string;
}

export type LanguageCode = 'mk' | 'en' | 'fr' | 'es' | 'de' | 'el' | 'it';
