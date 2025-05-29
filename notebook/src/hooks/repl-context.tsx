import Bluetooth, {MAX_MTU} from '../services/bluetooth';
import {useState, useEffect, useRef, createContext, ReactNode} from 'react';
import * as network from "../services/network"
import { CompileError } from '../utils/error';
import { CellStateT, CellT, MemInfo, ReplStateT } from '../utils/type';
import { BYTECODE, BytecodeBufferBuilder, bytecodeParser } from '../utils/bytecode';
import {Buffer} from "buffer";
import { MemoryDummry, MemoryT, useMemory } from './use-memory';

export type ReplContextT = {
    state: ReplStateT,
    latestCell: CellT,
    postExecutionCells: CellT[],
    output: string[],
    runtimeError: string[],
    useJIT: boolean,
    iram: MemoryT,
    dram: MemoryT,
    iflash: MemoryT,

    updateUseJIT: (useJIT: boolean) => void,
    setLatestCellCode: (code: string) => void,
    resetStart: () => Promise<void>,
    executeLatestCell: () => Promise<void>,
    install: () => Promise<void>
    consoleExperimentLog: ()=>void
}

export const ReplContext = createContext<ReplContextT>({
    // These are used if there is no provider.
    state: 'initial',
    latestCell: {compileId:-1, code:'', state: CellStateT.UserWriting, time:undefined},
    postExecutionCells: [],
    output: [],
    runtimeError: [],
    useJIT: true,
    iram: MemoryDummry,
    dram: MemoryDummry,
    iflash: MemoryDummry,

    updateUseJIT: (useJIT: boolean) => {},
    setLatestCellCode: (code: string) => {},
    resetStart: async () => {},
    executeLatestCell: async () => {},
    install: async () => {},
    consoleExperimentLog: () => {}
});

export default function ReplProvider({children}: {children: ReactNode}) {
    const [replState, setReplState] = useState<ReplStateT>('initial')
    const [useJIT, setUseJIT] = useState(true)
    const [latestCell, setLatestCell] = useState<CellT>({compileId: -1, code:'', state: CellStateT.UserWriting, time:undefined})
    const [postExecutionCells, setPostExecutionCells] = useState<CellT[]>([])
    const [output, setOutput] = useState<string[]>([])
    const [runtimeError, setRuntimeError] = useState<string[]>([])
    const iram = useMemory('IRAM')
    const dram = useMemory('DRAM')
    const iflash = useMemory('Flash')
    const dflash = useMemory('DFlash')
    const [experimentLog, setExperimentLog] = useState('');
    
    const bluetooth = useRef(new Bluetooth())

    // To use these variables in callbacks
    const latestCellRef = useRef(latestCell)
    latestCellRef.current = latestCell
    
    useEffect(() => {
        bluetooth.current.setNotificationHandler(onReceiveNotification);
    },[])

    const resetStart = async () => {
        setReplState("loading")
        const bytecodeBuffer = new BytecodeBufferBuilder(MAX_MTU).reset().generate()
        try {
            await bluetooth.current.sendBuffers(bytecodeBuffer)
        } catch (error: any) {
            // TODO: 要修正
            console.log(error)
            window.alert(`Failed to reset: ${error.message}`)
        }
    }

    const consoleExperimentLog = () => {
        console.log(experimentLog);
        global.navigator.clipboard.writeText(experimentLog);
    }

    const addExperimentLog = (log: string) => {
        setExperimentLog((oldLog) => oldLog + log + "\n");
    }

    const onResetComplete = (meminfo: MemInfo) => {
        network.reset(meminfo).then(() => {
            setPostExecutionCells([])
            setOutput([])
            setRuntimeError([])
            setLatestCell({compileId: -1, code:'', state: CellStateT.UserWriting, time:undefined})
            setReplState("activated")
            iram.actions.reset(meminfo.iram.address, meminfo.iram.size)
            dram.actions.reset(meminfo.dram.address, meminfo.dram.size)
            iflash.actions.reset(meminfo.iflash.address, meminfo.iflash.size)
            dflash.actions.reset(meminfo.dflash.address, meminfo.dflash.size)
        }).catch(e => {
            // TODO: 要修正
            console.log(e)
            window.alert(`Failed to reset: ${e.message}`)
        });
    }

    const sendCompileResult = async (compileResult: network.CompileResult) => {
        const bytecodeBuilder = new BytecodeBufferBuilder(MAX_MTU)
        for (const block of compileResult.result.blocks) {
            bytecodeBuilder.load(block.address, Buffer.from(block.data, "hex"));
        }
        for (const entryPoint of compileResult.result.entryPoints) {
            bytecodeBuilder.jump(entryPoint.id, entryPoint.address);
        }
        const bluetoothTime = await bluetooth.current.sendBuffers(bytecodeBuilder.generate())
        return bluetoothTime
    }

    const setMemoryUpdates = (compileResult: network.CompileResult) => {
        for (const block of compileResult.result.blocks) {
            if (block.type === 'iram')
                iram.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
             else if (block.type === 'dram')
                dram.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
            else if (block.type === 'iflash')
                iflash.actions.setUsedSegment(block.address, Buffer.from(block.data, "hex").length)
        }
    }

    const executeLatestCell = async () => {
        addExperimentLog(`push execution button, current: ${performance.now()}`);
        setLatestCell((cell) => ({...cell, compileId:-1, state: CellStateT.Compiling, time:undefined}))
        try {
            const compileResult = useJIT ? await network.interactiveCompileWithProfiling(latestCell.code) : await network.interactiveCompile(latestCell.code)
            console.log(compileResult)
            const compileTime = compileResult.compileTime
            setLatestCell((cell) => ({...cell, compileId: compileResult.compileId, state: CellStateT.Sending, time: {compile: compileTime}}))
            const bluetoothTime = await sendCompileResult(compileResult)
            setMemoryUpdates(compileResult)
            setLatestCell((cell) => ({...cell, state: CellStateT.Executing, time: {compile: compileTime, send: bluetoothTime}}))
        } catch (error: any) {
            if (error instanceof CompileError) {
                const errorStrings = error.messages.map(m => {
                    const line = m.location?.start.line
                    const column = m.location?.start.column
                    return `${m.message} in line ${line ? line : '??'} ${column ? `(column ${column})` : ''}`
                })
                setLatestCell((cell) => ({...cell, compileId:-1, state: CellStateT.UserWriting, compileError: errorStrings, time:undefined}))
            } else {
                // TODO: 要修正
                console.log(error)
                window.alert(`Failed to compile: ${error.message}`)
            }
        }
    }

    const setLatestCellCode = (code: string) => {
        setLatestCell({...latestCell, code})
    }

    const onExecutionComplete = (id: number, exectime: number) => {
        network.codeExecutionFinished(id);

        if (id !== latestCellRef.current.compileId) 
            return;    

        const updateCells = () => {
            const current = latestCellRef.current;
            const latestCellTime = {compile: current.time?.compile, send: current.time?.send, execute: exectime};
            setPostExecutionCells((cells) => [...cells, {...current, state: CellStateT.Done, time: latestCellTime}]);
            setLatestCell({state: CellStateT.UserWriting, compileId: -1, code: '', time: undefined});
        }

        if (latestCellRef.current.state === CellStateT.Executing) {
            updateCells();
            addExperimentLog(`compile: ${latestCellRef.current.time?.compile}`);
            addExperimentLog(`bluetooth: ${latestCellRef.current.time?.send}`);
            addExperimentLog(`execution: ${exectime}`);
        } else {
            // Sometimes execution overtake screen drawing.
            setTimeout(() => {
                if (latestCellRef.current.state !== CellStateT.Executing) {
                    window.alert(`Something wrong happend.`)
                } else {
                    updateCells();
                    addExperimentLog(`compile: ${latestCellRef.current.time?.compile}`);
                    addExperimentLog(`bluetooth: ${latestCellRef.current.time?.send}`);
                    addExperimentLog(`execution: ${exectime}`);
                }
            }, 500);
        }
    }

    const jitCompile = async (fid: number, paramtypes: string[]) => {
        try {
            const compileResult = await network.jitCompile(fid, paramtypes)
            await sendCompileResult(compileResult)
            setMemoryUpdates(compileResult)
            console.log('JIT finish')
        } catch (error: any) {
            // TODO: 要修正
            console.log(error)
            window.alert(`Failed to compile: ${error.message}`)
        }
    }

    const install = async () => {
        setReplState('installing');
        let src = "";
        postExecutionCells.forEach(cell => src += `${cell.code}\n`);
        try {
            const compileResult = await network.compile(src);
            const builderForDflash = new BytecodeBufferBuilder(dflash.state.size);
            const builder = new BytecodeBufferBuilder(MAX_MTU);
            compileResult.result.blocks.forEach(block => {
                if (block.type === 'iflash')
                    builder.load(block.address, Buffer.from(block.data, "hex"))
                if (block.type === 'dram')
                    builderForDflash.load(block.address, Buffer.from(block.data, "hex"))
            });
            compileResult.result.entryPoints.forEach(entry => builderForDflash.jump(entry.id, entry.address));
            const dflashBuffer = Buffer.concat(builderForDflash.generate());
            const dflashHeader = Buffer.allocUnsafe(5);
            dflashHeader.writeUIntLE(1, 0, 1); // flash is written or not.
            dflashHeader.writeUIntLE(dflashBuffer.length, 1, 4); 
            builder.load(dflash.state.address, dflashHeader);
            builder.load(dflash.state.address + 5, dflashBuffer);
            await bluetooth.current.sendBuffers(builder.generate());
            setReplState('successfully installed');
        } catch(e: any) {
            console.log(e.message);
            setReplState('failed to install');
        }
    }

    const onReceiveNotification = async (event: Event) => {
        // @ts-ignore
        const value = event.target.value as any;
        const parseResult = bytecodeParser(value);
        switch (parseResult.bytecode) {
            case BYTECODE.RESULT_LOG:
                addExperimentLog(`output: ${parseResult.log}, current: ${performance.now()}`);
                setOutput(output => [...output, parseResult.log])
                break;
            case BYTECODE.RESULT_ERROR:
                setRuntimeError(runtimeError => [...runtimeError, parseResult.error])
                break;
            case BYTECODE.RESULT_MEMINFO:
                console.log(parseResult.meminfo)
                onResetComplete(parseResult.meminfo)
                break;
            case BYTECODE.RESULT_EXECTIME: 
                onExecutionComplete(parseResult.id, parseResult.exectime)
                break;
            case BYTECODE.RESULT_PROFILE: {
                console.log("receive profile", parseResult.fid, parseResult.paramtypes);
                jitCompile(parseResult.fid, parseResult.paramtypes)
                break; 
            }
        }
    }

    return (
        <ReplContext.Provider value={{
            state: replState,
            latestCell,
            postExecutionCells,
            output,
            runtimeError,
            useJIT,
            iram,
            dram,
            iflash,

            updateUseJIT: setUseJIT,
            setLatestCellCode,
            resetStart,
            executeLatestCell,
            install,
            consoleExperimentLog
        }}>
        {children}
        </ReplContext.Provider>
    )
}
