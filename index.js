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
  get kind () {
    return 'link'
  }
  resolve (args) {
    return { result: this.node }
  }
}
class StringKind extends Type {
  get kind () {
    return 'string'
  }
  toString (args) {
    return this.node
  }
}
class BytesKind extends Type {
  get kind () {
    return 'bytes'
  }
  read (args) {
    let start = args.start || 0
    let end = args.end || this.node.length
    console.log(this.node, start, end)
    if (start === 0 && end === this.node.length) return { result: this.node }
    else return { result: this.node.slice(start, end) }
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
    if (Buffer.isBuffer(source)) return new BytesKind(source)
    if (source && typeof source === 'object') return new MapKind(source)
    if (typeof source === 'string') return new StringKind(source)
    throw new Error('NOT IMPLEMENTED!')
  }
}

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
