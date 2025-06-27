/**
 * Unit-tests for the ProgressBar helper (src/blocks/progress-bar.ts).
 *
 * The SendFn dependency is mocked so we can assert interactions without
 * touching the real Slack API.  All tests use an isolated mocked instance.
 */

import { jest } from '@jest/globals';
import { ProgressBar } from '../src/blocks/progress-bar';
import type { SendFn } from '../src/utils/slack-messenger';

describe('ProgressBar', () => {
  const TS = '12345';

  let sendMock: jest.MockedFunction<SendFn>;

  beforeEach(() => {
    sendMock = jest.fn(async () => TS) as unknown as jest.MockedFunction<SendFn>;
  });

  test('posts an initial message then edits it on subsequent updates', async () => {
    const bar = new ProgressBar({ send: sendMock, label: 'Processing', total: 10 });

    await bar.update(0); // first render
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: 'Processing 0/10',
        blocks: expect.any(Array)
      })
    );

    await bar.update(5); // edit existing message
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: 'Processing 5/10',
        blocks: expect.any(Array),
        messageTimestamp: TS
      })
    );
  });

  test('setLabel updates the descriptive label inline', async () => {
    const bar = new ProgressBar({ send: sendMock, label: 'Old', total: 10 });

    await bar.update(3);
    await bar.setLabel('New');

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'New 3/10' })
    );
  });

  test('destroy deletes the message and further calls throw', async () => {
    const bar = new ProgressBar({ send: sendMock, label: 'Delete-me', total: 5 });

    await bar.update(0);
    await bar.destroy();

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenLastCalledWith({
      text: ' ',
      blocks: [],
      messageTimestamp: TS
    });

    await expect(bar.update(1)).rejects.toThrow('destroyed');
  });

  test('constructor rejects non-positive totals', () => {
    expect(
      () => new ProgressBar({ send: sendMock, label: 'invalid', total: 0 })
    ).toThrow('greater than 0');
  });

  test('update rejects out-of-bounds progress values', async () => {
    const bar = new ProgressBar({ send: sendMock, label: 'bounds', total: 10 });
    await expect(bar.update(-1)).rejects.toThrow();
    await expect(bar.update(11)).rejects.toThrow();
  });
});
