// Loader for the todo-12 upload tests. Registered with `node --import` in an
// ISOLATED child process (never in the aggregator process) so it can't interfere
// with other lanes' axios hooks. It intercepts `axios` and routes it to a mock
// that records every call on globalThis.__axiosCalls instead of touching the net.
import { register } from 'node:module';
register(new URL('./axios-mock-loader12.mjs', import.meta.url).href);

export async function resolve(specifier, context, next) {
  if (specifier === 'axios' || specifier === 'node_modules/axios') {
    const mock = `
      globalThis.__axiosCalls = { get: [], post: [] };
      export default {
        get: (url, cfg) => { globalThis.__axiosCalls.get.push({ url, cfg }); return Promise.reject(new Error('network')); },
        post: (url, body, cfg) => {
          globalThis.__axiosCalls.post.push({ url, cfg });
          return Promise.resolve({ data: { status: true, path: 'https://x/y.jpg' } });
        },
        isAxiosError: true,
      };
    `;
    return {
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(mock),
      format: 'module',
    };
  }
  return next(specifier, context);
}
