const Type = require('../base')
const Block = require('@ipld/block')

const mkcall = (path, start, end) => {
  let target = 'data/' + path
  return { method: 'read', args: {start, end}, target, proxy: true }
}

const _type = 'IPLD/Experimental/FixedChunker'

class FixedChunker extends Type {
  constructor (node) {
    super(node)
    this.length = node.length
    this.chunkSize = node.chunkSize
  }
  get _type () {
    return _type
  }
  get kind () {
    return 'bytes'
  }
  read (args) {
    let start = args.start || 0
    let end = args.end || this.length
    let firstIndex = Math.floor(start / this.chunkSize)
    let lastIndex = Math.floor(end / this.chunkSize)
    let firstStart = start - (firstIndex * this.chunkSize)
    let reads = []
    if (firstIndex === lastIndex) {
      let firstEnd = end - (firstIndex * this.chunkSize)
      return { call: mkcall(firstIndex, firstStart, firstEnd) }
    } else {
      reads.push(mkcall(firstIndex, firstStart))
    }
    let i = firstIndex + 1
    while (i < lastIndex) {
      reads.push(mkcall(i))
      i++
    }
    reads.push(mkcall(i, 0, end - (i * this.chunkSize)))
    return { calls: reads }
  }
}
FixedChunker.create = async function * (source, chunkSize=1024, codec='dag-json') {
  let length
  if (Buffer.isBuffer(source)) {
    length = source.length
    let i = 0
    let cids = []
    while (i < source.length) {
      let block = Block.encoder(source.slice(i, i + chunkSize), 'raw')
      cids.push(block.cid())
      yield block
      i += chunkSize
    }
    let data = await Promise.all(cids)
    yield Block.encoder({ data, length, chunkSize, _type }, codec) 
  }
}
FixedChunker._type = _type

module.exports = FixedChunker

