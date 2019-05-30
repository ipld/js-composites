const Type = require('./base')
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
  if (!Type.isType(target)) {
    let value = target
    target = opts.lookup.fromKind(target)
    yield { trace: 'type', node: value, result: target, leaf: !info, _leaf:info }
  }

  if (!info) info = {}

  /* recursive link unfold */
  if (info.method !== 'resolve' && target.resolve) {
    let last
    for await (let trace of system(opts, target, { method: 'resolve' })) {
      last = trace
      yield trace
    }
    target = last.result.result
  }

  /* type method calls */
  if (info.method) {
    if (!target[info.method]) {
      throw new Error(`Type does not implement "${info.method}"`)
    }
    let response = await target[info.method](info.args, info.continuation)
    if (!response) throw new Error('Type did not return response')
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
        for await (let trace of system(opts, new MapKind(origin.node), _getcall)) {
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
    if (line.trace === 'type' && line.leaf && Buffer.isBuffer(line.node)) yield line.node
  }
}

exports.Type = Type
exports.Lookup = Lookup
exports.system = system
exports.read = read
