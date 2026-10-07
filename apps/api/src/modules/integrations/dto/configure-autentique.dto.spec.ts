import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConfigureAutentiqueDto } from './integrations.dto';

const check = (apiToken: unknown) => {
  const dto = plainToInstance(ConfigureAutentiqueDto, { apiToken });
  return { dto, errors: validateSync(dto) };
};

describe('ConfigureAutentiqueDto', () => {
  it('trims the pasted token and accepts it', () => {
    const { dto, errors } = check('  abc123DEF456\n');
    expect(errors).toHaveLength(0);
    expect(dto.apiToken).toBe('abc123DEF456');
  });
  it.each(['abc def', 'abc\ndef', 'tókén123', '', '   ', 42])('rejects %j', (value) => {
    expect(check(value).errors.length).toBeGreaterThan(0);
  });
});
