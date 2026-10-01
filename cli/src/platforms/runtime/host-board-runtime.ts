import * as path from 'path';
import { SharedLibrary } from "@bscript/lang";
import { ProgramOutput } from "../../core/program-output";
import { BoardRuntime } from "./board-runtime";
import { CompileContext } from "../compiler/compiler-adapter";
import { HostBoardConfig } from "../../config/global-config";
import { HostService, ProcessConnection } from '../../services/process';
import { answerReceive, answerSend, MessagePort, MessageReplier, NO_WORKSPACE_PORT } from "../messaging";


export class HostBoardRuntime implements BoardRuntime<SharedLibrary> {
    private programOutput: ProgramOutput;
    private shellProcess: ProcessConnection;
    private hostService: HostService;
    private messagePort: MessagePort = NO_WORKSPACE_PORT;
    private readonly replier: MessageReplier = {
        reply: (value) => this.hostService.reply(value),
        replyError: (error) => this.hostService.replyError(error.message),
    };

    constructor(
        private boardConfig: HostBoardConfig,
        programOutput: ProgramOutput,
        private onUnexpectedDisconnect?: () => void,
    ) {
        this.programOutput = programOutput;
        this.shellProcess = new ProcessConnection(this.getShellPath());
        this.shellProcess.on('disconnected', (code) => {
            if (code !== 0) {
                this.onUnexpectedDisconnect?.();
            }
        });
        this.hostService = this.shellProcess.getService('host');
    }

    async connect(): Promise<void> {
        await this.shellProcess.connect();
        this.hostService.on('log', (message) => {
            this.programOutput.write(message);
        });
        this.hostService.on('error', (message) => {
            this.programOutput.writeError(message);
        });
        this.hostService.on('send', (dst, tag, value) => {
            void answerSend(this.messagePort, this.replier, dst, tag, value);
        });
        this.hostService.on('receive', (src, tag) => {
            void answerReceive(this.messagePort, this.replier, src, tag);
        });
    }

    async disconnect(): Promise<void> {
        await this.shellProcess.disconnect();
    }

    async prepare(): Promise<CompileContext> {
        return {};
    }

    async load(output: SharedLibrary): Promise<number> {
        return this.hostService.load(output.filePath);
    }

    async execute(output: SharedLibrary): Promise<number> {
        let exectime = 0;
        for (const entry of output.entryNames) {
            exectime += await this.hostService.execute(entry.name);
        }
        return exectime;
    }

    setOutput(output: ProgramOutput): void {
        this.programOutput = output;
    }

    setMessagePort(port: MessagePort): void {
        this.messagePort = port;
    }

    private getShellPath(): string {
        return path.join(this.boardConfig.shellFile);
    }
}
