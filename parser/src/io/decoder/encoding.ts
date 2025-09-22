import { DecoderError } from './errors.js';

const TEXT_DECODER_OPTIONS: TextDecoderOptions & { fatal: true } = { fatal: true };

export function decodeBytes(bytes: Uint8Array): { text: string } {
  if (bytes.length === 0) {
    return { text: '' };
  }

  const { encoding, offset } = detectEncoding(bytes);

  try {
    const decoder = new TextDecoder(encoding, TEXT_DECODER_OPTIONS);
    const view = offset > 0 ? bytes.subarray(offset) : bytes;
    const text = decoder.decode(view);
    return { text };
  } catch (error) {
    throw new DecoderError(`Failed to decode DTIF document as ${encoding.toUpperCase()}.`, {
      cause: error
    });
  }
}

function detectEncoding(bytes: Uint8Array): { encoding: string; offset: number } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: 'utf-8', offset: 3 };
  }

  if (bytes.length >= 2) {
    const lead = bytes[0];
    const trail = bytes[1];
    if (lead === 0xfe && trail === 0xff) {
      return { encoding: 'utf-16be', offset: 2 };
    }
    if (lead === 0xff && trail === 0xfe) {
      return { encoding: 'utf-16le', offset: 2 };
    }
  }

  return { encoding: 'utf-8', offset: 0 };
}
