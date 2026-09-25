import { describe,it,expect } from 'vitest';
import { scriptProgress, workflowSummary } from './workflow';

const base:any={id:'s1',clientId:'c1',title:'Video',platform:'Instagram',format:'Reel',status:'Pronto',referenceUrls:[],createdAt:'',updatedAt:''};

describe('workflow progress',()=>{
  it('counts Script as the first completed step',()=>expect(scriptProgress(base)).toBe(20));
  it('calculates 60% for Script + Registrazione + Montaggio',()=>expect(scriptProgress({...base,recorded:true,edited:true})).toBe(60));
  it('calculates 100% when all real stages are complete',()=>expect(scriptProgress({...base,recorded:true,edited:true,scheduled:true,published:true})).toBe(100));
  it('summarizes ten scripts without arbitrary percentages',()=>{
    const scripts=Array.from({length:10},(_,i)=>({...base,id:'s'+i,recorded:i<8,edited:i<6,scheduled:i<4,published:i<3}));
    const summary=workflowSummary(scripts);
    expect(summary.total).toBe(10);
    expect(summary.counts.recorded).toBe(8);
    expect(summary.counts.edited).toBe(6);
    expect(summary.counts.scheduled).toBe(4);
    expect(summary.counts.published).toBe(3);
    expect(summary.progress).toBe(62);
  });
});
