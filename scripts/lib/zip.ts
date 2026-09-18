/**
 * Minimal ZIP reader (stored and deflate entries, no ZIP64) so the data scripts
 * need no dependency to read the USDA download.
 */
import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export interface ZipEntry {
  name: string;
  read: () => Buffer;
}

function findEndOfCentralDirectory(zip: Buffer): number {
  // The comment at the end can be up to 65535 bytes long.
  const min = Math.max(0, zip.length - 22 - 0xffff);
  for (let i = zip.length - 22; i >= min; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error('Not a zip file (end of central directory not found)');
}

export function listZipEntries(zip: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(zip);
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== CENTRAL_SIGNATURE)
      throw new Error('Corrupt zip central directory');
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    entries.push({
      name,
      read: () => {
        if (zip.readUInt32LE(localOffset) !== LOCAL_SIGNATURE)
          throw new Error(`Corrupt entry ${name}`);
        const start =
          localOffset +
          30 +
          zip.readUInt16LE(localOffset + 26) +
          zip.readUInt16LE(localOffset + 28);
        const data = zip.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data);
        throw new Error(`Unsupported compression method ${method} in ${name}`);
      },
    });
  }
  return entries;
}
