/**
 * Unit tests for src/polarity.ts helpers.
 *
 * Each test isolates the module so that the top-level code (which reads
 * environment variables and assigns constants) is re-evaluated with the custom
 * environment prepared by the test.
 *
 * The global `fetch` function is stubbed with Jest; responses are created with
 * the WHATWG Response class that ships with Node 18+ (and therefore Node 24).
 */

import { jest } from '@jest/globals';

const HOSTNAME = 'polarity.example';
const API_KEY = 'dummy-key';

/**
 * Replace the global fetch implementation for a single invocation.
 */
function mockFetchOnce(payload: unknown, status = 200): void {
  const responseInit: ResponseInit = {
    status,
    headers: { 'Content-Type': 'application/json' }
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  global.fetch = jest.fn(() =>
    Promise.resolve(new Response(JSON.stringify(payload), responseInit))
  ) as unknown as typeof fetch;
}

describe('polarity.ts', () => {
  beforeEach(() => {
    jest.resetModules(); // clear Node module cache
    process.env.POLARITY_HOSTNAME = HOSTNAME;
    process.env.POLARITY_API_KEY = API_KEY;
  });

  test('parseEntities returns parsed entities', async () => {
    const entities = [{ value: '8.8.8.8', type: 'IPv4' }];
    mockFetchOnce({ data: { attributes: { entities } } });

    await jest.isolateModules(async () => {
      const { parseEntities } = await import('../src/polarity');
      const result = await parseEntities('8.8.8.8');
      expect(result).toEqual(entities);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://${HOSTNAME}/api/parsed-entities`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('parseEntities propagates ApiError on HTTP error', async () => {
    const errorBody = {
      errors: [
        {
          detail: 'Bad Request',
          meta: { reason: 'invalid_format' }
        }
      ]
    };
    mockFetchOnce(errorBody, 400);

    await jest.isolateModules(async () => {
      const { parseEntities } = await import('../src/polarity');
      const { ApiError } = await import('../src/errors/api-error');
      await expect(parseEntities('foo')).rejects.toBeInstanceOf(ApiError);
    });
  });

  test('lookup returns searchedEntities and results', async () => {
    const entity = { value: '1.1.1.1', type: 'IPv4' };
    const lookupResult = { entity, data: null };
    const body = {
      data: { attributes: { entities: [entity], results: [lookupResult] } }
    };
    mockFetchOnce(body);

    await jest.isolateModules(async () => {
      const { lookup } = await import('../src/polarity');
      const response = await lookup([entity as never], 'maxmind');
      expect(response).toEqual({
        searchedEntities: [entity],
        results: [lookupResult]
      });
      expect(global.fetch).toHaveBeenCalledWith(
        `https://${HOSTNAME}/api/integrations/maxmind/lookup`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('getRunningIntegrations returns list', async () => {
    const integrations = [{ id: '1' }, { id: '2' }];
    mockFetchOnce({ data: integrations });

    await jest.isolateModules(async () => {
      const { getRunningIntegrations } = await import('../src/polarity');
      const list = await getRunningIntegrations();
      expect(list).toEqual(integrations);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  test('lookup propagates ApiError on HTTP error', async () => {
    const errorBody = {
      errors: [
        {
          detail: 'Internal Server Error',
          meta: { reason: 'unexpected_exception' }
        }
      ]
    };
    mockFetchOnce(errorBody, 500);

    await jest.isolateModules(async () => {
      const { lookup } = await import('../src/polarity');
      const { ApiError } = await import('../src/errors/api-error');
      const entity = { value: '1.1.1.1', type: 'IPv4' };
      await expect(lookup([entity as never], 'maxmind')).rejects.toBeInstanceOf(ApiError);
    });
  });

  test('getRunningIntegrations propagates ApiError on HTTP error', async () => {
    const errorBody = {
      errors: [
        {
          detail: 'Service Unavailable',
          meta: { reason: 'maintenance' }
        }
      ]
    };
    mockFetchOnce(errorBody, 503);

    await jest.isolateModules(async () => {
      const { getRunningIntegrations } = await import('../src/polarity');
      const { ApiError } = await import('../src/errors/api-error');
      await expect(getRunningIntegrations()).rejects.toBeInstanceOf(ApiError);
    });
  });
});
