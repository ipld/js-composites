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
    if (!args.path) throw new Error('Missing required argument "path"')
    let path = args.path.split('/').filter(x => x)
    let value = this.node
    while (path.length) {
      let attr = path.shift()
      if (typeof value[attr] === 'undefined') throw new Error(`Not Found. Node has no attribute "${attr}"`)
      value = value[attr]
      if (CID.isCID(value)) {
        return { call: { method: 'get', args: { path: path.join('/') } }, target: value, proxy: true }
      }
    }
    return { result: value }
  }
}

class LinkKind extends Type {
  resolve (args) {
    return { result: this.node }
  }
}
class StringKind extends Type {
  toString (args) {
    return this.node
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
    if (typeof source === 'string') return new StringKind(source)
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
