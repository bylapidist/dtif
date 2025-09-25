import { TextEncoder } from 'node:util';

import type { CliIo, GatherInputsResult } from './types.js';

export async function gatherInputs(
  inputs: readonly string[],
  io: CliIo
): Promise<GatherInputsResult> {
  const collected: GatherInputsResult['inputs'] = [];
  const errors: string[] = [];
  let stdinPromise: Promise<Uint8Array | undefined> | undefined;

  const readStdinOnce = async (): Promise<Uint8Array | undefined> => {
    stdinPromise ??= readFromStream(io.stdin);
    return stdinPromise;
  };

  if (inputs.length === 0) {
    if (isInteractiveStdin(io.stdin)) {
      return {
        inputs: [],
        errors: ['No input provided. Pass a file path or use "-" to read from stdin.']
      };
    }
    const stdinInput = await readStdinOnce();
    if (stdinInput) {
      collected.push({ content: stdinInput });
    }
    return { inputs: collected, errors };
  }

  for (const entry of inputs) {
    if (entry === '-') {
      const stdinInput = await readStdinOnce();
      if (!stdinInput) {
        errors.push('No data received on stdin.');
      } else {
        collected.push({ content: stdinInput });
      }
      continue;
    }
    collected.push(entry);
  }

  return { inputs: collected, errors };
}

async function readFromStream(stream: NodeJS.ReadableStream): Promise<Uint8Array | undefined> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of stream) {
    const array =
      chunk instanceof Uint8Array
        ? new Uint8Array(chunk)
        : typeof chunk === 'string'
          ? encoder.encode(chunk)
          : encoder.encode(String(chunk));
    chunks.push(array);
    total += array.length;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes.length === 0 ? undefined : bytes;
}

function isInteractiveStdin(stream: NodeJS.ReadableStream): boolean {
  const isTty: unknown = Reflect.get(stream, 'isTTY');
  return typeof isTty === 'boolean' && isTty;
}
