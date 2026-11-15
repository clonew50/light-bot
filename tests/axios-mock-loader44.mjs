// Isolated-process axios mock for the todo-44 YouTube downloader tests.
// Registered with `node --import` in a dedicated child process (never in the
// aggregator process) so the axios hook can't leak into other lanes.
//
// The scenario is handed over as globalThis.__ytScenario (plain JSON) before the
// plugin is imported; every axios call is recorded on globalThis.__ytCalls.
import { register } from 'node:module';
register(new URL('./axios-mock-loader44.mjs', import.meta.url).href);

export async function resolve(specifier, context, next) {
  if (specifier === 'axios' || specifier === 'node_modules/axios') {
    const mock = `
      globalThis.__ytCalls = { get: [], post: [] };
      globalThis.__MOCK44_ACTIVE = true;
      const settle = (scenario, key, detail) => {
        const entry = scenario && scenario[key];
        if (!entry) return Promise.reject(new Error('no scenario for ' + key));
        if (entry.reject) return Promise.reject(new Error(entry.reject));
        return Promise.resolve({ data: entry.data, status: 200 });
      };
      export default {
        get: (url, cfg) => {
          globalThis.__ytCalls.get.push({ url, cfg });
          const scenario = globalThis.__ytScenario;
          if (String(url).includes('/oembed')) return settle(scenario, 'oembed', 'get');
          if (String(url).includes('loader.to/ajax')) return settle(scenario, 'loader', 'get');
          return settle(scenario, 'others', 'get');
        },
        post: (url, body, cfg) => {
          const client = body && body.context && body.context.client ? body.context.client.clientName : '?';
          globalThis.__ytCalls.post.push({ url, cfg, client, body });
          const scenario = globalThis.__ytScenario;
          const player = scenario && scenario.player || {};
          const entry = player.byClient && player.byClient[client] ? player.byClient[client] : player;
          if (entry.reject) return Promise.reject(new Error(entry.reject));
          if (!entry.data) return Promise.reject(new Error('no scenario for player/' + client));
          return Promise.resolve({ data: entry.data, status: 200 });
        },
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