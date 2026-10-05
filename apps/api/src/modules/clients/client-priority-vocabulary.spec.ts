import { RELATIONSHIP_PRIORITIES } from '@music-os-360/types';
import { CLIENT_PRIORITIES, canonicalClientPriority } from './client-legacy-fields';

describe('client priority vocabulary (shared RelationshipPriority)', () => {
  it('derives from the shared tuple with the persisted values unchanged', () => {
    expect(CLIENT_PRIORITIES).toBe(RELATIONSHIP_PRIORITIES);
    expect([...CLIENT_PRIORITIES]).toEqual(['low', 'medium', 'high', 'strategic']);
  });
  it('still maps legacy aliases and keeps canonical/unknown values (prototype-key safe)', () => {
    expect(canonicalClientPriority('baixa')).toBe('low');
    expect(canonicalClientPriority('média')).toBe('medium');
    expect(canonicalClientPriority('Estratégica')).toBe('strategic');
    expect(canonicalClientPriority('high')).toBe('high');
    expect(canonicalClientPriority('constructor')).toBe('constructor');
    expect(canonicalClientPriority('__proto__')).toBe('__proto__');
  });
});
