const withIs = require('class-is')

class BaseNode {
  constructor (node, lookup) {
    this.node = node
    this.lookup = lookup
  }
}

const Node = withIs(BaseNode, {
  className: 'Node',
  symbolName: '@ipld/engine'
})

module.exports = Node 
