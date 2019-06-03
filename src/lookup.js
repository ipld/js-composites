const kinds = require('./kinds')
const CID = require('cids')

// Note: I don't like calling this lookup everywhere, should find better name
class Lookup {
  constructor (opts) {
    this.opts = opts
    this._types = {}
  }
  register (name, typeClass) {
    this._types[name] = typeClass
  }
  fromNode (data) {
    let _Class = this._types[data._type]
    if (!_Class) throw new Error(`No type registered named "${data._type}"`)
    return new _Class(data, this)
  }
  from (source) {
    if (source._type) return this.fromNode(source)
    if (CID.isCID(source)) return new kinds.LinkKind(source)
    if (Buffer.isBuffer(source)) return new kinds.BytesKind(source)
    if (source && typeof source === 'object') return new kinds.MapKind(source)
    if (typeof source === 'string') return new kinds.StringKind(source)
    if (typeof source === 'number' && Number.isInteger(source)) return new kinds.IntKind(source)
    throw new Error('NOT IMPLEMENTED!')
  }
}

module.exports = Lookup
