export default function mutate(doc, mutation = 'delete-prop') {
  const out = JSON.parse(JSON.stringify(doc));
  switch (mutation) {
    case 'delete-prop': {
      const key = Object.keys(out)[0];
      delete out[key];
      break;
    }
    case 'rename-prop': {
      const key = Object.keys(out)[0];
      out[`renamed-${key}`] = out[key];
      delete out[key];
      break;
    }
    case 'unit-flip': {
      const key = Object.keys(out)[0];
      const token = out[key];
      if (token && typeof token.$value === 'string') {
        out[key] = { ...token, $value: token.$value.replace(/(\d+)([a-z%]+)/i, '$1deg') };
      }
      break;
    }
    default:
      throw new Error(`unknown mutation ${mutation}`);
  }
  return out;
}
