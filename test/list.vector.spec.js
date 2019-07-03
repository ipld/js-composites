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

async function asyncList (iter) {
  let parts = []
  for await (let part of iter) {
    parts.push(part)
  }
  return parts
}

const lookup = new Lookup()
lookup.register(Vector._type, Vector)

describe('Vector', () => {
  let fixture = Array.from({ length: 301 }).map((v, i) => { return { leafValue: `v${i}` } })
  let blocks = fixture.map(b => Block.encoder(b, 'dag-cbor'))
  let cids

  before(async () => {
    cids = await Promise.all(blocks.map(b => b.cid()))
  })

  it('create with CID values', async () => {
    let iter = Vector.create(cids, 3)
    let trace = await asyncList(iter)
    let valueCount = 0
    for (let block of trace) {
      let d = block.decode()
      assert.ok(d.data.length <= 3)
      if (d.height === 0) {
        valueCount += d.data.length
      }
    }
    assert.strictEqual(valueCount, 301)
  })

  it('create with inline values', async () => {
    let iter = Vector.create(fixture, 32)
    let trace = await asyncList(iter)
    let valueCount = 0
    for (let block of trace) {
      let d = block.decode()
      assert.ok(d.data.length <= 32)
      if (d.height === 0) {
        valueCount += d.data.length
      }
    }
    assert.strictEqual(valueCount, 301)
  })

  it('gets with CID values', async () => {
    let store = storage()
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
    let store = storage()
    let root
    for await (let block of Vector.create(fixture, 32)) {
      root = block
      await store.put(block)
    }

    let result = await getPath(store, root, '0/leafValue')
    let buffer = result.data
    assert.strictEqual(buffer.toString(), 'v0')

    result = await getPath(store, root, '101/leafValue')
    assert.strictEqual(result.data, 'v101')

    result = await getPath(store, root, '300/leafValue')
    assert.strictEqual(result.data, 'v300')
  })
})
