# Using the REPL

BlueScript includes an interactive shell, also known as a **REPL** (Read-Eval-Print Loop).
This allows you to execute BlueScript code line-by-line and see the results immediately, without the need to compile and flash a full project.

It is perfect for:
*   Testing language syntax.
*   Performing quick calculations.
*   Verifying logic functions.

## Starting the REPL

Connect your ESP32 device and run the following command in your terminal:

```bash
bscript repl -b esp32
```

Once connected, you will see the prompt `>` indicating the device is ready for input.

## Basic Usage

You can type standard BlueScript expressions and statements.

### Calculations
Expressions are evaluated and the result is printed automatically.

```typescript
> console.log(10 + 20)
30
> console.log(3.14 * 2.0)
6.28
```

### Variables and Logic
You can define variables and use them in subsequent commands.

```typescript
> let name: string = "BlueScript";
> console.log("Hello " + name);
Hello BlueScript
```

### Functions
You can also define simple functions interactively.

```typescript
> function square(x: integer): integer { return x * x; }
> console.log(square(5))
25
```

## Current Limitations

:::warning No Hardware Access (Yet)
Currently, the REPL **does not support loading external hardware libraries** such as `gpio`.
You cannot import modules in the REPL at this moment.

**Future Roadmap:**
We are actively working on enabling dynamic library loading for the REPL.
In a future update, you will be able to type `led.write(1)` and toggle pins directly from the terminal!
:::

## Exiting

To exit the REPL mode, press **`Ctrl + D`**.
