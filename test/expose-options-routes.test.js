'use strict'

const { test } = require('node:test')
const Fastify = require('..')

test('exposeOptionsRoutes is disabled by default and OPTIONS requests 404', async t => {
  t.plan(2)

  const fastify = Fastify()

  fastify.get('/foo', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 404)
  t.assert.strictEqual(res.headers.allow, undefined)
})

test('exposeOptionsRoutes false does not expose OPTIONS routes', async t => {
  t.plan(1)

  const fastify = Fastify({ exposeOptionsRoutes: false })

  fastify.get('/foo', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 404)
})

test('exposes an OPTIONS route returning 204 with an empty body', async t => {
  t.plan(3)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.get('/foo', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.body, '')
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')
})

test('Allow header lists all methods, uppercase, alphabetically sorted, joined with ", "', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.post('/foo', (req, reply) => reply.send({ ok: true }))
  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))
  fastify.delete('/foo', (req, reply) => reply.send({ ok: true }))
  fastify.patch('/foo', (req, reply) => reply.send({ ok: true }))
  fastify.put('/foo', (req, reply) => reply.send({ ok: true }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT')
})

test('Allow header includes HEAD only when the HEAD route exists', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true, exposeHeadRoutes: false })

  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, OPTIONS')
})

test('Allow header includes HEAD when a custom HEAD route is registered', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true, exposeHeadRoutes: false })

  fastify.head('/foo', (req, reply) => reply.send())
  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')
})

test('supports routes registered with an array of methods', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.route({
    method: ['GET', 'POST'],
    url: '/foo',
    handler: (req, reply) => reply.send({ ok: true })
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS, POST')
})

test('does not override a user OPTIONS route registered before', async t => {
  t.plan(3)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.options('/foo', (req, reply) => {
    reply.code(200).send('custom options')
  })
  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.body, 'custom options')
  t.assert.strictEqual(res.headers.allow, undefined)
})

test('does not override a user OPTIONS route registered after', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))
  fastify.options('/foo', (req, reply) => {
    reply.code(200).send('custom options')
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.body, 'custom options')
})

test('user OPTIONS route registered as part of a methods array takes precedence', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))
  fastify.route({
    method: ['POST', 'OPTIONS'],
    url: '/foo',
    handler: (req, reply) => {
      if (req.method === 'OPTIONS') {
        reply.code(200).send('custom options')
        return
      }
      reply.send({ ok: true })
    }
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.body, 'custom options')
})

test('registering the same user OPTIONS route twice still throws', async t => {
  t.plan(1)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.options('/foo', (req, reply) => reply.send('one'))

  await t.assert.rejects(async () => {
    fastify.options('/foo', (req, reply) => reply.send('two'))
    await fastify.ready()
  }, /Method 'OPTIONS' already declared for route/)
})

test('works with encapsulated contexts and prefixes', async t => {
  t.plan(4)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.register((scope, opts, next) => {
    scope.get('/foo', (req, reply) => reply.send({ ok: true }))
    scope.post('/foo', (req, reply) => reply.send({ ok: true }))
    next()
  }, { prefix: '/prefix' })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/prefix/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS, POST')

  const prefixedOnly = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(prefixedOnly.statusCode, 404)

  const rootRes = await fastify.inject({ method: 'OPTIONS', url: '/prefix' })
  t.assert.strictEqual(rootRes.statusCode, 404)
})

test('generated OPTIONS routes run the scope onRequest hooks', async t => {
  t.plan(3)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  let hookCalls = 0

  fastify.register((scope, opts, next) => {
    scope.addHook('onRequest', (req, reply, done) => {
      hookCalls++
      done()
    })
    scope.get('/foo', (req, reply) => reply.send({ ok: true }))
    next()
  }, { prefix: '/prefix' })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/prefix/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(hookCalls, 1)

  await fastify.inject({ method: 'GET', url: '/prefix/foo' })
  t.assert.strictEqual(hookCalls, 2)
})

test('works with ignoreTrailingSlash', async t => {
  t.plan(4)

  const fastify = Fastify({ exposeOptionsRoutes: true, ignoreTrailingSlash: true })

  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')

  const resSlash = await fastify.inject({ method: 'OPTIONS', url: '/foo/' })
  t.assert.strictEqual(resSlash.statusCode, 204)
  t.assert.strictEqual(resSlash.headers.allow, 'GET, HEAD, OPTIONS')
})

test('works with ignoreDuplicateSlashes', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true, ignoreDuplicateSlashes: true })

  fastify.get('/foo/bar', (req, reply) => reply.send({ ok: true }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo//bar' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')
})

test('works with parametric routes', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.get('/user/:id', (req, reply) => reply.send({ ok: true }))
  fastify.put('/user/:id', (req, reply) => reply.send({ ok: true }))

  const res = await fastify.inject({ method: 'OPTIONS', url: '/user/42' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS, PUT')
})

test('works with constrained routes', async t => {
  t.plan(4)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.get('/foo', { constraints: { version: '1.0.0' } }, (req, reply) => reply.send('v1'))
  fastify.post('/foo', { constraints: { version: '2.0.0' } }, (req, reply) => reply.send('v2'))

  const resV1 = await fastify.inject({ method: 'OPTIONS', url: '/foo', headers: { 'accept-version': '1.x' } })
  t.assert.strictEqual(resV1.statusCode, 204)
  t.assert.strictEqual(resV1.headers.allow, 'GET, HEAD, OPTIONS')

  const resV2 = await fastify.inject({ method: 'OPTIONS', url: '/foo', headers: { 'accept-version': '2.x' } })
  t.assert.strictEqual(resV2.statusCode, 204)
  t.assert.strictEqual(resV2.headers.allow, 'OPTIONS, POST')
})

test('user constrained OPTIONS route takes precedence over the generated one', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.get('/foo', { constraints: { version: '1.0.0' } }, (req, reply) => reply.send('v1'))
  fastify.options('/foo', { constraints: { version: '1.0.0' } }, (req, reply) => {
    reply.code(200).send('custom options')
  })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/foo', headers: { 'accept-version': '1.x' } })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.body, 'custom options')
})

test('printRoutes shows the generated OPTIONS routes', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))

  const routes = fastify.printRoutes()
  t.assert.ok(routes.includes('(GET, HEAD, OPTIONS)'), `printRoutes output should include the OPTIONS route:\n${routes}`)

  const fastifyOff = Fastify()
  fastifyOff.get('/foo', (req, reply) => reply.send({ ok: true }))
  const routesOff = fastifyOff.printRoutes()
  t.assert.ok(!routesOff.includes('OPTIONS'), `printRoutes output should not include OPTIONS:\n${routesOff}`)
})

test('generated OPTIONS route is exposed on the root path with prefix', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.register((scope, opts, next) => {
    scope.get('/', (req, reply) => reply.send({ ok: true }))
    next()
  }, { prefix: '/prefix' })

  const res = await fastify.inject({ method: 'OPTIONS', url: '/prefix' })
  t.assert.strictEqual(res.statusCode, 204)
  t.assert.strictEqual(res.headers.allow, 'GET, HEAD, OPTIONS')
})

test('hasRoute detects the generated OPTIONS route', async t => {
  t.plan(2)

  const fastify = Fastify({ exposeOptionsRoutes: true })

  fastify.get('/foo', (req, reply) => reply.send({ ok: true }))

  t.assert.strictEqual(fastify.hasRoute({ method: 'OPTIONS', url: '/foo' }), true)
  t.assert.strictEqual(fastify.hasRoute({ method: 'OPTIONS', url: '/bar' }), false)
})
