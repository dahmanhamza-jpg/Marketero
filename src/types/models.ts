export type Platform = 'Instagram' | 'TikTok' | 'Entrambi';
export type ContentFormat = 'Reel' | 'TikTok Video' | 'Post' | 'Carousel' | 'Story';
export type ScriptStatus = 'Da scrivere' | 'In corso' | 'Pronto';
export type WorkflowStage = 'Lead' | 'Script' | 'Registrazione' | 'Montaggio' | 'Programmazione' | 'Pubblicato';
export type ClientHealth = 'Regolare' | 'Attenzione' | 'Critico';
export type EventKind = 'Lavoro' | 'Personale';
export type LeadSalesStatus = 'Da valutare'|'Salvato'|'Contattato'|'Ha risposto'|'Interessato'|'Appuntamento fissato'|'Preventivo inviato'|'Da richiamare'|'Acquisito'|'Scartato';
export type LeadType = 'WEB-FIRST'|'SOCIAL-FIRST';
export type LeadBudgetBand = 'BASSA'|'MEDIA'|'ALTA'|'MOLTO ALTA';
export type LeadPriority = 'HOT'|'MEDIUM'|'LOW';

export interface BaseEntity { id: string; createdAt: string; updatedAt: string; deletedAt?: string | null; }
export interface Client extends BaseEntity {
  name: string; niche: string; description?: string; email?: string; phone?: string;
  instagram?: string; tiktok?: string; monthlyFee: number; contentTarget: number; startDate?: string;
  contractMonths?: number; metaAds: boolean; objective?: string; tone?: string; avoid?: string[];
  platforms: Platform[];
  address?: string; website?: string; facebook?: string; leadSourceId?: string; requestedService?: string;
}
export interface Idea extends BaseEntity {
  clientId?: string; title: string; note?: string; platform: Platform; format: ContentFormat;
  referenceUrls: { url: string; note?: string }[]; status: 'Idea' | 'Pianificata' | 'Utilizzata';
}
export interface Script extends BaseEntity {
  clientId: string; ideaId?: string; title: string; platform: Platform; format: ContentFormat;
  status: ScriptStatus; hook?: string; body?: string; cta?: string; recordingNotes?: string;
  estimatedSeconds?: number; onCamera?: string; referenceUrls: { url: string; note?: string }[];
  recorded?: boolean; edited?: boolean; scheduled?: boolean; published?: boolean;
}
export interface Task extends BaseEntity {
  clientId?: string; title: string; dueAt?: string; durationMin: number; urgent: boolean; completed: boolean;
  stage?: WorkflowStage; notes?: string;
}
export interface CalendarEvent extends BaseEntity {
  clientId?: string; title: string; kind: EventKind; category: string; startAt: string;
  endAt?: string; allDay?: boolean; notes?: string;
}
export interface LeadSource { label: string; url?: string; checkedAt?: string; }
export interface LeadStatusEntry { status: LeadSalesStatus; at: string; note?: string; }
export interface Lead extends BaseEntity {
  name: string; contact?: string; email?: string; phone?: string; monthlyValue: number;
  status: 'Da contattare' | 'Contattato' | 'Appuntamento' | 'Proposta inviata' | 'Acquisito' | 'Perso';
  contacted?: boolean;
  outcome?: 'OK' | 'NO' | 'Da richiamare';
  lastContactAt?: string; nextFollowUpAt?: string; notes?: string;

  businessName?: string; category?: string; leadType?: LeadType; address?: string; city?: string; postcode?: string; province?: string;
  latitude?: number; longitude?: number; distanceKm?: number; mobile?: string; website?: string; instagram?: string; facebook?: string;
  ownerName?: string; ownerConfidence?: 'bassa'|'media'|'alta'; rating?: number; reviewsCount?: number;
  websiteStatus?: 'Assente'|'Debole'|'Da rifare'|'Adeguato'|'E-commerce opportunity'|'Non verificato';
  socialStatus?: 'Assenti'|'Inattivi'|'Deboli'|'Adeguati'|'Forti'|'Non verificato';
  advertisingStatus?: 'Presente'|'Assente'|'Non verificato';
  isNewOpening?: boolean; isOpeningSoon?: boolean;
  fitScore?: number; needScore?: number; budgetScore?: number; budgetBand?: LeadBudgetBand; buyingScore?: number; timingScore?: number; opportunityScore?: number; priority?: LeadPriority;
  recommendedService?: 'Nuovo sito'|'Restyling sito'|'E-commerce'|'Gestione Social Completa'|'Campagne Ads'|'Social + Sito'|'Sito + Ads'|'Social + Ads'|'Pacchetto completo';
  upsellService?: string; aiAnalysis?: string; salesStatus?: LeadSalesStatus; statusHistory?: LeadStatusEntry[];
  followUpDate?: string; followUpNote?: string; discoveredAt?: string; lastCheckedAt?: string; convertedClientId?: string;
  sourceProvider?: string; sources?: LeadSource[]; externalId?: string; fingerprint?: string;
}
export interface Payment extends BaseEntity { clientId: string; amount: number; dueDate: string; paidAt?: string; note?: string; }
export interface FollowerSnapshot extends BaseEntity { clientId: string; platform: 'Instagram'|'TikTok'; date: string; count: number; }
export interface Strategy extends BaseEntity {
  clientId: string; objective: string; summary: string; target: number;
  pillars: { name: string; count: number }[];
  ideas: { title: string; pillar: string; platform: Platform; format: ContentFormat; hook: string; cta: string; funnel: 'Discovery'|'Trust'|'Action' }[];
  approved: boolean;
}
export interface FocusSession extends BaseEntity {
  plannedMinutes: number; completedMinutes: number; startedAt: string; endedAt: string;
  taskId?: string; scriptId?: string; workflowStage?: 'Registrazione'|'Montaggio'|'Programmazione'|'Pubblicato'; label?: string;
}
export interface Habit extends BaseEntity { name: string; archived?: boolean; }
export interface HabitCompletion extends BaseEntity { habitId: string; date: string; completed: boolean; }
export interface RewardEntry extends BaseEntity {
  actionKey: string; points: number; source: 'task'|'script'|'workflow'|'focus'|'habit'|'lead'; label?: string;
}
export interface MonthlyGoalResult { month:string; goal:number; actual:number; percent:number; }
export interface Settings extends BaseEntity {
  key: 'singleton'; pinHash?: string; firstRunDone: boolean; monthlyRevenueGoal: number; clientGoal: number;
  darkMode: boolean; syncToken?: string; profileName?: string; dateFormat?: 'it-IT';
  notificationsEnabled?: boolean; clientReminders?: boolean; appointmentReminders?: boolean;
  paymentReminders?: boolean; followUpReminders?: boolean; smartReminders?: boolean;
  onboardingComplete?: boolean; workDays?: number[]; monthlyGoalMonth?: string; monthlyGoalHistory?: MonthlyGoalResult[];
  autoLockMinutes?: number; lastSyncAt?: string;
}
