import { BadRequestException } from '@nestjs/common';
import { AudiovisualProjectsService } from './projects.service';

/** Rejected status changes answer with PT-BR copy — never the raw status enum values. */
describe('AudiovisualProjectsService.assertValidTransition — end-user copy', () => {
  const assertValidTransition = (from: string, to: string) =>
    (AudiovisualProjectsService.prototype as unknown as {
      assertValidTransition(from: string, to: string): void;
    }).assertValidTransition(from, to);

  const messageOf = (from: string, to: string): string => {
    try {
      assertValidTransition(from, to);
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      return (err as BadRequestException).message;
    }
    throw new Error('expected a rejection');
  };

  it.each([
    ['draft', 'unknown_status'],
    ['production', 'draft'],
    ['draft', 'post_production'],
  ])('%s → %s: no raw status in the message', (from, to) => {
    const message = messageOf(from, to);
    expect(message).not.toContain(from);
    expect(message).not.toContain(to);
    expect(message).not.toMatch(/cancelled|_/);
  });

  it('allows a normal forward step and cancellation', () => {
    expect(() => assertValidTransition('draft', 'briefing')).not.toThrow();
    expect(() => assertValidTransition('production', 'cancelled')).not.toThrow();
  });
});
