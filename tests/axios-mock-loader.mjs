// Module hook that intercepts the `axios` specifier so tests can program the
// plugin's HTTP responses without network access. No new dependency: this uses
// only node:module's register() API.
//
// The plugin calls `axios.get(url, cfg)`; the mock routes it to
// globalThis.__axiosMockGet, which each test (re)assigns.

export async function resolve(specifier, context, next) {
    if (specifier === 'axios' || specifier === 'node_modules/axios') {
        return {
            shortCircuit: true,
            url: 'data:text/javascript,' + encodeURIComponent(
                'export default { get: (url, cfg) => globalThis.__axiosMockGet(url, cfg) };'
            ),
            format: 'module',
            source: 'export default { get: (url, cfg) => globalThis.__axiosMockGet(url, cfg) };'
        };
    }
    return next(specifier, context);
}
