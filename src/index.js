const Type = require('./base')
const Lookup = require('./lookup')
const CID = require('cids')
const Block = require('@ipld/block')

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
    yield { trace: 'type', node: value, result: target, leaf: !info }
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
    let response = await target[info.method](info.args)
    yield { response, target, call: info, result: response.result }
    if (response.call) {
      if (response.proxy) {
        yield * system(opts, response.target, response.call)
      } else {
        info.continuation = response.continuation || {}
        let last
        for await (let trace of system(opts, response.target, response.call)) {
          last = trace
          yield trace
        }
        info.continuation.response = last
        yield * system(opts, target, info)
      }
    } 
    if (response.result) {
      yield * system(opts, response.result)
    }
  }
}

const byteRead = async function * (opts, target, start, end) {
  let info = { method: 'read', args: { start, end } }
  for await (let line of system(opts, target, info)) {
    if (line.trace === 'type' && line.leaf && Buffer.isBuffer(line.node)) yield line.node
  }
}

exports.Type = Type
exports.Lookup = Lookup
exports.system = system
exports.byteRead = byteRead
