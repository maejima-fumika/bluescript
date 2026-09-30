import { CompileOutput } from "@bscript/lang";
import { BoardName } from "../config/board-utils";
import { GlobalConfigHandler } from "../config/global-config";
import { ProjectConfigHandler } from "../config/project-config";
import { withTimeout } from "../core/async";
import { ProgramOutput } from "../core/logger";
import { EventEmitter, EventMap } from "../services/common";
import { CompileContext, CompilerAdapter, getCompilerAdapter } from "./compiler";
import { BoardRuntime, getBoardRuntime } from "./runtime";

const CLOSE_TIMEOUT_MS = 3_000;

export class SessionDisconnectedError extends Error {
    constructor(projectName: string) {
        super(`${projectName} was disconnected.`);
        this.name = 'SessionDisconnectedError';
    }
}

export type ProjectSessionEvents = {
    disconnected: () => void;
} & EventMap;

/**
 * Runs one project on its board: connect, prepare, build, load and execute.
 * It never touches stdin, the terminal layout or `process.exit`, so several
 * sessions can run side by side.
 */
export class ProjectSession extends EventEmitter<ProjectSessionEvents> {
    readonly name: string;
    readonly boardName: BoardName;
    private readonly compiler: CompilerAdapter;
    private readonly runtime: BoardRuntime;
    private compileContext?: CompileContext;
    private disconnected = false;
    private closed = false;
    private readonly disconnectWaiters = new Set<(error: Error) => void>();

    constructor(
        project: ProjectConfigHandler,
        globalConfigHandler: GlobalConfigHandler,
        output: ProgramOutput,
        deviceName?: string,
    ) {
        super();
        this.name = project.getConfig().projectName;
        this.boardName = project.getBoardName();
        // Throws when the board is not set up, before anything is connected.
        this.compiler = getCompilerAdapter(this.boardName, globalConfigHandler, project);
        this.runtime = getBoardRuntime(
            this.boardName, globalConfigHandler, output, deviceName,
            () => this.handleUnexpectedDisconnect(),
        );
    }

    connect(): Promise<void> {
        return this.guard(() => this.runtime.connect());
    }

    async prepare(): Promise<void> {
        this.compileContext = await this.guard(() => this.runtime.prepare());
    }

    build(): Promise<CompileOutput> {
        return this.compiler.buildProject(this.compileContext);
    }

    compileFragment(src: string): Promise<CompileOutput> {
        return this.compiler.compileFragment(src);
    }

    load(output: CompileOutput, onPacketSent?: (percent: number) => void): Promise<number> {
        return this.guard(() => this.runtime.load(output, onPacketSent));
    }

    execute(output: CompileOutput): Promise<number> {
        return this.guard(() => this.runtime.execute(output));
    }

    setOutput(output: ProgramOutput): void {
        this.runtime.setOutput(output);
    }

    async close(): Promise<void> {
        if (this.closed) {
            return;
        }
        this.closed = true;
        await withTimeout(
            this.runtime.disconnect(),
            CLOSE_TIMEOUT_MS,
            `Timed out while disconnecting ${this.name}.`,
        );
    }

    /**
     * Rejects with {@link SessionDisconnectedError} when the board disconnects
     * before `operation` settles. The runtime would otherwise keep waiting for
     * a reply that never comes.
     */
    private guard<T>(operation: () => Promise<T>): Promise<T> {
        if (this.disconnected) {
            return Promise.reject(new SessionDisconnectedError(this.name));
        }
        return new Promise<T>((resolve, reject) => {
            this.disconnectWaiters.add(reject);
            operation().then(
                (value) => {
                    this.disconnectWaiters.delete(reject);
                    resolve(value);
                },
                (error) => {
                    this.disconnectWaiters.delete(reject);
                    reject(error);
                },
            );
        });
    }

    private handleUnexpectedDisconnect() {
        if (this.closed || this.disconnected) {
            return;
        }
        this.disconnected = true;
        const error = new SessionDisconnectedError(this.name);
        for (const reject of this.disconnectWaiters) {
            reject(error);
        }
        this.disconnectWaiters.clear();
        this.emit('disconnected');
    }
}
