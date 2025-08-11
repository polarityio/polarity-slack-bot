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

  test('posts the first message only when progress advances, then edits', async () => {
    const bar = new ProgressBar({ send: sendMock, label: 'Processing', total: 10 });

    // first update (0) posts the initial bar
    await bar.update(0);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Processing 0/10',
        blocks: expect.any(Array)
      })
    );

    // subsequent progress → edit existing message
    await bar.update(5);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Processing 5/10',
        blocks: expect.any(Array),
        messageTimestamp: TS
      })
    );

    // subsequent progress → edit existing message
    await bar.update(8);
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(sendMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: 'Processing 8/10',
        blocks: expect.any(Array),
        messageTimestamp: TS
      })
    );
  });

  test('setLabel does not send another message when progress is unchanged', async () => {
    const bar = new ProgressBar({ send: sendMock, label: 'Old', total: 10 });

    await bar.update(3);
    await bar.setLabel('New');

    // still only the initial send
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  test('destroy deletes the message and further calls throw', async () => {
    const bar = new ProgressBar({ send: sendMock, label: 'Delete-me', total: 5 });

    await bar.update(1); // send first message
    await bar.destroy();

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenLastCalledWith({
      text: ' ',
      blocks: [],
      messageTimestamp: TS
    });

    await expect(bar.update(2)).rejects.toThrow('destroyed');
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
