/* globals it */
const Block = require('@ipld/block')
const { assert } = require('referee')
const PathLink = require('../src/links/path')
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

const lookup = new Lookup()
lookup.register(PathLink)

test('basic resolve', async () => {
  let { get, put } = storage()
  let leaf = Block.encoder({ two: { three: 'hello world' } }, 'dag-json')
  await put(leaf)
  let link = PathLink.create(await leaf.cid(), 'two/three')
  await put(link)
  let root = Block.encoder({ one: await link.cid() }, 'dag-json')
  await put(root)
  let result = await getPath({ get, lookup }, root, 'one')
  assert.same(result.data, 'hello world')
})
