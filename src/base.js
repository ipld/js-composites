const withIs = require('class-is')

class BaseType {
  constructor (node, lookup) {
    this.node = node
    this.lookup = lookup
  }
}

const Type = withIs(BaseType, {
  className: 'Type',
  symbolName: '@ipld/types/Type'
})

module.exports = Type
