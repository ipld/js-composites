const Node = require('../base')
const Block = require('@ipld/block')

const mkcall = (target, path) => {
  return { info: { method: 'get', args: { path } }, target, proxy: true }
}

const _type = 'IPLD/Experimental/PathLink/0'

class PathLink extends Node {
  get _type () {
    return _type
  }
  resolve (args) {
    return { call: mkcall(this.data.cid, this.data.path) }
  }
  create (args) {
    let cid = args.cid
    let path = args.path
    return { make: { source: { _type, cid, path }, proxy: true } }
  }
}
PathLink.create = (cid, path, codec = 'dag-json') => {
  return Block.encoder({ _type, cid, path }, codec)
}
PathLink._type = _type

module.exports = PathLink
