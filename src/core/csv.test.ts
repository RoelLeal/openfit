import { describe, expect, it } from 'vitest';
import { csvCell, parseCsv, parseCsvObjects, toCsv } from './csv.ts';

describe('csvCell', () => {
  it('quotes only when needed', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(' padded')).toBe('" padded"');
  });

  it('writes numbers and empty values', () => {
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('neutralizes formula injection in text cells', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
});

describe('toCsv / parseCsv', () => {
  it('round-trips tricky content', () => {
    const rows = [
      ['name', 'note'],
      ['Café, con leche', 'He said "ok"'],
      ['multi\nline', ''],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('uses CRLF line endings', () => {
    expect(toCsv([['a', 1]])).toBe('a,1\r\n');
  });

  it('parses LF files, a BOM and a missing final newline', () => {
    expect(parseCsv('\uFEFFa,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('parses objects and skips blank lines', () => {
    expect(parseCsvObjects('id,name\n1,Egg\n\n2,"Rice, white"\n')).toEqual([
      { id: '1', name: 'Egg' },
      { id: '2', name: 'Rice, white' },
    ]);
    expect(parseCsvObjects('')).toEqual([]);
  });
});
