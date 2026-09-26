import { describe,it,expect } from 'vitest';
import { isLeadContacted, statusForLeadOutcome } from './lead';

describe('lead quick management',()=>{
  it('maps the three quick outcomes to compatible existing statuses',()=>{
    expect(statusForLeadOutcome('OK')).toBe('Acquisito');
    expect(statusForLeadOutcome('NO')).toBe('Perso');
    expect(statusForLeadOutcome('Da richiamare')).toBe('Contattato');
  });
  it('keeps old leads compatible when contacted is missing',()=>{
    expect(isLeadContacted({id:'1',name:'A',monthlyValue:0,status:'Da contattare',createdAt:'',updatedAt:''})).toBe(false);
    expect(isLeadContacted({id:'2',name:'B',monthlyValue:0,status:'Contattato',createdAt:'',updatedAt:''})).toBe(true);
  });
});
