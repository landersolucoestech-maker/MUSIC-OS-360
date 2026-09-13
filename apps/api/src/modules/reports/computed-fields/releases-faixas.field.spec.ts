import { BadRequestException } from '@nestjs/common';
import { writeReleasesFaixasForImport } from './releases-faixas.field';

/**
 * find-532335a9 (Wave 7 cross-review): per-track ISRC inside the "Faixas do
 * Lançamento" repeating-group child sheet bypassed ImportCommitService's
 * ISRC pre-check/normalization entirely — those only walk general/non-
 * repeating columns. This proves the per-track write path now applies the
 * same normalization/validation independently.
 */
describe('writeReleasesFaixasForImport — per-track ISRC (find-532335a9)', () => {
  function makeQr() {
    return { query: jest.fn().mockResolvedValue(undefined) };
  }

  it('normalizes a hyphenated/lowercase per-track ISRC to canonical form before persist', async () => {
    const qr = makeQr();
    await writeReleasesFaixasForImport(qr as never, 'tenant-1', 'release-1', [
      { nome: 'Track 1', isrc: 'br-abc-26-00001' },
    ]);
    const [, params] = qr.query.mock.calls[0];
    const stored = JSON.parse(params[0]);
    expect(stored[0].isrc).toBe('BRABC2600001');
  });

  it('rejects a malformed per-track ISRC', async () => {
    const qr = makeQr();
    await expect(
      writeReleasesFaixasForImport(qr as never, 'tenant-1', 'release-1', [
        { nome: 'Track 1', isrc: 'not-an-isrc' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(qr.query).not.toHaveBeenCalled();
  });

  it('leaves an absent per-track ISRC as null (optional field)', async () => {
    const qr = makeQr();
    await writeReleasesFaixasForImport(qr as never, 'tenant-1', 'release-1', [
      { nome: 'Track 1' },
    ]);
    const [, params] = qr.query.mock.calls[0];
    const stored = JSON.parse(params[0]);
    expect(stored[0].isrc).toBeNull();
  });
});
