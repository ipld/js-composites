const Type = require('../base')
const Block = require('@ipld/block')

const _type = 'IPLD/Experimental/MaxLengthList'

class MaxLengthList extends Type {
  get _type () {
    return _type
  }
  get kind () {
    return 'list'
  }
  get (args) {
    let path = args.path.split('/').filter(x => x)
    let attr = parseInt(path.shift())
    if (isNaN(attr)) throw new Error('List type can only lookup integers')

    if (this.node.leaf) {
      return { result: this.node.data[attr] }
    }

    let i = 0
    let seen = 0
    while (i < this.node.length) {
      let m = this.node.lengthMap[i]
      if (attr < (seen + m)) {
        path = (attr - seen) + path.join('/')
        return { call: { target: 'data/' + i, info: { method: 'get', args: { path } }, proxy: true } }
      }
      i++
      seen += m
    }
  }
}
MaxLengthList._type = _type
MaxLengthList.create = async function * (values, maxLength, codec = 'dag-json') {
  values = values.slice()
  let len = values.length
  let size = Math.ceil(len / maxLength)
  let parts = []
  if (size > maxLength) {
    while (values.length) {
      let root
      for await (let block of MaxLengthList.create(values.splice(0, size), maxLength, codec)) {
        yield block
        root = block
      }
      parts.push(root)
    }
  } else {
    while (values.length) {
      let data = values.splice(0, size)
      let obj = { _type, data, length: data.length, leaf: true }
      let block = Block.encoder(obj, codec)
      yield block
      parts.push(block)
    }
  }
  let _len = b => (b.source() || b.decode()).length
  let lengthMap = parts.map(b => _len(b))
  let data = await Promise.all(parts.map(b => b.cid()))
  yield Block.encoder({ _type, data, lengthMap, length: len, maxLength }, codec)
}

module.exports = MaxLengthList
