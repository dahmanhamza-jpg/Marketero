import { describe,it,expect } from 'vitest';
import { overlaps, taskScore } from './logic';
describe('logic',()=>{
 it('detects overlapping events',()=>expect(overlaps({startAt:'2026-09-22T10:00:00Z',endAt:'2026-09-22T11:00:00Z'},{startAt:'2026-09-22T10:30:00Z',endAt:'2026-09-22T11:30:00Z'})).toBe(true));
 it('urgent task scores above normal task',()=>{const base:any={id:'1',title:'x',durationMin:30,completed:false,createdAt:'',updatedAt:''};expect(taskScore({...base,urgent:true})).toBeGreaterThan(taskScore({...base,urgent:false}))});
});
