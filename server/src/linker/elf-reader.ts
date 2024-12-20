import {Buffer} from "node:buffer";
import * as fs from "fs";
import {ELF32, SHFlag, STBind, STType} from "./elf32";

export enum SYMBOL_TYPE {
  FUNCTION,
  OBJECT,
  NONE
}

export enum SECTION_TYPE {
  EXECUTABLE,
  WRITABLE,
  READONLY
}

export type Section = {
  address: number,
  size: number,
  value: Buffer;
}

export type Symbol = {
  name: string,
  address: number,
  type: SYMBOL_TYPE
}

export class RelocatableElfReader {
  private readonly elf;

  constructor(path: string) {
    this.elf = new ELF32(fs.readFileSync(path));
  }

  public readExternalSymbolNames():string[] {
    const symbolNames:string[] = [];
    const syms = this.elf.readSyms();
    syms.forEach(sym => {
      if (sym.stType === STType.STT_NOTYPE && sym.stBind === STBind.STB_GLOBAL) {
        symbolNames.push(this.elf.readSymbolName(sym));
      }
    });
    return symbolNames;
  }

  public readSectionNames(type: SECTION_TYPE):string[] {
    const sectionNames:string[] = [];
    this.elf.shdrs.forEach(shdr => {
      const name = this.elf.readSectionName(shdr);
      if (!!(shdr.shFlags & SHFlag.SHF_ALLOC)) {
          if (type === SECTION_TYPE.EXECUTABLE && !!(shdr.shFlags & SHFlag.SHF_EXECINSTR))
            sectionNames.push(name);
          else if (type === SECTION_TYPE.WRITABLE && !!(shdr.shFlags & SHFlag.SHF_WRITE))
            sectionNames.push(name);
          else if (type === SECTION_TYPE.READONLY
            && !(shdr.shFlags & SHFlag.SHF_EXECINSTR) && !(shdr.shFlags & SHFlag.SHF_WRITE))
            sectionNames.push(name)
      }
    });
    return sectionNames;
  }
}

export class ExecutableElfReader {
  private elf;

  constructor(path: string) {
    this.elf = new ELF32(fs.readFileSync(path));
  }

  public readDefinedSymbols():Symbol[] {
    return this.readSymbols([STType.STT_FUNC, STType.STT_OBJECT])
  }

  public readAllSymbols() {
    return this.readSymbols([STType.STT_FUNC, STType.STT_OBJECT, STType.STT_NOTYPE])
  }

  private readSymbols(types: STType[]): Symbol[] {
    const syms = this.elf.readSyms();
    const symbols:Symbol[] = [];
    syms.forEach(sym => {
      const symName = this.elf.readSymbolName(sym);
      if ((types.includes(sym.stType)) && sym.stBind === STBind.STB_GLOBAL) {
        const symbol:Symbol = {
          name: symName,
          address: sym.stValue,
          type: this.stTypeToSymbolType(sym.stType)
        }
        symbols.push(symbol);
      }
    });
    return symbols;
  }

  private stTypeToSymbolType(stType: STType) {
    if (stType === STType.STT_FUNC)
      return SYMBOL_TYPE.FUNCTION
    else if (stType === STType.STT_OBJECT)
      return SYMBOL_TYPE.OBJECT
    else
      return SYMBOL_TYPE.NONE
  }

  public readSection(sectionName: string):Section|undefined {
    let section:Section|undefined = undefined;
    this.elf.shdrs.forEach(shdr => {
      const name = this.elf.readSectionName(shdr);
      if (name === sectionName) {
        section = {
          address: shdr.shAddr,
          size: shdr.shSize,
          value: this.elf.readSectionValue(shdr)
        }
      }
    });
    return section;
  }
}

