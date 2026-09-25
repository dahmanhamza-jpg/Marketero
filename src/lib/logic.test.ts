import { describe,it,expect } from 'vitest';
import { firstClientDeadline, nextClientDeadline, overlaps, taskScore, toDateOnly } from './logic';

describe('logic',()=>{
  it('detects overlapping events',()=>expect(overlaps(
    {startAt:'2026-09-22T10:00:00Z',endAt:'2026-09-22T11:00:00Z'},
    {startAt:'2026-09-22T10:30:00Z',endAt:'2026-09-22T11:30:00Z'}
  )).toBe(true));

  it('urgent task scores above normal task',()=>{
    const base:any={id:'1',title:'x',durationMin:30,completed:false,createdAt:'',updatedAt:''};
    expect(taskScore({...base,urgent:true})).toBeGreaterThan(taskScore({...base,urgent:false}));
  });

  it('sets first client deadline to one month plus one week',()=>{
    const client:any={startDate:'2026-10-10'};
    expect(toDateOnly(firstClientDeadline(client)!)).toBe('2026-11-17');
  });

  it('keeps monthly cadence after first deadline',()=>{
    const client:any={startDate:'2026-10-10'};
    expect(toDateOnly(nextClientDeadline(client,new Date(2026,11,1))!)).toBe('2026-12-17');
  });

  it('supports all-day events without an explicit end date',()=>{
    expect(overlaps(
      {startAt:'2026-10-18T00:00:00',allDay:true},
      {startAt:'2026-10-18T15:30:00'}
    )).toBe(true);
  });
});
