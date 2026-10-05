import { WORK_PRIORITIES } from '@music-os-360/types';
import { MARKETING_TASK_PRIORITIES, canonicalMarketingTaskPriority } from './marketing-vocabulary';

describe('marketing task priority vocabulary (shared WorkPriority)', () => {
  it('derives from the shared tuple with the persisted values unchanged', () => {
    expect(MARKETING_TASK_PRIORITIES).toBe(WORK_PRIORITIES);
    expect([...MARKETING_TASK_PRIORITIES]).toEqual(['low', 'normal', 'high', 'urgent']);
  });
  it('still maps legacy aliases and is prototype-key safe', () => {
    expect(canonicalMarketingTaskPriority({ value: 'media' })).toBe('normal');
    expect(canonicalMarketingTaskPriority({ value: 'urgente' })).toBe('urgent');
    expect(canonicalMarketingTaskPriority({ value: 'constructor' })).toBe('constructor');
    expect(canonicalMarketingTaskPriority({ value: '__proto__' })).toBe('__proto__');
  });
});
