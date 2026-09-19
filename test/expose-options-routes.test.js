'use strict'

const { test } = require('node:test')
const Fastify = require('..')

test('does not expose OPTIONS routes by default', async (t) => {
  const fastify = Fastify()
  t.after(() => fastify.close())

  fastify.get('/foo', async () => ({ hello: 'world' }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 404)
})

test('does not expose OPTIONS routes when exposeOptionsRoutes is false', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: false })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => ({ hello: 'world' }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 404)
})

test('exposes an OPTIONS route for every registered path', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => ({ hello: 'world' }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')
  t.assert.strictEqual(res.body, '')

  const getRes = await fastify.inject({ method: 'GET', url: '/foo' })
  t.assert.strictEqual(getRes.statusCode, 200)
  t.assert.deepStrictEqual(getRes.json(), { hello: 'world' })
})

test('Allow header lists every registered method sorted alphabetically', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.put('/foo', async () => 'ok')
  fastify.get('/foo', async () => 'ok')
  fastify.post('/foo', async () => 'ok')
  fastify.delete('/foo', async () => 'ok')

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'DELETE, GET, HEAD, OPTIONS, POST, PUT')
})

test('Allow header does not contain HEAD when exposeHeadRoutes is false', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true, exposeHeadRoutes: false })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => 'ok')

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, OPTIONS')
})

test('Allow header contains an explicitly registered HEAD route', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true, exposeHeadRoutes: false })
  t.after(() => fastify.close())

  fastify.head('/foo', async () => '')
  fastify.get('/foo', async () => 'ok')

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')
})

test('does not expose an OPTIONS route for unknown paths', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => 'ok')

  const res = await fastify.inject({ method: 'OPTIONS', url: '/bar' })
  t.assert.strictEqual(res.statusCode, 404)
})

test('user defined OPTIONS route takes precedence when registered first', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.options('/foo', async (request, reply) => {
    reply.header('allow', 'CUSTOM')
    return { custom: true }
  })
  fastify.get('/foo', async () => 'ok')

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.headers.allow, 'CUSTOM')
  t.assert.deepStrictEqual(res.json(), { custom: true })
})

test('user defined OPTIONS route takes precedence when registered last', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => 'ok')
  fastify.options('/foo', async (request, reply) => {
    reply.header('allow', 'CUSTOM')
    return { custom: true }
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.headers.allow, 'CUSTOM')
  t.assert.deepStrictEqual(res.json(), { custom: true })

  const routes = fastify.printRoutes()
  t.assert.strictEqual(routes.match(/OPTIONS/g).length, 1)
})

test('user defined OPTIONS route as part of a methods array takes precedence', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => 'ok')
  fastify.route({
    method: ['OPTIONS', 'PATCH'],
    url: '/foo',
    handler: async (request, reply) => {
      reply.header('allow', 'CUSTOM')
      return { custom: true }
    }
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.headers.allow, 'CUSTOM')
})

test('works with routes registered with a prefix', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.register(async function (instance) {
    instance.get('/foo', async () => 'ok')
    instance.post('/bar', async () => 'ok')
  }, { prefix: '/api' })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/api/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')

  const barRes = await fastify.inject({ method: 'OPTIONS', url: '/api/bar' })
  t.assert.strictEqual(barRes.statusCode, 204)
  t.assert.strictEqual(barRes.headers.allow, 'OPTIONS, POST')

  const notFoundRes = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(notFoundRes.statusCode, 404)
})

test('works with ignoreTrailingSlash', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true, ignoreTrailingSlash: true })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => 'ok')

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo/' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')
})

test('works with ignoreDuplicateSlashes', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true, ignoreDuplicateSlashes: true })
  t.after(() => fastify.close())

  fastify.get('/foo/bar', async () => 'ok')

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo//bar' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')
})

test('works with route constraints', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.get('/foo', { constraints: { version: '1.0.0' } }, async () => 'v1')
  fastify.post('/foo', { constraints: { version: '2.0.0' } }, async () => 'v2')

  const v1Res = await fastify.inject({
    method: 'OPTIONS',
    url: '/foo',
    headers: { 'accept-version': '1.x' }
  })
  t.assert.strictEqual(v1Res.statusCode, 204)
  t.assert.strictEqual(v1Res.headers.allow, 'GET, HEAD, OPTIONS')

  const v2Res = await fastify.inject({
    method: 'OPTIONS',
    url: '/foo',
    headers: { 'accept-version': '2.x' }
  })
  t.assert.strictEqual(v2Res.statusCode, 204)
  t.assert.strictEqual(v2Res.headers.allow, 'OPTIONS, POST')

  const noVersionRes = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(noVersionRes.statusCode, 404)
})

test('user defined constrained OPTIONS route takes precedence', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.get('/foo', { constraints: { version: '1.0.0' } }, async () => 'v1')
  fastify.options('/foo', { constraints: { version: '1.0.0' } }, async (request, reply) => {
    reply.header('allow', 'CUSTOM')
    return { custom: true }
  })

  const res = await fastify.inject({
    method: 'OPTIONS',
    url: '/foo',
    headers: { 'accept-version': '1.x' }
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.headers.allow, 'CUSTOM')
})

test('runs the onRequest hooks registered in the same encapsulation context', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  let rootHookCalled = false
  let pluginHookCalled = false

  fastify.addHook('onRequest', async () => {
    rootHookCalled = true
  })

  fastify.register(async function (instance) {
    instance.addHook('onRequest', async () => {
      pluginHookCalled = true
    })
    instance.get('/foo', async () => 'ok')
  }, { prefix: '/api' })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/api/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(rootHookCalled, true)
  t.assert.strictEqual(pluginHookCalled, true)
})

test('does not run hooks of other encapsulation contexts', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  let siblingHookCalled = false

  fastify.register(async function (instance) {
    instance.addHook('onRequest', async () => {
      siblingHookCalled = true
    })
    instance.get('/bar', async () => 'ok')
  })

  fastify.register(async function (instance) {
    instance.get('/foo', async () => 'ok')
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(siblingHookCalled, false)
})

test('printRoutes shows the exposed OPTIONS routes', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => 'ok')

  await fastify.ready()
  const routes = fastify.printRoutes()
  t.assert.ok(routes.includes('foo (GET, HEAD, OPTIONS)'))
})

test('does not override a custom OPTIONS handler on a different path', async (t) => {
  const fastify = Fastify({ exposeOptionsRoutes: true })
  t.after(() => fastify.close())

  fastify.get('/foo', async () => 'ok')
  fastify.options('/bar', async () => ({ custom: true }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/bar' })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual(res.json(), { custom: true })
})

test('throws when exposeOptionsRoutes is not a boolean', (t) => {
  t.assert.throws(
    () => Fastify({ exposeOptionsRoutes: 'yes' }),
    /FST_ERR_INIT_OPTS_INVALID/
  )
})
