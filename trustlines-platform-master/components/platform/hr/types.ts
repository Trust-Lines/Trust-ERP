// Data shapes for the HR board (Figma "HR board", node 555:34497). The board is UI only: a
// page feeds it these lists — nothing here fetches or invents data.

/** Calendar legend: Order Delivery, Reminder, Container, Birthday, Absent, Public Holiday. */
export type HrEventKind = 'delivery' | 'reminder' | 'container' | 'birthday' | 'absent' | 'holiday';

export interface HrCalendarEvent {
  id: string;
  /** Local day, YYYY-MM-DD. */
  date: string;
  kind: HrEventKind;
  label: string;
}

export interface HrAgendaItem {
  id: string;
  /** "10:30"; null = all day. */
  time: string | null;
  kind: HrEventKind;
  title: string;
  detail?: string | null;
}

export interface HrPerson {
  id: string;
  /** For the profile photo (AvatarDirectory); initials otherwise. */
  userId?: string | null;
  name: string;
  role?: string | null;
}

export interface HrBirthday extends HrPerson {
  /** Next birthday, YYYY-MM-DD. */
  date: string;
}

export interface HrOrder {
  id: string;
  name: string;
  reference?: string | null;
  /** YYYY-MM-DD. */
  dueDate: string;
}

export interface HrContainer {
  id: string;
  label: string;
  itemCount?: number | null;
  /** YYYY-MM-DD. */
  dueDate: string;
}

export type HrAbsenceReason = 'sick' | 'vacation';

export interface HrUnavailable extends HrPerson {
  reason: HrAbsenceReason;
  /** YYYY-MM-DD. */
  date: string;
}

/** A header button: a link when `href` is set, else a button calling `onClick`. Hidden when neither. */
export interface HrAction {
  href?: string;
  onClick?: () => void;
}
