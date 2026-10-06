# Import declaration

An `import` declaration imports variables, functions, and classes
from another source file.
It allows only the named import using the following syntax.

```tsx
import { abs, max } from './math.bs'
```

This imports functions `abs` and `max` declared in the source file
`./math.bs`.
These functions must be declared with the `export` modifier.

An imported name can be renamed by the `as` keyword.

```tsx
import { abs as absolute, max } from './math.bs'

print(absolute(-3))
```

This imports the function `abs` under the name `absolute`.
The original name `abs` is not available in the importing file,
so it can be used for a different declaration.
Renaming is useful to avoid name conflicts, for example,
when two source files export classes with the same name.

```tsx
import { Point } from './geometry.bs'
import { Point as GridPoint } from './grid.bs'

const p: GridPoint = new GridPoint(1, 2)
```

Note that the namespace import such as `import * as math from './math.bs'`
is not supported.

Furthermore, the `import type` declaration is a valid syntax in BlueScript,
but this declaration is ignored.

```tsx
import type { integer, float } from './types.ts'
```

This declaration is useful when using a TypeScript editor for  editing a BlueScript program.
The builtin types `integer` and `float` will
be treated as valid type names when the contents of `./types.ts` are as follows.

```tsx
export type integer = number
export type float = number
```
