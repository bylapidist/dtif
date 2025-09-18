export default function diffSnapshots(actual, expected) {
  const norm = (str) => str.replace(/\r\n/g, '\n').trim();
  const a = norm(actual);
  const e = norm(expected);
  return { valid: a === e, diff: a === e ? '' : `expected\n${e}\nreceived\n${a}` };
}
