const Type = require('../base')
const Block = require('@ipld/block')

const mkcall = (target, path) => {
  return { info: { method: 'get', args: { path } }, target, proxy: true }
}

const _type = 'IPLD/Experimental/PathLink'

class PathLink extends Type {
  get _type () {
    return _type
  }
  get kind () {
    return 'link'
  }
  resolve (args) {
    return { call: mkcall(this.node.cid, this.node.path) }
  }
}
PathLink.create = (cid, path, codec = 'dag-json') => {
  return Block.encoder({ _type, cid, path }, codec)
}
PathLink._type = _type

module.exports = PathLink
