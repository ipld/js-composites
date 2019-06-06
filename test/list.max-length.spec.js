/* globals it */
const Block = require('@ipld/block')
const { assert } = require('referee')
const MaxLengthList = require('../src/lists/max-length')
const { Lookup, get } = require('../')
const getPath = get

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
lookup.register(MaxLengthList._type, MaxLengthList)

let fixture = Array.from({ length: 107 }).map((v, k) => Buffer.from('hello world: ' + k))

test('basic create', async () => {
  let blocks = fixture.map(b => Block.encoder(b, 'raw'))
  let cids = await Promise.all(blocks.map(b => b.cid()))
  let iter = MaxLengthList.create(cids, 3)
  let trace = await asyncList(iter)
  for (let block of trace) {
    assert(block.decode().data.length < 4)
  }
})

test('basic gets', async () => {
  let { get, put } = storage()
  let blocks = fixture.map(b => Block.encoder(b, 'raw'))
  await Promise.all(blocks.map(b => put(b)))
  let cids = await Promise.all(blocks.map(b => b.cid()))
  let root
  for await (let block of MaxLengthList.create(cids, 3)) {
    root = block
    await put(block)
  }
  let result = await getPath({ get, lookup }, root, '0')
  let buffer = result.data
  assert.same(buffer.toString(), 'hello world: 0')

  result = await getPath({ get, lookup }, root, '106')
  buffer = result.data
  assert.same(buffer.toString(), 'hello world: 106')
})
