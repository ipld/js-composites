const Node = require('./base')
const Lookup = require('./lookup')
const CID = require('cids')
const Block = require('@ipld/block')
const { MapKind } = require('./kinds')

const system = async function * (opts, target, info) {
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

    /* type method calls from types */
    let calls
    if (response.call) calls = [ response.call ]
    else if (response.calls) calls = response.calls
    else calls = []

    for (let call of calls) {
      let origin = target

      /* resolve local path lookup for target */
      if (typeof call.target === 'string') {
        let last
        let _getcall = { method: 'get', args: { path: call.target }, local: true }
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

const get = async (opts, target, path) => {
  let info = { method: 'get', args: { path } }
  let last
  for await (let line of system(opts, target, info)) {
    if (opts.onTrace) opts.onTrace(line)
    last = line
  }
  return last.result
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

exports.Node = Node
exports.Lookup = Lookup
exports.system = system
exports.read = read
exports.get = get
exports.keys = keys
