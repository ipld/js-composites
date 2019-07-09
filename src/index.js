const Node = require('./base')
const Lookup = require('./lookup')
const CID = require('cids')
const Block = require('@ipld/block')
const { MapKind } = require('./kinds')

const defaultCodec = 'dag-json'

const system = async function * (opts, target, info) {
  if (!opts._seen) opts._seen = new Map()
  if (!opts.makeDuplicateLimit) opts.makeDuplicateLimit = 5
  /* target resolution */
  let block
  if (CID.isCID(target)) {
    block = await opts.get(target)
    yield { trace: 'getBlock', cid: target, block, leaf: !info }
    target = block
  }
  if (Block.isBlock(target)) {
    block = target
    target = target.decode()
    yield { trace: 'decode', block, result: target, leaf: !info }
  }
  if (!Node.isNode(target)) {
    let value = target
    target = opts.lookup.from(target)
    yield { trace: 'type', data: value, result: target, leaf: !info }
  }

  if (!info) info = {}

  /* recursive link unfold */
  if (info.method !== 'resolve' && target.resolve) {
    let last
    for await (let trace of system(opts, target, { method: 'resolve' })) {
      last = trace
      yield trace
    }
    target = last.result
  }

  /* type method calls */
  if (info.method) {
    if (!target[info.method]) {
      throw new Error(`Node does not implement "${info.method}"`)
    }
    let response = await target[info.method](info.args, info.continuation)
    if (!response) throw new Error('Node did not return response')
    yield { response, target, call: info, result: response.result }

    if (response.make) {
      let _make = response.make
      let block
      if (_make.raw) block = Block.encoder(_make.raw, 'raw')
      else if (_make.source) {
        block = Block.encoder(_make.source, opts.codec || defaultCodec)
      } else {
        throw new Error('Make must provide source or raw')
      }
      // TODO: envelopes for encryption
      yield { trace: 'make', block, origin: _make }
      if (opts.put) await opts.put(block)
      let cid = await block.cid()
      let _cid = cid.toString()
      if (opts._seen.has(_cid)) opts._seen.set(_cid, opts._seen.get(_cid) + 1)
      else opts._seen.set(_cid, 0)
      if (opts._seen.get(_cid) > opts.makeDuplicateLimit) throw new Error('Exceeded duplicate block creation limit')
      info.continuation = response.continuation || {}
      info.continuation.cid = cid
      yield * system(opts, target, info)
      if (_make.proxy) {
        response.result = { cid }
      }
    }

    /* type method calls from types */
    let calls
    if (response.call) calls = [ response.call ]
    else if (response.calls) calls = response.calls
    else calls = []

    for (let call of calls) {
      let origin = target

      /* resolve local path lookup for target */
      if (call.path) {
        let last
        let _getcall = { method: 'get', args: { path: call.path }, local: true }
        for await (let trace of system(opts, new MapKind(origin.data), _getcall)) {
          last = trace
          yield trace
        }
        call.target = last.result
      }

      if (!call.target) throw new Error('Could not resolve a target.')
      if (!call.info) throw new Error('Cannot perform call without info')

      if (call.proxy) {
        yield * system(opts, call.target, call.info)
      } else {
        info.continuation = call.info.continuation || {}
        delete call.info.continuation
        call.info.local = true
        let last
        for await (let trace of system(opts, call.target, call.info)) {
          last = trace
          yield trace
        }
        info.continuation.response = last
        yield * system(opts, origin, info)
      }
    }

    /* run results through resolution and link unfolding */
    if (response.result) {
      /* local calls from other types are not leaf nodes, so empty {} */
      yield * system(opts, response.result, info.local ? {} : undefined)
    }
  }
}

// Note: this is named "read" because it's a high level
// filtered version of the "read" operation. this, along
// with similar functions should maybe go in an "ops" file.
const read = async function * (opts, target, start, end) {
  let info = { method: 'read', args: { start, end } }
  for await (let line of system(opts, target, info)) {
    if (opts.onTrace) opts.onTrace(line)
    if (line.trace === 'type' && line.leaf && Buffer.isBuffer(line.data)) yield line.data
  }
}

const _last = async (opts, target, info) => {
  let last
  for await (let line of system(opts, target, info)) {
    if (opts.onTrace) opts.onTrace(line)
    last = line
  }
  return last
}

const get = async (opts, target, path) => {
  let info = { method: 'get', args: { path } }
  let last = await _last(opts, target, info)
  return last.result
}

const length = async (opts, target) => {
  let info = { method: 'length', args: {} }
  let last = await _last(opts, target, info)
  return last.result.data
}

const keys = async function * (opts, target) {
  let info = { method: 'keys', args: { } }
  for await (let line of system(opts, target, info)) {
    if (line.result && line.leaf) {
      for (let key of line.result.data) {
        yield key
      }
    }
  }
}

const create = async (opts, target, args = {}) => {
  let info = { method: 'create', args }
  if (typeof target === 'string') {
    target = opts.lookup.fromNode({ _type: target })
  }
  let block
  for await (let line of system(opts, target, info)) {
    if (line.trace === 'make') {
      block = line.block
    }
  }
  return block
}

exports.Node = Node
exports.Lookup = Lookup
exports.system = system
exports.read = read
exports.get = get
exports.keys = keys
exports.length = length
exports.create = create
