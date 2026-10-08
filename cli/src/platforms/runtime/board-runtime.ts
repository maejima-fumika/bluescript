import { CompileOutput } from "@bscript/lang";
import { ProgramOutput } from "../../core/program-output";
import { CompileContext } from "../compiler/compiler-adapter";
import { MessagePort, MessageValue } from "../messaging";
import { ExecResult } from "./exec-result";

export interface BoardRuntime<Output extends CompileOutput = CompileOutput> {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    prepare(): Promise<CompileContext>;
    load(output: Output, onPacketSent?: (percent: number) => void): Promise<number>;
    execute(output: Output): Promise<ExecResult>;
    setOutput(output: ProgramOutput): void;
    /** Where the program's `sendInteger` / `receiveInteger` go. Defaults to `NO_WORKSPACE_PORT`. */
    setMessagePort(port: MessagePort): void;
    /** Whether the board can receive `message` in one reply (see `MessageRouter`). */
    canReceiveMessage(message: MessageValue): boolean;
}
