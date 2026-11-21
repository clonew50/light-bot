/*
 * Lightweight plugin registry facade.
 *
 * The command loader can populate `plugins` directly, while consumers that
 * still read `global.plugins` continue to observe the same entries.
 */

const fallbackRegistry = Object.create(null)

function currentRegistry() {
  const registry = globalThis.plugins
  return registry && typeof registry === 'object' ? registry : fallbackRegistry
}

export const plugins = new Proxy(fallbackRegistry, {
  get(_target, property, receiver) {
    return Reflect.get(currentRegistry(), property, receiver)
  },
  set(_target, property, value) {
    const registry = currentRegistry()
    const ok = Reflect.set(registry, property, value)
    if (registry !== fallbackRegistry) Reflect.set(fallbackRegistry, property, value)
    return ok
  },
  has(_target, property) {
    return Reflect.has(currentRegistry(), property)
  },
  deleteProperty(_target, property) {
    const registry = currentRegistry()
    const ok = Reflect.deleteProperty(registry, property)
    Reflect.deleteProperty(fallbackRegistry, property)
    return ok
  },
  ownKeys() {
    return Reflect.ownKeys(currentRegistry())
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Reflect.getOwnPropertyDescriptor(currentRegistry(), property)
    return descriptor ? { ...descriptor, configurable: true } : undefined
  },
})

export function registerPlugin(name, command) {
  if (!name || typeof name !== 'string') {
    throw new TypeError('Plugin name must be a non-empty string')
  }
  if (!command || typeof command !== 'function') {
    throw new TypeError('Plugin command must be a function')
  }
  plugins[name] = command
  return command
}

export function unregisterPlugin(name) {
  delete plugins[name]
}

export function getPlugins() {
  return { ...currentRegistry() }
}

export function clearPlugins() {
  for (const key of Reflect.ownKeys(currentRegistry())) {
    delete plugins[key]
  }
}

export default plugins
