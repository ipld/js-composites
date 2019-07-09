


# Engine

## Traces

## Operations

Composite types implement any number of operations as functions.

These functions strictly accept and return IPLD Data Model kinds.

In JS, these functions take two arguments, both of which are Maps: `args` and `continuation`.

These functions return JS objects with a variety of signatures. 

#### `{ result: Kind }`


### Calling operations on other data structures



#### `{ call: { path: String, method: String, args: Map, continuation: Map } }`

#### `{ call: { target: Kind, method: String, args: Map, continuation: Map } }`

#### `{ calls: List of calls }`

### Creating blocks

#### `{ make: { source: Kind }, continuation: Map }`

#### `{ make: { raw: Bytes }, continuation: Map }`
