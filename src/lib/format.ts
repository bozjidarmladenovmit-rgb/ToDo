import type { TFunction } from '../i18n';
import type { TranslationKey } from '../i18n/translations';

const pad = (n: number) => String(n).padStart(2, '0');

/** 24-hour clock, e.g. "09:35". Done by hand so it works the same on every phone. */
export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** e.g. "Thu 27.11." */
export function formatDate(d: Date, t: TFunction): string {
  return `${t(`wd${d.getDay()}` as TranslationKey)} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

export function formatDateTime(d: Date, t: TFunction): string {
  return `${formatDate(d, t)} ${formatTime(d)}`;
}
