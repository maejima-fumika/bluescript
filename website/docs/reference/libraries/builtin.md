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

### `sendInteger(dst: string, tag: string, value: integer): void`

Sends an integer to another project in the same workspace. Available only when the program is started by [`bscript workspace run`](../cli.md#bscript-workspace-run).

The message goes through the CLI, which keeps it until `dst` receives it. Messages with the same sender, receiver and tag are received in the order they were sent. The call returns once the CLI has accepted the message; it does not wait for `dst` to receive it.

**Parameters**
- `dst` (string): The name of the receiving project, as shown in `bsworkspace.json`. It must be another project.
- `tag` (string): A label that tells messages apart. Up to 255 bytes. On ESP32, `dst` and `tag` together must also fit in one Bluetooth packet (about 480 bytes with the usual MTU); a longer request is a runtime error (`request too long`).
- `value` (integer): The value to send.

**Returns**
- `void`

**Errors**
Throws a runtime error when `dst` is the project itself, when `dst` is not one of the projects being run, when `dst` has already finished, or when the program is not run by `bscript workspace run`. On ESP32 the error message is short (for example `send to self` or `beta finished`) to save memory. On ESP32 it is also an error when the request cannot be sent over Bluetooth (`send failed`), for example when the link stays congested.

**Example**
```ts
sendInteger("actuator", "speed", 120);
```

### `receiveInteger(src: string, tag: string): integer`

Waits for an integer sent by `src` with `sendInteger` under `tag`, and returns it. The program is blocked until the message arrives. Available only when the program is started by [`bscript workspace run`](../cli.md#bscript-workspace-run).

**Parameters**
- `src` (string): The name of the sending project. It must be another project.
- `tag` (string): The tag the message was sent with. Up to 255 bytes. The same ESP32 limit on `src` and `tag` together applies as for `sendInteger`.

**Returns**
- `integer`: The oldest value not yet received from `src` under `tag`.

**Errors**
Throws a runtime error when:
- `src` is the project itself.
- `src` is not one of the projects being run.
- `src` has finished without sending a matching message. Messages it sent before finishing can still be received.
- Every running project is waiting in `receiveInteger` (a deadlock).
- The program is not run by `bscript workspace run`.

On ESP32 the error message is short (for example `deadlock` or `controller finished`) to save memory. As with `sendInteger`, a request that cannot be sent over Bluetooth is an error (`send failed`).

**Example**
```ts
// In the project "actuator"
const speed = receiveInteger("controller", "speed");
print(speed);
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
