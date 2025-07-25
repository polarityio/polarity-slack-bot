import { buildErrorBlocks } from '../src/blocks/error-block';
import { ApiError } from '../src/errors/api-error';
import type { ActionsBlock, Button } from '@slack/types';

describe('buildErrorBlocks', () => {
  it('prefixes the "Show Error Details" button with a warning emoji', () => {
    const err = new ApiError('Something went wrong');
    const blocks = buildErrorBlocks('Test Integration', err);

    // Find the button element
    const button = blocks
      .filter((b): b is ActionsBlock => b.type === 'actions')
      .flatMap((b) => b.elements)
      .find((el): el is Button => el.type === 'button');

    expect(button).toBeDefined();
    expect(button?.text?.text).toBe(':warning: Show Error Details');
  });
});
