import {Section} from "./elf-reader";

const align4 = (value: number) => (value + 3) & ~3;

export class MemoryRegion {
  private usedSize: number = 0;
  constructor(private name: string, private address: number, private size: number) {}

  public getNextAddress() { return this.address + this.size }

  public allocate(section: Section) {
    const alignedSectionSize = align4(section.size);
    if (this.usedSize + alignedSectionSize > this.size)
      throw new Error(`Memory exhausted: ${this.name}`)
    const memoryBlock = new MemoryBlock(this.address + this.usedSize, alignedSectionSize)
    memoryBlock.sectionName = section.name
    this.usedSize += alignedSectionSize
    return memoryBlock
  }
}


export class ReusableMemoryRegion {
  private name: string
  private memoryBlocks: MemoryBlock

  constructor(name: string, address: number, size: number) {
    this.name = name
    this.memoryBlocks = new MemoryBlock(address, size)
  }

  public allocate(section: Section) {
    const alignedSectionSize = align4(section.size);
    let current: undefined | MemoryBlock = this.memoryBlocks
    let allocatedBlock: undefined | MemoryBlock
    while(current !== undefined) {
      if (current.isFree && current.size > alignedSectionSize) {
        allocatedBlock = current
        current.separate(alignedSectionSize)
        current.isFree = false
        current.sectionName = section.name
        break
      }
      current = current.next
    }
    if (allocatedBlock === undefined)
      throw new Error('Memory Exhausted')
    return allocatedBlock
  }

  public free(sectionName: string) {
    let current: undefined | MemoryBlock = this.memoryBlocks
    while(current !== undefined) {
      if (current.sectionName === sectionName) {
        current = current.free()
      }
      current = current.next
    }
  }
}


export class MemoryBlock {
  constructor(
    public address: number,
    public size: number,
    public isFree = true,
    public sectionName?: string,
    public prev?: MemoryBlock,
    public next?: MemoryBlock) {}

  public free() {
    this.isFree = true
    this.sectionName = undefined
    if (this.next && this.next.isFree) {
      this.size += this.next.size
      if (this.next.next)
        this.next.next.prev = this
      this.next = this.next.next
    }
    if (this.prev && this.prev.isFree) {
      this.prev.size += this.size
      if (this.next)
        this.next.prev = this.prev
      this.prev.next = this.next
      return this.prev
    }
    return this
  }

  public separate(firstSize: number) {
    if (!this.isFree)
      throw new Error('Cannot separate first.')
    const remain = new MemoryBlock(this.address + firstSize, this.size - firstSize)
    remain.prev = this
    remain.next = this.next
    this.size = firstSize
    if (this.next)
      this.next.prev = remain
    this.next = remain
  }
}
