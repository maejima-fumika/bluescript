# Standard Libraries

BlueScript follows a "Battery-included but removable" philosophy.
Core features are kept minimal, while hardware drivers are provided as external standard libraries hosted on GitHub.

To install any of these libraries, use the command:
`bscript project install <git-url>`

## Available Libraries

Currently, the following libraries are available for stable use.

### Digital I/O
*   **GPIO (General Purpose Input/Output)**
    *   Control pins, read digital states, and handle interrupts.
    *   **Repository:** [https://github.com/bluescript-lang/pkg-gpio-esp32.git](https://github.com/bluescript-lang/pkg-gpio-esp32.git)
    *   **Usage:** `import { GPIO } from "gpio";`

---

## Roadmap (Planned Libraries)

We are actively developing drivers for the following peripherals.
Support for these features will be rolled out in upcoming updates.

| Category | Library | Status | Description |
| :--- | :--- | :--- | :--- |
| **Analog** | **ADC** | 🚧 Planned | Read analog sensor values. |
| **Analog** | **DAC** | 🚧 Planned | Output analog voltage signals. |
| **Control** | **PWM** | 🚧 Planned | Pulse Width Modulation for LEDs and Servos. |
| **Comms** | **UART** | 🚧 Planned | Serial communication with other devices. |
| **Comms** | **I2C** | 🚧 Planned | Interface with sensors and displays (Two-wire). |
| **Comms** | **SPI** | 🚧 Planned | High-speed serial communication. |
| **Audio** | **I2S** | 🚧 Planned | Digital audio data transfer. |
| **Wireless** | **WiFi** | 🚧 Planned | Connect to the internet, make HTTP requests. |
| **Wireless** | **Bluetooth** | 🚧 Planned | BLE communication (Central/Peripheral). |

<!-- :::note Contribute?
BlueScript is an open ecosystem. If you have wrapped an ESP-IDF component into a BlueScript package, feel free to share it with the community!
::: -->
