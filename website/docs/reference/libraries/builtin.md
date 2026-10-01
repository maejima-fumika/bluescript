# Built-in Library

The built-in library provides essential utilities that are available in BlueScript without the need for installation or configuration.

## Usage

These functions are available solely by running the environment; no `import` or installation steps are required.

## Global Functions

### `print(message: any): void`

An alias for `console.log`. Outputs a message to the standard output (console), followed by a newline.

**Parameters**
- `message` (any): The value to log.

**Returns**
- `void`

**Example**
```ts
print("Hello, World!");
// Output: Hello, World!
```

## Messages Between Projects

When programs are started by [`bscript workspace run`](../cli.md#bscript-workspace-run), they can send values to each other. The programs never talk directly: every message goes through the CLI, which keeps it until the receiver asks for it.

| Type | Send | Broadcast | Receive |
| :--- | :--- | :--- | :--- |
| `integer` | `sendInteger(dst, tag, value)` | `broadcastInteger(tag, value)` | `receiveInteger(src, tag): integer` |
| `float` | `sendFloat(dst, tag, value)` | `broadcastFloat(tag, value)` | `receiveFloat(src, tag): float` |
| `boolean` | `sendBoolean(dst, tag, value)` | `broadcastBoolean(tag, value)` | `receiveBoolean(src, tag): boolean` |
| `string` | `sendString(dst, tag, value)` | `broadcastString(tag, value)` | `receiveString(src, tag): string` |
| `null` | `sendNull(dst, tag, value)` | `broadcastNull(tag, value)` | `receiveNull(src, tag): null` |
| `integer[]` | `sendIntegerArray(dst, tag, value)` | `broadcastIntegerArray(tag, value)` | `receiveIntegerArray(src, tag): integer[]` |
| `float[]` | `sendFloatArray(dst, tag, value)` | `broadcastFloatArray(tag, value)` | `receiveFloatArray(src, tag): float[]` |
| `boolean[]` | `sendBooleanArray(dst, tag, value)` | `broadcastBooleanArray(tag, value)` | `receiveBooleanArray(src, tag): boolean[]` |
| `any[]` | `sendArray(dst, tag, value)` | `broadcastArray(tag, value)` | `receiveArray(src, tag): any[]` |

**Parameters**
- `dst` / `src` (string): The name of the receiving / sending project, as shown in `bsworkspace.json`. It must be another project.
- `tag` (string): A label that tells messages apart. Up to 255 bytes.
- `value`: The value to send, of the type in the function name.

**How messages are delivered**
- `send*` returns once the CLI has accepted the message; it does not wait for `dst` to receive it.
- `broadcast*` sends a copy to every other project that is still running. Projects that have already finished are skipped, and with nobody to receive, the call does nothing. The receivers get it with `receive*` as if it had been sent with `send*`.
- `receive*` waits until a message from `src` with `tag` arrives, and returns it.
- Messages from the same sender to the same receiver with the same tag are received in the order they were sent, whatever their types.

**Types**
The receiving function must match the type of the message: a value sent with `sendFloat` must be received with `receiveFloat`. Otherwise `receive*` throws a runtime error (`type mismatch`) and that message is discarded.

`any[]` is a type of its own: an array sent with `sendArray` must be received with `receiveArray`, and an `integer[]` sent with `sendIntegerArray` cannot be received with `receiveArray`. The elements of an `any[]` can only be integers, floats, booleans, `null` and strings; `sendArray` throws a runtime error when it holds anything else, such as another array or an object (`unsupported element` on ESP32).

**Size limits**
Strings and arrays are sent in one piece:
- To or from an ESP32 board, a message must fit in one Bluetooth packet: about 490 bytes, including the project name and tag on the sending side. For example, an `integer[]` of about 120 elements. The size of a value is checked when it is sent, so `send*` and `broadcast*` throw a runtime error when the receiver cannot take it (`value too large`). A broadcast is then sent to nobody.
- Between host projects, a message can be about 4 KB. A string takes two bytes per byte of text.

**Errors**
`send*`, `broadcast*` and `receive*` throw a runtime error when:
- `dst` or `src` is the project itself, or is not one of the projects being run.
- `dst` has already finished, or `src` has finished without sending a matching message. Messages that `src` sent before finishing can still be received.
- The message is of another type, or is too large (see above).
- An `any[]` holds an element other than an integer, float, boolean, `null` or string.
- Every running project is waiting in `receive*` (a deadlock).
- The program is not run by `bscript workspace run`.

On ESP32 the error message is short to save memory, for example `send to self`, `beta finished`, `type mismatch`, `value too large` or `deadlock`. It is also an error there when a request cannot be sent over Bluetooth (`send failed`) or does not fit in one packet (`request too long`).

**Example**
```ts
// In the project "controller"
const speeds: integer[] = [100, 120, 90];
sendIntegerArray("actuator", "speeds", speeds);
broadcastString("mode", "run");

// In the project "actuator"
const speeds = receiveIntegerArray("controller", "speeds");
const mode = receiveString("controller", "mode");
```

## Console

### `console.log(message: any): void`

Outputs a message to the standard output (console), followed by a newline.

**Parameters**
- `message` (any): The value to log.

**Returns**
- `void`

**Example**
```ts
console.log("Hello, World!");
// Output: Hello, World!
```

### `console.error(message: any): void`

Outputs an error message to the standard error console.

**Parameters**
- `message` (any): The error value to log.

**Returns**
- `void`

**Example**
```ts
console.error("Critical failure");
// Output: Critical failure
```

## Time

### `time.now(): float`

Returns the current time as a floating-point number, representing the milliseconds elapsed since the BlueScript runtime started.

**Parameters**

This function takes no parameters.

**Returns**
- `float`: Milliseconds since startup.

**Example**
```ts
const current = time.now();
console.log(current);
// Output: 123.456 (example)
```

### `time.delay(ms: integer): void`

Synchronously pauses the program execution for a specified duration.

:::note ESP32 only
`time.delay` is available on **ESP32** only. It is not available on the host runtime.
:::

**Parameters**
- `ms` (integer): The number of milliseconds to wait.

**Returns**
- `void`

**Example**
```ts
console.log("Starting...");
time.delay(1000); // Wait for 1 second
console.log("Finished 1s delay");
```
