/**
 * Minimal stand-in for Undici's Dispatcher type so we do not need the
 * real `undici` module at compile time on Node 18.
 */
import {ProxyAgent} from 'proxy-agent';
import { type Dispatcher } from 'undici-types';
/**
 * Creates an Undici dispatcher that routes requests through an HTTP(S)
 * proxy defined by the standard environment variables.
 *
 * Requires Node.js 24+ where Undici is bundled.
 */
export function createProxyDispatcher(): Dispatcher | undefined {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (!proxyUrl) {
        return;
    }

    // ProxyAgent accepts the proxy URL string directly
    //@ts-expect-error ProxyAgent constructor does not appear to have proper type
    return new ProxyAgent(proxyUrl);
}
