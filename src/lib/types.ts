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
  /** Minutes needed to travel to the location (typed in, or calculated when travelAuto is on). */
  travelMinutes?: number;
  /** Where the activity happens, as the user wrote it. */
  location?: string;
  /** Coordinates of the location, once found on the map. */
  place?: Place;
  /** How the user gets there. */
  travelMode?: TravelMode;
  /** When true, travelMinutes is calculated from the map instead of typed in. */
  travelAuto?: boolean;
  /** Where the last automatic travel time came from. */
  travelSource?: TravelSource;
  /** When the automatic travel time was last calculated (ISO). */
  travelComputedAt?: string;
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

export interface Settings {
  /** Starting point for travel times when the phone's location is not used. */
  home?: Place;
  defaultTravelMode: TravelMode;
}

export type LanguageCode = 'mk' | 'en' | 'fr' | 'es' | 'de' | 'el' | 'it';

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export type TravelMode = 'drive' | 'walk' | 'bike' | 'transit';

/** google = live route with traffic; estimate = straight-line distance, used when no maps key is set. */
export type TravelSource = 'google' | 'estimate';
