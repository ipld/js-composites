const withIs = require('class-is')

class BaseNode {
  constructor (data, lookup) {
    this.data = data
    this.lookup = lookup
  }
}

const Node = withIs(BaseNode, {
  className: 'Node',
  symbolName: '@ipld/engine'
})

module.exports = Node
