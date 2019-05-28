const Block = require('@ipld/block')
const assert = require('assert')
const tsame = require('tsame')
const { system, Lookup, read } = require('../')

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
  return {put, get}
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

const _getCall = path => ({ method: 'get', args: { path } })

test('single block traversal', async () => {
  let block = Block.encoder({hello: 'world'}, 'dag-json')
  let result = await getResult(system({lookup}, block, _getCall('hello')))
  let str = result.toString()
  same(str, 'world')
  
  block = Block.encoder({one: {two: 'world'}}, 'dag-json')
  result = await getResult(system({lookup}, block, _getCall('one/two')))
  str = result.toString()
  same(str, 'world')
})

test('multi-block traversal', async () => {
  let leaf = Block.encoder({hello: 'world'}, 'dag-json')
  let child = Block.encoder({two: await leaf.cid()}, 'dag-json')
  let root = Block.encoder({one: await child.cid()}, 'dag-json')
  let { get, put } = storage()
  await Promise.all([leaf, child, root].map(block => put(block)))
  let iter = system({lookup, get}, root, _getCall('one/two/hello'))
  let result = await getResult(iter)
  let str = result.toString()
  same(str, 'world')
})
  
test('single block bytes read', async () => {
  let block = Block.encoder({hello: Buffer.from('world')}, 'dag-json')
  let result = await getResult(system({lookup}, block, _getCall('hello')))
  same(result.kind, 'bytes')
  let trace = await asyncList(read({lookup}, result))
  same(trace.length, 1)
  same(trace[0].toString(), 'world')
})
