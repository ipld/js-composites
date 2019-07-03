const Node = require('../base')
const iavector = require('iavector')
const Block = require('@ipld/block')

const _type = 'IPLD/Experimental/Vector/0'

class Vector extends Node {
  get _type () {
    return _type
  }

  get (args) {
    let path = args.path.split('/').filter(Boolean)
    let index = parseInt(path.shift(), 10)

    if (!Number.isInteger(index)) {
      throw new Error('Vector type can only look up integers ' + index + ', ' + args)
    }

    let traversal = iavector.traverseGetOne(this.data, index)

    if (!traversal) {
      throw new Error(`Vector does not contain index`)
    }

    if (traversal.value) {
      if (!path.length) {
        return { result: traversal.value }
      }
      // user wants to go deeper into returned object
      let info = { method: 'get', args: { path: path.join('/') } }
      let call = { info, target: traversal.value, proxy: true }
      return { call }
    }

    path = `${traversal.nextIndex}/${path.join('/')}`
    return { call: { target: traversal.nextId, info: { method: 'get', args: { path } }, proxy: true } }
  }
}

Vector._type = _type

async function * runConstruction (construction, codec) {
  while (true) {
    let c = 0
    for (let node of construction.construct()) {
      c++
      let serializable = node.toSerializable()
      serializable._type = Vector._type
      let block = Block.encoder(serializable, codec)
      yield block
      node.id = await block.cid()
      construction.saved(node)
    }
    if (c === 0) {
      break
    }
  }
}

Vector.create = async function * create (from, width = 256, codec = 'dag-json') {
  let construction = iavector.constructFrom(from, width)
  yield * runConstruction(construction, codec)
}

/* WIP: Experimenting with mutation interface

Vector.append = async function * append (block, value, codec = 'dag-json') {
  let construction = iavector.constructAppend(block, value)
  yield * runConstruction(construction, codec)
}
*/

module.exports = Vector
