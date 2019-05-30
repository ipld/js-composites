const iamap = require('iamap')
const murmurhash3 = require('murmurhash3js-revisited')
const Type = require('../base')
const Block = require('@ipld/block')

const _type = 'IPLD/Experimental/HashMap/0'

// IAMap is agnostic to link type, teach it how to compare them
function cidEquals (cid1, cid2) {
  return cid1.equals(cid2)
}

class HashMap extends Type {
  get _type () {
    return _type
  }

  get kind () {
    return 'map'
  }

  async get (args, continuation) {
    let path = args.path.split('/').filter(Boolean)
    let key = path.shift()
    let traversal

    if (!key) {
      throw new Error('HashMap type needs a string to look up')
    }

    if (!continuation) { // initial call, set up a traversal
      // check block format (this will be a job for schemas eventually)
      if (!iamap.isRootSerializable(this.data) || !iamap.isSerializable(this.data)) {
        throw new Error('Block does not contain expected HashMap root data')
      }
      traversal = iamap.traverseGet(this.data, key, cidEquals)
      continuation = { traversal }
    } else { // subsequent call, feed the next block to the traversal
      let childBlock = continuation.response.data
      // check block format (this will be a job for schemas eventually)
      if (!iamap.isSerializable(childBlock)) {
        throw new Error('Block does not contain expected HashMap child node data')
      }
      traversal = continuation.traversal
      traversal.next(childBlock)
    }

    let info, call
    let nextId = traversal.traverse() // process current block traversal

    if (!nextId) { // end of traversal, value is either found or missing from this map
      if (!traversal.value()) {
        throw new Error(`No such element in map: ${key}`)
      }
      if (!path.length) {
        return { result: traversal.value() }
      }
      // user wants to go deeper into returned object
      info = { method: 'get', args: { path: path.join('/') } }
      call = { info, target: traversal.value(), proxy: true }
    } else { // we need to go deeper into the map
      info = { continuation, method: 'get', args: { path: '/' } }
      call = { info, target: nextId }
    }

    return { call }
  }
}

HashMap._type = _type

// ---------------------------------- write ---------------------------------- //

// register an x64 128-bit murmurhash as available for use and make it the default (in create() below)
// the proposal for now is to make murmur3 x64 128 and sha2 256 available by default
function murmurHasher (key) {
  let hash = murmurhash3.x64.hash128(key)
  let b = Buffer.from(hash, 'hex')
  return b
}
iamap.registerHasher('murmur3-128', 128, murmurHasher)

// wrap our native storage into a storage system that IAMap can work with - it's agnostic to serialization
// format and ids
function storageWrapper (store, codec) {
  async function save (obj) {
    if (iamap.isRootSerializable(obj)) {
      // root block, amend the _type label before saving
      obj._type = HashMap._type
    }
    let block = Block.encoder(obj, codec)
    let cid = await block.cid()
    await store.set(cid, block)
    return cid
  }

  async function load (cid) {
    let block = await store.get(cid)
    if (!block) {
      throw new Error(`Not found in storage (${cid})`)
    }
    return block.decode()
  }

  return { load, save, isEqual: cidEquals }
}

HashMap.create = async function (storage, codec, options) {
  if (!options) {
    options = {}
  }
  if (!options.hashAlg) {
    options.hashAlg = 'murmur3-128'
  }
  return iamap.create(storageWrapper(storage, codec), options)
}

module.exports = HashMap
