import type { CreateCalendarOptions } from './createCalendar';

export default function createCalendar(options?: CreateCalendarOptions) {
  return import('./createCalendar').then(({ default: createCalendar }) => createCalendar(options));
}
