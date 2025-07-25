import { buildErrorBlocks } from '../src/blocks/error-block';
import { ApiError } from '../src/polarity';

describe('buildErrorBlocks', () => {
  it('prefixes the "Show Error Details" button with a warning emoji', () => {
    const err = new ApiError('Something went wrong');
    const blocks = buildErrorBlocks('Test Integration', err);

    // Find the button element
    const button = blocks
      .filter((b): b is { type: 'actions'; elements: unknown[] } => b.type === 'actions')
      .flatMap((b) => (b as { elements: { type: string; text?: { text: string } }[] }).elements)
      .find((el) => el.type === 'button');

    expect(button).toBeDefined();
    expect(button?.text?.text).toBe(':warning: Show Error Details');
  });
});
