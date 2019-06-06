/* globals it */
const { assert } = require('referee')
const FixedChunker = require('../src/bytes/fixed-chunker')
const { Lookup, read } = require('../')

const test = it

const storage = () => {
  let kv = {}
  let get = cid => {
    let _cid = cid.toBaseEncodedString()
    if (!kv[_cid]) throw new Error('Not found.')
    return kv[_cid]
  }
  let put = async block => {
    let cid = await block.cid()
    let _cid = cid.toBaseEncodedString()
    kv[_cid] = block
  }
  return { put, get }
}

const asyncList = async iter => {
  let parts = []
  for await (let part of iter) {
    parts.push(part)
  }
  return parts
}

const lookup = new Lookup()
lookup.register(FixedChunker._type, FixedChunker)

test('basic create', async () => {
  let iter = FixedChunker.create(Buffer.from('0123456789'), 3)
  let parts = await asyncList(iter)
  assert.same(parts.length, 5)
  assert.same(parts[0].codec, 'raw')
  assert.same(parts[4].codec, 'dag-json')
  assert.same(parts[0].decode().toString(), '012')
  assert.same(parts[1].decode().toString(), '345')
  assert.same(parts[2].decode().toString(), '678')
  assert.same(parts[3].decode().toString(), '9')
  let root = parts[4].decode()
  assert.same(root.chunkSize, 3)
  assert.same(root.length, 10)
  assert.same(root.data.length, 4)
  assert.same(root._type, FixedChunker._type)
})

test('basic read', async () => {
  let { get, put } = storage()
  let iter = FixedChunker.create(Buffer.from('0123456789'), 3)
  let root
  for await (let block of iter) {
    await put(block)
    root = block
  }
  let reader = read({ get, lookup }, root)
  let parts = await asyncList(reader)
  assert.same(parts.length, 4)
  assert.same(parts[0].toString(), '012')
  assert.same(parts[1].toString(), '345')
  assert.same(parts[2].toString(), '678')
  assert.same(parts[3].toString(), '9')
})
