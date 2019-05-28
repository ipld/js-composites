const withIs = require('class-is')

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

module.exports = Type

