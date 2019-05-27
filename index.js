const withIs = require('class-is')
const CID = require('cids')
const Block = require('@ipld/block')

class BaseType {
  constructor (node, opts) {
    this.node = node
    this.opts = opts
  }
}

const Type = withIs(BaseType, {
  className: 'Type',
  symbolName: '@ipld/types/Type'
})

class MapKind extends Type {
  get (args) {
    if (!args.attr) throw new Error('Missing required argument "attr"')
    let attr = args.attr
    if (!this.value[attr]) throw new Error(`Not Found. Node has no attribute "${attr}"`)
    return { result: this.value[attr] }
  }
}

class LinkKind extends Type {
  resolve (args) {
    return { result: this.node }
  }
}

class Lookup {
  constructor (opts) {
    this.opts = opts
  }
  fromNode (node) {
  }
  fromKind (source) {
    if (source._type) return this.fromNode(source)
    if (CID.isCID(source)) return new LinkKind(source)
    if (source && typeof source === 'object') return new MapKind(source)
    throw new Error('NOT IMPLEMENTED!')
  }
}

const system = async function * (opts, target, info = {}) {
  let block
  if (CID.isCID(target)) {
    block = await opts.get(target)
    yield { trace: 'getBlock', cid: target, block }
    target = block
  }
  if (Block.isBlock(target)) {
    block = target
    target = target.decode()
    yield { trace: 'decode', block, result: target }
  }
  if (!Type.isType(target)) {
    let value = target
    target = opts.lookup.fromKind(target)
    yield { trace: 'type', node: value, result: target }
  }
  if (info.method !== 'resolve' && target.resolve) {
    let last
    for await (let trace of system(opts, target, { method: 'resolve' })) {
      last = trace
      yield trace
    }
    target = last.result.result
  }

  if (info.method) {
    if (!target[info.method]) {
      throw new Error(`Type does not implement "${info.method}"`)
    }
    let response = await target[info.method](info.args)
    yield { response, target, call: info, result: response.result }
    if (response.call) {
      info.continuation = response.continuation || {}
      let last
      for await (let trace of system(opts, response.result, response.call)) {
        last = trace
        yield trace
      }
      info.continuation.response = last
      yield * system(opts, target, info)
    } else if (response.result) {
      yield * system(opts, response.result)
    }
  }
}

const path = async (path, root, opts) => {
  path = path.split('/').filter(x => x)
  let result = root
  while (path.length) {
    let attr = path.shift()
    let last
    for await (let trace of system(opts, result, { method: 'get', attr })) {
      last = trace
    }
    result = last.result
  }
  return result
}

exports.Type = Type
exports.Lookup = Lookup
exports.path = path
exports.system = system
