import { buildErrorBlocks } from '../src/blocks/error-block';
import { ApiError } from '../src/errors/api-error';
import type { SectionBlock, Button } from '@slack/types';

describe('buildErrorBlocks', () => {
  it('prefixes the "Show Error Details" button with a warning emoji', () => {
    const err = new ApiError('Something went wrong');
    const blocks = buildErrorBlocks('Test Integration', 'TEST', err);

    // Find the button accessory inside the section block
    const section = blocks.find((b): b is SectionBlock => b.type === 'section');
    const button = section?.accessory as Button | undefined;

    expect(button).toBeDefined();
    expect(button?.text?.text).toBe(':warning: Show Error Details');
  });
});
