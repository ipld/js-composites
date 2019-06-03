const CID = require('cids')
const Node = require('./base')

class MapKind extends Node {
  get (args) {
    if (!args.path) throw new Error('Missing required argument "path"')
    let path = args.path.split('/').filter(x => x)
    let value = this.node
    while (path.length) {
      let attr = path.shift()
      if (typeof value[attr] === 'undefined') throw new Error(`Not Found. Node has no attribute "${attr}"`)
      value = value[attr]
      if (CID.isCID(value) && path.length) {
        return { call: { info: { method: 'get', args: { path: path.join('/') } }, target: value, proxy: true } }
      }
    }
    return { result: value }
  }
}

exports.MapKind = MapKind

class LinkKind extends Node {
  resolve (args) {
    return { result: this.node }
  }
}

exports.LinkKind = LinkKind

class StringKind extends Node {
  toString (args) {
    return this.node
  }
}

exports.StringKind = StringKind

class BytesKind extends Node {
  read (args) {
    let start = args.start || 0
    let end = args.end || this.node.length
    if (start === 0 && end === this.node.length) return { result: this.node }
    else return { result: this.node.slice(start, end) }
  }
}

exports.BytesKind = BytesKind

class IntKind extends Node {
  toInt (args) {
    return this.node
  }
}

exports.IntKind = IntKind
