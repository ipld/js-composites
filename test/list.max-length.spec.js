const Block = require('@ipld/block')
const assert = require('assert')
const tsame = require('tsame')
const MaxLengthList = require('../src/lists/max-length')
const { system, Lookup } = require('../')

const same = (...args) => assert.ok(tsame(...args))
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

const getResult = async iter => {
  let last
  for await (let part of iter) {
    last = part
  }
  return last.result
}

const asyncList = async iter => {
  let parts = []
  for await (let part of iter) {
    parts.push(part)
  }
  return parts
}

const lookup = new Lookup()
lookup.register(MaxLengthList._type,  MaxLengthList)

let value = Buffer.from('hello world')
let fixture = Array.from({length: 107}).map((v, k) => Buffer.from('hello world: '+ k))

test('basic create', async () => {
  let blocks = fixture.map(b => Block.encoder(b, 'raw'))
  let cids = await Promise.all(blocks.map(b => b.cid()))
  let iter = MaxLengthList.create(cids, 3)
  let trace = await asyncList(iter)
  for (let block of trace) {
    assert.ok(block.decode().data.length < 4)
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
  let iter = system({get, lookup}, root, {method: 'get', args: { path: '0' }})
  let result = await getResult(iter)
  let buffer = result.node
  same(buffer.toString(), 'hello world: 0')

  iter = system({get, lookup}, root, {method: 'get', args: { path: '106' }})
  result = await getResult(iter)
  buffer = result.node
  same(buffer.toString(), 'hello world: 106')
})
