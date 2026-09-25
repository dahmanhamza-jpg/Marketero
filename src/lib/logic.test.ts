import { describe,it,expect } from 'vitest';
import { clientDeadlinesBetween, firstClientDeadline, greetingForHour, overlaps, taskScore } from './logic';
import type { Client } from '../types/models';

describe('logic',()=>{
 it('detects overlapping timed events',()=>expect(overlaps({startAt:'2026-09-22T10:00:00Z',endAt:'2026-09-22T11:00:00Z'},{startAt:'2026-09-22T10:30:00Z',endAt:'2026-09-22T11:30:00Z'})).toBe(true));
 it('urgent task scores above normal task',()=>{const base:any={id:'1',title:'x',durationMin:30,completed:false,createdAt:'',updatedAt:''};expect(taskScore({...base,urgent:true})).toBeGreaterThan(taskScore({...base,urgent:false}))});
 it('creates the first client deadline one month and one week after start',()=>{const d=firstClientDeadline('2026-10-10');expect(d.getFullYear()).toBe(2026);expect(d.getMonth()).toBe(10);expect(d.getDate()).toBe(17)});
 it('creates following client deadlines monthly',()=>{const c={id:'c',name:'Cliente',niche:'x',monthlyFee:0,contentTarget:10,startDate:'2026-10-10',metaAds:false,platforms:[],createdAt:'',updatedAt:''} as Client;const dates=clientDeadlinesBetween(c,new Date(2026,10,1),new Date(2027,1,28));expect(dates.map(d=>[d.getMonth()+1,d.getDate()])).toEqual([[11,17],[12,17],[1,17],[2,17]])});
 it('uses a local-time greeting',()=>{expect(greetingForHour(8)).toBe('Buongiorno');expect(greetingForHour(14)).toBe('Buon pomeriggio');expect(greetingForHour(21)).toBe('Buonasera')});
});
