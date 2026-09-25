import { describe,it,expect } from 'vitest';
import { focusReward, levelFor } from './rewards';

describe('Dopamina rules',()=>{
  it('rewards focus durations coherently',()=>{
    expect(focusReward(4)).toBe(0);
    expect(focusReward(15)).toBe(10);
    expect(focusReward(25)).toBe(20);
    expect(focusReward(45)).toBe(30);
  });
  it('calculates levels without penalties',()=>{
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(300).name).toBe('Momentum');
    expect(levelFor(601).level).toBeGreaterThanOrEqual(4);
  });
});
