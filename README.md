## Operations

This section describes only the operations for which there is currently an implementation. For a more exhaustive list of operations we may support in the future read [IPLD Multi-block Collections](https://github.com/ipld/specs/blob/master/schema-layer/data-structures/multiblock-collections.md).

The term “leaf” is used often below. When an operation is performed on a node it may make any number of additional calls to operations on other data structures with many results being produced and passed into continuations. “leaf” responses are those that are from the original target operation and not from subsequent operations trigger by the original operation.

If an operation wants to return the result of a subsequent operation as its own “leaf” it can “proxy” the result rather than have it passed back in as a continuation.

Operations need to accept and return named parameters and they also need to be able to accept continuations of some kind in order to call into the engine itself. How these are accomplished is left to the implementation.

### GET `{ path }`

Used for property lookups. Enables functionality similar to what you would expect from `Map` and `List` kinds.

Only a single leaf `{ result: Value }` must be received.

### KEYS `{}`

Used to produce an iterator of every top level property available in the data structure. Takes no options.

Multiple leaf `{ result: List(...keys) }` may be received.

### READ `{ start, end }`

Reads binary data.

If `start` is omitted, default to 0.

If `end` is omitted, default to the end of binary representation of the data structure.

Multiple leaf `{ result: Bytes }` may be received.

### RESOLVE `{}`

Returns a new node as the value of the current node.

Enables functionality similar to `Link` types but can also be used for encryption envelopes.

Only a single leaf `{ result: Value }` may be received.

## Implementations

While each implementation has a language specific API there is a fair amount in common between implementations that is specified here.

The interface for every operation can do the following:

	* Return a result.
	* Perform multiple calls of **any** operation on multiple targets of `value` or `path`
		*  `value` is an IPLD Data Model value.
		*  `path` is a IPLD Path relative to the node performing the operation.
			*  This path should be interpreted as *Layer 1* within the node and *Layer 2* once the path leaves the current block.
			* The result of these operations should be passed back into the original operation as a continuation **or** “proxied” as the leaf result of the original operation. 
