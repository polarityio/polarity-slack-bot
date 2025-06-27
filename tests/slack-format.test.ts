import { resultBlocks } from '../src/blocks/result-block';

describe('resultBlocks', () => {
  it('returns empty array when given no results', () => {
    expect(resultBlocks([])).toHaveLength(0);
  });
});
