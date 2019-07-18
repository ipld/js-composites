/* eslint-env mocha */

const Block = require('@ipld/block')
const assert = require('assert')
const Vector = require('../src/lists/vector')
const { Lookup, get } = require('../')
const getPath = get

function storage () {
  let kv = new Map()
  return {
    async put (block) {
      return kv.set((await block.cid()).toString(), block)
    },
    get (cid) {
      return kv.get(cid.toString())
    },
    lookup // so we can pass to get()
  }
}

const lookup = new Lookup()
lookup.register(Vector._type, Vector)

describe('Vector', () => {
  const fixture = Array.from({ length: 301 }).map((v, i) => { return { leafValue: `v${i}` } })
  const blocks = fixture.map(b => Block.encoder(b, 'dag-cbor'))
  let cids

  before(async () => {
    cids = await Promise.all(blocks.map(b => b.cid()))
  })

  it('create with CID values', async () => {
    const iter = Vector.create(cids, 3)
    let valueCount = 0
    for await (let block of iter) {
      const decoded = block.decode()
      assert.ok(decoded.data.length <= 3)
      if (decoded.height === 0) {
        valueCount += decoded.data.length
      }
    }
    assert.strictEqual(valueCount, 301)
  })

  it('create with inline values', async () => {
    const iter = Vector.create(fixture, 32)
    let valueCount = 0
    for await (let block of iter) {
      const decoded = block.decode()
      assert.ok(decoded.data.length <= 32)
      if (decoded.height === 0) {
        valueCount += decoded.data.length
      }
    }
    assert.strictEqual(valueCount, 301)
  })

  it('gets with CID values', async () => {
    const store = storage()
    await Promise.all(blocks.map(b => store.put(b)))
    let root
    for await (let block of Vector.create(cids, 3)) {
      root = block
      await store.put(block)
    }
    let result = await getPath(store, root, '0/leafValue')
    assert.strictEqual(result.data, 'v0')

    result = await getPath(store, root, '101/leafValue')
    assert.strictEqual(result.data, 'v101')

    result = await getPath(store, root, '300/leafValue')
    assert.strictEqual(result.data, 'v300')

    result = await getPath(store, root, '33')
    assert.deepStrictEqual(result.data, { leafValue: 'v33' })
  })

  it('gets with inline values', async () => {
    const store = storage()
    let root
    for await (let block of Vector.create(fixture, 32)) {
      root = block
      await store.put(block)
    }

    let result = await getPath(store, root, '0/leafValue')
    const buffer = result.data
    assert.strictEqual(buffer.toString(), 'v0')

    result = await getPath(store, root, '101/leafValue')
    assert.strictEqual(result.data, 'v101')

    result = await getPath(store, root, '300/leafValue')
    assert.strictEqual(result.data, 'v300')
  })
})
