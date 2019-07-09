const Node = require('../base')
const Block = require('@ipld/block')

const _type = 'IPLD/Experimental/MaxLengthList/0'

class MaxLengthList extends Node {
  get _type () {
    return _type
  }
  get (args) {
    let path = args.path.split('/').filter(x => x)
    let attr = parseInt(path.shift())
    if (isNaN(attr)) throw new Error('List type can only lookup integers')

    if (this.data.leaf) {
      return { result: this.data.data[attr] }
    }

    let i = 0
    let seen = 0
    while (i < this.data.length) {
      let m = this.data.lengthMap[i]
      if (attr < (seen + m)) {
        path = (attr - seen) + path.join('/')
        return { call: { path: 'data/' + i, info: { method: 'get', args: { path } }, proxy: true } }
      }
      i++
      seen += m
    }
  }
  create (args, continuation = {}) {
    let values = args.values
    let len = values.length
    let maxLength = args.maxLength
    continuation = Object.assign({}, continuation)
    continuation.values = values.slice()
    continuation.parts = continuation.parts || []
    let size = Math.ceil(len / maxLength)

    if (continuation.state === 'finish') {
      return { result: { cid: continuation.cid, len: continuation.len } }
    }

    if (continuation.state === 'subcreate') {
      continuation.parts.push({
        cid: continuation.result.cid,
        len: continuation.result.len
      })
    }
    if (continuation.state === 'make') {
      continuation.parts.push({
        cid: continuation.cid,
        len: continuation.len
      })
    }
    if (size > maxLength) {
      let _args = { values: continuation.values.splice(0, size), maxLength }
      let _continuation = { state: 'subcreate' }
      return { call: {
        target: this.data,
        method: 'create',
        args: _args,
        continuation: _continuation
      } }
    } else {
      if (continuation.values.length) {
        let data = continuation.values.splice(0, size)
        let source = { _type, data, length: data.length, leaf: true }
        continuation.state = 'make'
        continuation.len = data.length
        return { make: { source }, continuation }
      } else {
        // finish
        let lengthMap = continuation.parts.map(o => o.len)
        let data = continuation.parts.map(o => o.cid)
        continuation.state = 'finish'
        continuation.len = len
        return {
          make: {
            source: { _type, data, lengthMap, length: len, maxLength }
          },
          continuation
        }
      }
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
