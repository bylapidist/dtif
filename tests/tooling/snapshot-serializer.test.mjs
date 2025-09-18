import assert from 'node:assert/strict';
import serializeSnapshot from './snapshot-serializer.mjs';

const fixture = {
  tokens: {
    border: {
      value: '#000000'
    },
    accent: {
      value: '#ff00ff',
      description: 'Accent color',
      $extensions: {
        mode: {
          light: '#eeeeee',
          dark: '#222222'
        }
      }
    }
  },
  $metadata: {
    version: 1,
    description: 'example'
  }
};

const serialized = serializeSnapshot(fixture);

const expected = `{
  "$metadata": {
    "description": "example",
    "version": 1
  },
  "tokens": {
    "accent": {
      "$extensions": {
        "mode": {
          "dark": "#222222",
          "light": "#eeeeee"
        }
      },
      "description": "Accent color",
      "value": "#ff00ff"
    },
    "border": {
      "value": "#000000"
    }
  }
}`;

assert.equal(serialized, expected, 'serializer should retain and sort nested token entries');

console.log('✔ snapshot serializer sorts nested keys without dropping members');
