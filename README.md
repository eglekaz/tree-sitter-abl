# tree-sitter-abl

OpenEdge Advanced Business Language (ABL) grammar for tree-sitter.

Forked from [@usagi-coffee/tree-sitter-abl](https://github.com/usagi-coffee/tree-sitter-abl)


To see syntax tree output see files in `test/corpus`.

## Usage

> Keep in mind there are many ABL statements that are not yet implemented but that doesn't ***necessarily*** mean they're not parsable, it just means the syntax tree won't have details about the statements!

For the grammar usage in your project look at tree-sitter documentation on how to use the grammar parsers because you can use tree-sitter parsers using [node](https://github.com/tree-sitter/node-tree-sitter)/[rust](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_rust)/[wasm](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) bindings.

### Node

```bash
npm install tree-sitter-abl
```

### WASM

Prebuilt WASM binary can be found in NPM package or build yourself with `npm run build:wasm`.
Follow [web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) binding documentation.

```
// Getting wasm binary from the npm package
const fs = require('node:fs');
const mod = fs.readFileSync('node_modules/tree-sitter-abl/tree-sitter-abl.wasm');
```

### Shared library (.so)

You can build a shared library `.so` to use it in tools like [ast-grep](https://ast-grep.github.io/)

```bash
gcc -shared -fPIC -fno-exceptions -g -I 'src' -o abl.so -O2 src/scanner.c -xc src/parser.c -lstdc++
```

### Running the tests

```bash
npm run test
```

### Testing your file

```bash
npm run parse your_file.p
```

