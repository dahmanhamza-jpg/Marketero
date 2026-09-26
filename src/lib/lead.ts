import type { Lead } from '../types/models';

export function statusForLeadOutcome(outcome:NonNullable<Lead['outcome']>):Lead['status']{
  if(outcome==='OK') return 'Acquisito';
  if(outcome==='NO') return 'Perso';
  return 'Contattato';
}

export function isLeadContacted(lead:Lead){
  return lead.contacted ?? lead.status!=='Da contattare';
}
