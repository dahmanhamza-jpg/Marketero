export type Platform = 'Instagram' | 'TikTok' | 'Entrambi';
export type ContentFormat = 'Reel' | 'TikTok Video' | 'Post' | 'Carousel' | 'Story';
export type ScriptStatus = 'Da scrivere' | 'In corso' | 'Pronto';
export type WorkflowStage = 'Lead' | 'Script' | 'Registrazione' | 'Montaggio' | 'Programmazione' | 'Pubblicato';
export type ClientHealth = 'Regolare' | 'Attenzione' | 'Critico';
export type EventKind = 'Lavoro' | 'Personale';

export interface BaseEntity { id: string; createdAt: string; updatedAt: string; deletedAt?: string | null; }
export interface Client extends BaseEntity {
  name: string; niche: string; description?: string; email?: string; phone?: string;
  instagram?: string; tiktok?: string; monthlyFee: number; contentTarget: number; startDate?: string;
  contractMonths?: number; metaAds: boolean; objective?: string; tone?: string; avoid?: string[];
  platforms: Platform[];
}
export interface Idea extends BaseEntity {
  clientId?: string; title: string; note?: string; platform: Platform; format: ContentFormat;
  referenceUrls: { url: string; note?: string }[]; status: 'Idea' | 'Pianificata' | 'Utilizzata';
}
export interface Script extends BaseEntity {
  clientId: string; ideaId?: string; title: string; platform: Platform; format: ContentFormat;
  status: ScriptStatus; hook?: string; body?: string; cta?: string; recordingNotes?: string;
  estimatedSeconds?: number; onCamera?: string; referenceUrls: { url: string; note?: string }[];
}
export interface Task extends BaseEntity {
  clientId?: string; title: string; dueAt?: string; durationMin: number; urgent: boolean; completed: boolean;
  stage?: WorkflowStage; notes?: string;
}
export interface CalendarEvent extends BaseEntity {
  clientId?: string; title: string; kind: EventKind; category: string; startAt: string;
  endAt?: string; allDay?: boolean; notes?: string;
}
export interface Lead extends BaseEntity {
  name: string; contact?: string; email?: string; phone?: string; monthlyValue: number;
  status: 'Da contattare' | 'Contattato' | 'Appuntamento' | 'Proposta inviata' | 'Acquisito' | 'Perso';
  lastContactAt?: string; nextFollowUpAt?: string; notes?: string;
}
export interface Payment extends BaseEntity {
  clientId: string; amount: number; dueDate: string; paidAt?: string; note?: string;
}
export interface FollowerSnapshot extends BaseEntity { clientId: string; platform: 'Instagram'|'TikTok'; date: string; count: number; }
export interface Strategy extends BaseEntity {
  clientId: string; objective: string; summary: string; target: number;
  pillars: { name: string; count: number }[];
  ideas: { title: string; pillar: string; platform: Platform; format: ContentFormat; hook: string; cta: string; funnel: 'Discovery'|'Trust'|'Action' }[];
  approved: boolean;
}
export interface Settings extends BaseEntity {
  key: 'singleton'; pinHash?: string; firstRunDone: boolean; monthlyRevenueGoal: number; clientGoal: number;
  darkMode: boolean; syncToken?: string; profileName?: string; dateFormat?: 'it-IT';
  notificationsEnabled?: boolean; clientReminders?: boolean; appointmentReminders?: boolean;
  autoLockMinutes?: number; lastSyncAt?: string;
}
