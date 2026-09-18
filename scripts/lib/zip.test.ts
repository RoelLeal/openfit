import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { listZipEntries } from './zip.ts';

/** Writes a minimal zip (enough for the reader: sizes, offsets and methods). */
function makeZip(files: { name: string; data: string; method: 0 | 8 }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const raw = Buffer.from(file.data);
    const body = file.method === 8 ? deflateRawSync(raw) : raw;
    const name = Buffer.from(file.name);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(file.method, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(file.method, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe('listZipEntries', () => {
  it('reads stored and deflated entries', () => {
    const zip = makeZip([
      { name: 'folder/food.csv', data: 'a,b\n1,2\n'.repeat(50), method: 8 },
      { name: 'readme.txt', data: 'hola', method: 0 },
    ]);
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(['folder/food.csv', 'readme.txt']);
    expect(entries[0]?.read().toString()).toBe('a,b\n1,2\n'.repeat(50));
    expect(entries[1]?.read().toString()).toBe('hola');
  });

  it('rejects non-zip data', () => {
    expect(() => listZipEntries(Buffer.from('definitely not a zip file at all'))).toThrow(/zip/);
  });
});
