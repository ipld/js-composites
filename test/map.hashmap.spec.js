/* globals it */
const assert = require('assert')
const tsame = require('tsame')
const Block = require('@ipld/block')
const HashMap = require('../src/maps/hashmap')
const { Lookup, get } = require('../')

const same = (...args) => assert.ok(tsame(...args))
const test = it

const lookup = new Lookup()
lookup.register(HashMap._type, HashMap)

function storage () {
  let kv = new Map()
  return {
    set (cid, value) {
      return kv.set(cid.toString(), value)
    },
    get (cid) {
      return kv.get(cid.toString())
    },
    lookup // so we can pass to get()
  }
}

test('HashMap single-block set/get', async () => {
  let store = storage()

  // default IAMap options are a bitWidth of 5 and bucketSize of 8 giving 256 elements per block
  // with a good hash and a few items, we're unlikely to overflow beyond the root block
  let map = await HashMap.create(store, 'dag-json')
  map = await map.set('foo', 'bar')
  map = await map.set('bar', 100)

  let root = map.id

  same((await get(store, root, 'foo')).toString(), 'bar')
  same((await get(store, root, 'bar')).toInt(), 100)
})

test('HashMap external traversal', async () => {
  let store = storage()
  let child = Block.encoder({ deep: { inside: 'another block' } }, 'dag-json')
  let childCid = await child.cid()
  store.set(childCid, child)

  let map = await HashMap.create(store, 'dag-json')
  map = await map.set('foo', 'bar')
  map = await map.set('blip', childCid) // link to an external block
  map = await map.set('baz', { wut: { is: 'this' } }) // store a map inline

  let root = map.id

  same((await get(store, root, 'foo')).toString(), 'bar')
  same((await get(store, root, 'baz/wut/is')).toString(), 'this') // inline map-kind traversal
  same((await get(store, root, 'blip/deep/inside')).toString(), 'another block') // block traversal

  // link to the map from another block and traverse through it
  let parent = Block.encoder({ here: { is: root } }, 'dag-json')
  let parentCid = await parent.cid()
  store.set(parentCid, parent)

  // block -> map -> inline string kind value
  same((await get(store, parent, 'here/is/foo')).toString(), 'bar')
  // block -> map -> nested property in inline map kind value
  same((await get(store, parent, 'here/is/baz/wut/is')).toString(), 'this')
  // block -> map -> link kind value -> nested property in block
  same((await get(store, parent, 'here/is/blip/deep/inside')).toString(), 'another block')
})

test('HashMap multi-block set/get', async () => {
  let store = storage()

  // bitWidth of 4 gives us 16 buckets and bucketSize of 2 gives us 32 elements per block maximum
  // so with 100 entries we are going to overflow multiple times to multiple blocks
  let map = await HashMap.create(store, 'dag-json', { bitWidth: 4, bucketSize: 2 })
  for (let i = 0; i < 100; i++) {
    map = await map.set(`key${i}`, `value${i}`)
  }

  let root = map.id

  // our storage should have a multi-block HAMT with key0=value0 ... key99=value99
  for (let i = 0; i < 100; i++) {
    let result = await get(store, root, `key${i}`)
    same(result.toString(), `value${i}`)
  }
})
