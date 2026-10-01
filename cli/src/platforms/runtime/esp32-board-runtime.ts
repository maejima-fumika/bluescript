import { BleConnection, DeviceService } from "../../services/ble/index";
import { MemoryImage } from "@bscript/lang";
import { ProgramOutput } from "../../core/program-output";
import { BoardRuntime } from "./board-runtime";
import { CompileContext } from "../compiler/compiler-adapter";
import { answerBroadcast, answerReceive, answerSend, MessagePort, MessageReplier, MessageValue, NO_WORKSPACE_PORT } from "../messaging";


export class Esp32BoardRuntime implements BoardRuntime<MemoryImage> {
    private ble: BleConnection | null = null;
    private deviceService: DeviceService | null = null;
    private programOutput: ProgramOutput;
    private messagePort: MessagePort = NO_WORKSPACE_PORT;

    constructor(
        private deviceName: string,
        programOutput: ProgramOutput,
        private onUnexpectedDisconnect?: () => void,
    ) {
        this.programOutput = programOutput;
    }

    async connect(): Promise<void> {
        this.ble = new BleConnection(this.deviceName);
        await this.ble.connect();

        this.ble.on('disconnected', () => {
            if (this.ble?.status !== 'disconnecting') {
                if (this.onUnexpectedDisconnect) {
                    this.onUnexpectedDisconnect();
                } else {
                    process.exit(1);
                }
            }
            this.ble = null;
            this.deviceService = null;
        });

        this.deviceService = this.ble.getService('device');
        this.deviceService.on('log', (message) => this.programOutput.write(message));
        this.deviceService.on('error', (message) => this.programOutput.writeError(message));
        const deviceService = this.deviceService;
        // Memory is scarce on the board, so it only gets the short text.
        const replier: MessageReplier = {
            reply: (message) => deviceService.reply(message),
            replyError: (error) => deviceService.replyError(error.shortMessage),
        };
        deviceService.on('send', (dst, tag, message) => {
            void answerSend(this.messagePort, replier, dst, tag, message);
        });
        deviceService.on('receive', (src, tag, expected) => {
            void answerReceive(this.messagePort, replier, src, tag, expected);
        });
        deviceService.on('broadcast', (tag, message) => {
            void answerBroadcast(this.messagePort, replier, tag, message);
        });
    }

    async disconnect(): Promise<void> {
        if (this.ble) {
            await this.ble.disconnect();
        }
    }

    async prepare(): Promise<CompileContext> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to initialize device. BLE is not connected.');
        }
        const memoryLayout = await this.deviceService.init();
        return { memoryLayout };
    }

    async load(output: MemoryImage, onPacketSent: (percent: number) => void): Promise<number> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to load binary. BLE is not connected.');
        }
        return this.deviceService.load(output, onPacketSent);
    }

    async execute(output: MemoryImage): Promise<number> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to execute binary. BLE is not connected.');
        }
        return this.deviceService.execute(output);
    }

    setOutput(output: ProgramOutput): void {
        this.programOutput = output;
    }

    setMessagePort(port: MessagePort): void {
        this.messagePort = port;
    }

    canReceiveMessage(message: MessageValue): boolean {
        return this.deviceService?.canReceive(message) ?? false;
    }
}
