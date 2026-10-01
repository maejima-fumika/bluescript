import InstallCli from '@site/src/components/InstallCli';

# CLI

The BlueScript CLI (`bscript`) is the primary tool for managing projects, setting up board environments, and running code on your devices.

## Installation

<InstallCli />

:::info Prerequisites
On Windows, install the Visual C++ Build Environment before installing the CLI (required by node-gyp for native dependencies such as `serialport`). See [Windows prerequisites](../tutorial/get-started/setup-environment-windows.md).
:::

## Project Management

### `bscript project create`

Creates a new BlueScript project with the necessary configuration files.

```bash
bscript project create <project-name> [options]
```

This command generates a new directory containing:
*   `src/index.bs`: The main entry point for your application.
*   `bsconfig.json`: The project configuration file. See [bsconfig.json](./bsconfig.md) for all fields.

**Arguments:**
*   `<project-name>`: The name of the directory to create.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--board` | `-b` | Specify the target board (`esp32` or `host`). If omitted, an interactive selection list will appear. |

**Example:**
```bash
# Create a project interactively
bscript project create my-app

# Create a project specifically for ESP32
bscript project create my-app --board esp32

# Create a project for the host runtime (no hardware)
bscript project create my-app --board host
```

---

### `bscript project install`

Installs project dependencies. This command has two modes:

1. **Install All:** If run without arguments, it installs all dependencies listed in `bsconfig.json`.
2. **Add Package:** If a Git URL is provided, it downloads the package, adds it to `bsconfig.json`, and installs it.

See [bsconfig.json](./bsconfig.md#dependencies) for the `dependencies` field format.

```bash
bscript project install [git-url] [options]
```

**Arguments:**
*   `[git-url]`: (Optional) The URL of the Git repository to add as a dependency.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--tag` | `-t` | Specify a git tag or branch to checkout (e.g., `v1.0.0`, `main`). |

**Example:**
```bash
# Restore all dependencies from bsconfig.json
bscript project install

# Install a specific library (e.g., GPIO library)
bscript project install https://github.com/bluescript/gpio.git

# Install a specific version of a library
bscript project install https://github.com/bluescript/drivers.git --tag v2.0.0
```

---

### `bscript project uninstall`

Uninstall the specified package from the current project.

```bash
bscript project uninstall <package-name>
```

**Arguments:**
*   `<package-name>`: The package name to uninstall.

---

### `bscript project check`

Checks if the current project can be compiled successfully without actually sending it to a device.

```bash
bscript project check
```

This command runs the compiler locally on your host machine to verify for syntax errors and ensures that both BlueScript and Inline C code can be built correctly. You can use it to catch errors early before attempting to run the code on the hardware.

---

### `bscript project run`

Compiles the current project and executes it on the target board.

```bash
bscript project run [options]
```

When you run this command on an **ESP32** project:
1.  The CLI scans for a BlueScript device over Bluetooth whose name matches `-d` / `--device-name` (default: `"BLUESCRIPT"`).
2.  The project is compiled into native code on your host machine.
3.  The code is transferred to the connected device and executed immediately.

The device name must match the name set when you ran `bscript board flash-runtime`.

When you run this command on a **host** project, the CLI compiles the project and runs it in a local runtime process on your development machine. No Bluetooth connection is required.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--device-name` | `-d` | Bluetooth device name to connect to (default: `"BLUESCRIPT"`). **ESP32 only** — must match the name set during `bscript board flash-runtime`. Ignored for `host`. |
| `--with-repl` | | After the entry file (`entryFile` in `bsconfig.json`) finishes, start a terminal REPL on the device. Cannot be combined with `--with-notebook`. |
| `--with-notebook` | | After the entry file finishes, start the browser Notebook UI (default HTTP port `3000`). Cannot be combined with `--with-repl`. |

See the [REPL & Notebook tutorial](../tutorial/guides/repl.md) for usage details.

---


## Workspace Management

A workspace groups several projects so that they can run at the same time, for example a sensor on one ESP32, an actuator on another ESP32, and a simulator on the host. `esp32` and `host` projects can be mixed in one workspace.

A workspace is a directory with a `bsworkspace.json` file:

```json
{
  "name": "robot-swarm",
  "projects": [
    { "path": "./sensor", "deviceName": "BS-SENSOR" },
    { "path": "./actuator", "deviceName": "BS-ACTUATOR" },
    { "path": "./sim" }
  ]
}
```

| Field | Description |
| :--- | :--- |
| `name` | Name of the workspace. |
| `projects[].path` | Path to a project directory (containing `bsconfig.json`), relative to the workspace directory. |
| `projects[].deviceName` | Bluetooth device name of the board that runs the project. **ESP32 only.** Defaults to `"BLUESCRIPT"`. Each ESP32 project must use a different device name. |

Projects are identified by `projectName` in their `bsconfig.json`, so every project in a workspace must have a unique `projectName`.

### `bscript workspace create`

Creates a new directory containing an empty `bsworkspace.json`.

```bash
bscript workspace create <workspace-name>
```

**Arguments:**
*   `<workspace-name>`: The name of the directory to create.

---

### `bscript workspace add`

Adds an existing project to the workspace. Run it anywhere inside the workspace directory.

```bash
bscript workspace add <project-path> [options]
```

**Arguments:**
*   `<project-path>`: Path to the project directory.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--device-name` | `-d` | Bluetooth device name of the board that runs the project (default: `"BLUESCRIPT"`). **ESP32 only** — must match the name set during `bscript board flash-runtime`. |

**Example:**
```bash
bscript workspace create robot-swarm
cd robot-swarm
bscript project create sensor --board esp32
bscript project create sim --board host
bscript workspace add sensor --device-name BS-SENSOR
bscript workspace add sim
```

---

### `bscript workspace remove`

Removes a project from the workspace. Only the entry in `bsworkspace.json` is removed; the project directory is kept. Run it anywhere inside the workspace directory.

```bash
bscript workspace remove <project-path>
```

**Arguments:**
*   `<project-path>`: Path to the project directory. The directory does not need to exist anymore.

**Example:**
```bash
bscript workspace remove sim
```

---

### `bscript workspace run`

Compiles the projects in the workspace and runs them at the same time. Run it anywhere inside the workspace directory.

```bash
bscript workspace run [project-names...]
```

**Arguments:**
*   `[project-names...]`: Names of the projects to run. If omitted, every project in the workspace runs.

The CLI connects to every board, compiles and loads each project, and then starts all of the programs together. While it prepares the projects, it shows one line per project, updated in place:

```
[sensor  ] ✔ connect  ✔ init  ✔ compile  … load 42%
[sim     ] ✔ connect  ✔ init  ✔ compile  · load
[actuator] ✔ connect  ✔ init  … compile  · load
```

While the programs run, the screen is split into three parts: the messages so far stay at the top, the program output scrolls in the area between the two lines, and the bottom shows the state of each project. Each line of program output is prefixed with the project name:

```
INFO: Workspace demo: sensor (esp32, BLUESCRIPT), sim (host), actuator (esp32, BS-A)
[sensor  ] ✔ connect  ✔ init  ✔ compile  ✔ load
[sim     ] ✔ connect  ✔ init  ✔ compile  ✔ load
[actuator] ✔ connect  ✔ init  ✔ compile  ✔ load
INFO: Start executing programs. Type 'Ctrl-D' to exit.
── view: all ──────────────────────────────────────────────────
[sensor  ] temp=24.1
[sim     ] step 1
[actuator] motor on

───────────────────────────────────────────────────────────────
 1 [sensor  ] ● running   2 [sim     ] ✔ finished   3 [actuator] ● running
 1-3: focus  Tab: next  a: all  Ctrl-D: exit
```

| Key | Action |
| :--- | :--- |
| `1`-`9` | Show only the output of that project in the output area, starting with its recent lines. |
| `Tab` | Show only the output of the next project. |
| `a` | Show the output of every project again, starting with the recent lines of every project in the order they arrived. |
| `Ctrl-D` | Stop and exit. |

The top and the bottom stay in place; only the output area changes when you switch. The output area shows program output only: whether each project has finished or disconnected is shown at the bottom, and error messages from the CLI are printed below the screen when the command ends. When every program has finished, or when you type `Ctrl-D`, the output area switches back to every project and the screen is left as it is. Projects that were still running when you typed `Ctrl-D` are shown as `■ stopped`. When the output is not a terminal (for example, piped to a file), or the terminal is too short, the screen is not split: the steps and the output of every project are printed line by line.

If any project fails before execution (for example, a compile error or a board that cannot be found), no program is started. After execution starts, a board that disconnects is reported and the other projects keep running; a board that disconnects after its program has finished is not reported. In a terminal, the command keeps running after every program has finished, so that you can still switch between the outputs, and ends when you type `Ctrl-D`. When the keys cannot be used (for example, when the output is piped), the command ends when every program has finished.

The programs can exchange values (integers, floats, booleans, strings, null and arrays) with the built-in functions such as `sendInteger`, `broadcastString` and `receiveFloatArray` (see [Messages Between Projects](./libraries/builtin.md#messages-between-projects)). The programs never talk to each other directly: every message goes through the CLI, over the same connection that is used for program output. For example, with a workspace containing the projects `controller` and `actuator`:

```ts
// controller/src/index.bs
for (let i = 0; i < 3; i++) {
    sendInteger("actuator", "speed", i * 100);
    print(receiveInteger("actuator", "done"));
}
```

```ts
// actuator/src/index.bs
for (let i = 0; i < 3; i++) {
    const speed = receiveInteger("controller", "speed");
    sendInteger("controller", "done", speed + 1);
}
```

Only the projects named on the command line (or all of them) can be sent to or received from, and a project cannot send a message to itself or receive one from itself. When every running program is waiting in `receiveInteger`, the CLI reports a deadlock: each waiting program throws a runtime error.

---


## Board Management

These commands manage the toolchains and runtime environments for specific hardware platforms.

### `bscript board setup`

Downloads and installs the necessary environment files and dependencies for a specific board architecture.

```bash
bscript board setup <board-name>
```

**Arguments:**
*   `<board-name>`: The target board identifier (`esp32` or `host`).

**Platform requirements:**

| Board | macOS | Windows | Linux |
| :--- | :--- | :--- | :--- |
| `host` | `cc`, `make` | MinGW-w64: `gcc`, `mingw32-make` | `gcc`, `make` |
| `esp32` | Homebrew, Git, Python 3, `make` | Git, Python 3, `make` or `mingw32-make`. See [Windows prerequisites](../tutorial/get-started/setup-environment-windows.md). | None (Requirements are automatically installed by setup command.) |

For `host`, see [Try Without Microcontroller](../tutorial/guides/try-without-microcontroller.md).

---

### `bscript board flash-runtime`

Flashes the BlueScript Runtime firmware onto the microcontroller.
**Note:** This command requires a physical USB connection to the device. It is **not supported** for `host`.

```bash
bscript board flash-runtime <board-name> [options]
```

**Arguments:**
*   `<board-name>`: The target board identifier (e.g., `esp32`).

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--port` | `-p` | Serial port (e.g. macOS: `/dev/tty.usbserial-xxxx`; Windows: `COM3`; Linux: `/dev/ttyUSB0`). If omitted, the CLI lists available ports for selection. |
| `--device-name` | `-d` | Bluetooth device name advertised by the runtime after flashing (default: `"BLUESCRIPT"`). Use the same value with `bscript project run -d` or `bscript repl -d` when connecting wirelessly. |

**Example:**
```bash
bscript board flash-runtime esp32 --port /dev/ttyUSB0

# Flash with a custom Bluetooth device name
bscript board flash-runtime esp32 -d my-device
```

---

### `bscript board list`

Lists all board architectures currently supported by the installed CLI version (`esp32` and `host`).

```bash
bscript board list
```

---

### `bscript board remove`

Removes the environment files and setup data for a specific board.

```bash
bscript board remove <board-name> [options]
```

By default, this command asks for confirmation before deleting files.

**Arguments:**
*   `<board-name>`: The target board identifier (`esp32` or `host`).

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--force` | `-f` | Skips the confirmation prompt and forces removal. |

---

### `bscript board fullclean`

Completely removes all configuration and environment files for **all** boards. This returns the CLI board configurations to a fresh state.

```bash
bscript board fullclean
```
By default, this command asks for confirmation before deleting files.

**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--force` | `-f` | Skips the confirmation prompt and forces removal. |

---

### `bscript board update`

Update the version of installed environments.

```bash
bscript board update
```

---

## Other Commands

### `bscript repl`

Starts a **global** REPL session with the target device (no project required).

```bash
bscript repl --board <board-name> [options]
```

This mode is for language syntax experiments only. Hardware libraries installed via `bscript project install` are not available. For GPIO and other drivers, use `bscript project run --with-repl` or `--with-notebook` instead. See the [REPL & Notebook tutorial](../tutorial/guides/repl.md).

**Example:**
```bash
# Connect to the default device name
bscript repl -b esp32

# Connect to a custom device name
bscript repl -b esp32 -d my-device
```


**Options:**

| Option | Alias | Description |
| :--- | :--- | :--- |
| `--board` | `-b` | Specify the target board (`esp32` or `host`). |
| `--device-name` | `-d` | Bluetooth device name to connect to (default: `"BLUESCRIPT"`). **ESP32 only** — must match the name set during `bscript board flash-runtime`. Ignored for `host`. |
