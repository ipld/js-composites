/* globals it */
const assert = require('assert')
const tsame = require('tsame')
const FixedChunker = require('../src/bytes/fixed-chunker')
const { Lookup, read, length } = require('../')

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
  same(parts.length, 5)
  same(parts[0].codec, 'raw')
  same(parts[4].codec, 'dag-json')
  same(parts[0].decode().toString(), '012')
  same(parts[1].decode().toString(), '345')
  same(parts[2].decode().toString(), '678')
  same(parts[3].decode().toString(), '9')
  let root = parts[4].decode()
  same(root.chunkSize, 3)
  same(root.length, 10)
  same(root.data.length, 4)
  same(root._type, FixedChunker._type)
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
  same(parts.length, 4)
  same(parts[0].toString(), '012')
  same(parts[1].toString(), '345')
  same(parts[2].toString(), '678')
  same(parts[3].toString(), '9')
})

test('basic read', async () => {
  let { get, put } = storage()
  let iter = FixedChunker.create(Buffer.from('0123456789'), 3)
  let root
  for await (let block of iter) {
    await put(block)
    root = block
  }
  let _length = await length({ get, lookup }, root)
  same(_length, 10)
})
