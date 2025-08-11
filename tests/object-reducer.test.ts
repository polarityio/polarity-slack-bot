import { reduceObject } from '../src/utils/object-reducer';

describe('reduceObject', () => {
  const emptyValues: unknown[] = [null, undefined, '', [], {}];

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Values flagged by isEmptyValue
  // ────────────────────────────────────────────────────────────────────────────
  describe('removes values considered empty', () => {
    test.each(emptyValues)('object property %p is removed', (value) => {
      const input = { keep: 1, remove: value };
      const output = reduceObject(input);
      expect(output).toEqual({ keep: 1 });
    });

    test.each(emptyValues)('array element %p is removed', (value) => {
      const input = [0, value, 1];
      const output = reduceObject(input);
      expect(output).toEqual([0, 1]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Special-case strings (hex colour & base-64 image)
  // ────────────────────────────────────────────────────────────────────────────
  it('removes base-64 image strings', () => {
    const img = 'data:image/png;base64,iVBORw0KGgo=';
    const input = { a: img, b: 'keep' };
    expect(reduceObject(input)).toEqual({ b: 'keep' });
  });

  it('removes hex colour strings', () => {
    const input = { a: '#FFAA00', b: 'keep' };
    expect(reduceObject(input)).toEqual({ b: 'keep' });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Deep recursion & mixed content
  // ────────────────────────────────────────────────────────────────────────────
  it('recursively cleans nested structures', () => {
    const input = {
      a: null,
      b: '',
      c: [],
      d: {},
      e: '#fff',
      f: 'data:image/png;base64,abc',
      g: 'valid',
      h: ['', null, { x: '', y: 42 }, { z: 'ok' }],
      i: { j: undefined, k: 'ok', l: '#000000' }
    };

    const expected = {
      g: 'valid',
      h: [{y: 42}, { z: 'ok' }],
      i: { k: 'ok' }
    };

    expect(reduceObject(input)).toEqual(expected);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Non-mutation guarantee
  // ────────────────────────────────────────────────────────────────────────────
  it('does not mutate its input', () => {
    const original = {
      a: null,
      b: { c: '', d: 'keep' },
      e: [undefined, 1]
    };

    const snapshot = structuredClone(original);
    reduceObject(original);
    expect(original).toEqual(snapshot);
  });
});
