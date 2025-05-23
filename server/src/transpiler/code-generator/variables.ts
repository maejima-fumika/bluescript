// Copyright (C) 2023- Shigeru Chiba.  All rights reserved.

import * as AST from '@babel/types'
import { FunctionType, StaticType, ObjectType, isPrimitiveType, ArrayType } from '../types'
import { NameTable, NameTableMaker, GlobalNameTable,
         BlockNameTable, FunctionNameTable, NameInfo,
         getNameTable } from '../names'
import { ClassTable, InstanceType } from '../classes'
import { rootSetVariable, prefixOfarrayTypeNameInC, getObjectProperty,
         getObjectPrimitiveProperty,
         getObjectPropertyAddress, setObjectProperty } from './c-runtime'

// An object representing a name.
export class VariableInfo extends NameInfo {
  private _index?: number = undefined

  constructor(t: StaticType) {
    super(t)
  }

  index() { return this._index }
  setIndex(index: number, ignored?: string) {
     this._index = index
     if (ignored !== undefined)
       throw new Error('fatal: bad rootset name given')
  }

  // Name used for its declaration
  // the returned value should be the same as the value
  // returned by transpile() when this.index() === undefined.
  transpiledName(name: string) { return this.transpile0(name) }

  // The expression to obtian the value of this variable.
  transpile(name: string) {
    if (this.index() === undefined)
      return this.transpile0(name)
    else
      if (this.captured)
        return this.transpileBoxed(true)
      else
        return this.transpileAccess()
  }

  protected transpile0(name: string) {
    return `_${name}`
  }

  transpileBoxed(read: boolean, with_barrier: boolean = false) {
    if (isPrimitiveType(this.type))
      return `(${getObjectPrimitiveProperty(this.type)}${this.transpileAccess()}, 0))`
    else
      if (read)
        return `${getObjectProperty}(${this.transpileAccess()}, 0)`
      else {
        if (with_barrier)
          return `${setObjectProperty}(${this.transpileAccess()}, 0, `
        else {
          // valid only when the property holds a value_t value but it is
          // a tagged integer or float.
          return `*${getObjectPropertyAddress}(${this.transpileAccess()}, 0)`
        }
      }
  }

  transpileAccess() {
    return rootSetVariable(this.index())
  }

  // A variable holds a boxed value when it is captured by a lambda function.
  isBoxed(): boolean {
    return (this.captured || (this instanceof FreeVariableInfo
                              && !(this.original() instanceof GlobalVariableInfo)))
           && !(this instanceof GlobalVariableInfo) && !(this instanceof FreeGlobalVariableInfo)
  }

  // A free variable holding a boxed value.
  isBoxedFreeVariable(): this is FreeVariableInfo {
    return this instanceof FreeVariableInfo && !(this.original() instanceof GlobalVariableInfo)
  }

  isGlobal() { return false }
}

// Free variable name.
// A FreeVariableInfo object is contained only in a FunctionEnv or a GlobalEnv.
// A free variable is a variable declared outside a function body (or a file scope).
// It may be a global variable.
class FreeVariableInfo extends VariableInfo {
  protected nameInfo: VariableInfo    // never FreeVariableInfo

  constructor(name: VariableInfo) {
    super(name.type)
    this.copyFrom(name)
    while (name instanceof FreeVariableInfo)
      name = name.nameInfo

    this.nameInfo = name
  }

  original(): VariableInfo {
    return this.nameInfo
  }

  isBoxed(): boolean {
    return !(this.nameInfo instanceof GlobalVariableInfo)
  }

  transpiledName(name: string) { return this.nameInfo.transpiledName(name) }

  transpile(name: string) {
    const info = this.nameInfo
    if (info instanceof GlobalVariableInfo)
      return info.transpile(name)
    else
      return this.transpileBoxed(true)
  }

  isGlobal() { return this.nameInfo.isGlobal() }
}

// This is not a subtype of GlobalVariableInfo.
class FreeGlobalVariableInfo extends FreeVariableInfo {
  transpile(name: string) { return this.nameInfo.transpile(name) }
  isGlobal() { return true }
}

class GlobalVariableInfo extends VariableInfo {
  private rootSetName?: string
  private moduleId: string

  constructor(t: StaticType, moduleId: string) {
    super(t)
    this.moduleId = moduleId
  }

  override transpile(name: string) {
    if (this.rootSetName)
      return rootSetVariable(this.index(), this.rootSetName)
    else
      return this.transpile0(name)
  }

  override transpile0(name: string) {
    return `_${this.moduleId}${name}`
  }

  // set a rootset name and a rootset index
  setIndex(index: number, varName?: string) {
    if (varName === undefined)
      throw new Error('fatal: no rootset name')

    this.rootSetName = varName
    super.setIndex(index)
  }

  // name, type and index used for extern declaration
  externName(name: string): [string?, StaticType?, number?] {
    if (this.isTypeName)
      return [undefined, this.type]
    else if (this.rootSetName)
      return [this.rootSetName, undefined, this.index()]
    else
      return [this.transpile(name), this.type]
  }

  isGlobal() { return true }
}

// A variable name table refers to NameTable<VariableInfo>.

// to customize TypeChecker to use VariableInfo instead of NameInfo
export class VariableNameTableMaker implements NameTableMaker<VariableInfo> {
  private moduleId: string

  // moduleId is '' unless this maker is used for a module.
  constructor(moduleId: string) {
    this.moduleId = moduleId
  }

  block(parent: NameTable<VariableInfo>) { return new BlockNameTable<VariableInfo>(parent) }
  function(parent: NameTable<VariableInfo>) { return new FunctionVarNameTable(parent) }
  info(t: StaticType) { return new VariableInfo(t) }
  globalInfo(t: StaticType) { return new GlobalVariableInfo(t, this.moduleId) }

  instanceType(name: string, superClass: ObjectType) {
    return new InstanceType(`${this.moduleId}${name}`, name, superClass)
  }
}

class FunctionVarNameTable extends FunctionNameTable<VariableInfo> {
  override makeFreeInfo(free: VariableInfo) {
    return new FreeVariableInfo(free)
  }

  isFreeInfo(free: NameInfo): boolean { return free instanceof FreeVariableInfo }
}

let arrayTypeIndex = 0

export class GlobalVariableNameTable extends GlobalNameTable<VariableInfo> {
  private classTableObject?: ClassTable
  private arrayTypes: Map<string, [string, ArrayType, boolean]>
  private parentGlobalTable?: GlobalVariableNameTable

  constructor(parent?: GlobalVariableNameTable) {
    super(parent)
    this.arrayTypes = new Map<string, [string, ArrayType, boolean]>()
    this.parentGlobalTable = parent

    if (parent)
      this.classTableObject = undefined
    else
      this.classTableObject = new ClassTable()
  }

  override makeFreeInfo(free: VariableInfo) {
    return new FreeGlobalVariableInfo(free)
  }

  override classTable(): ClassTable {
    if (this.classTableObject)
      return this.classTableObject
    else if (this.parent)
      return this.parent.classTable()
    else
      throw new Error('fatal: not class table found')
  }

  // Array types are implicitly generated on demand when an array type is used.
  // getArrayTypes() returns all array types.
  getArrayTypes() { return this.arrayTypes }

  // useArrayType() returns [clazz_name_in_C, array_type, whether_it_must_be_declared_in_C].
  // The third element is false when the class type for the array is imported by 'extern'.
  useArrayType(type: ArrayType) {
    const name = type.name()
    const info = this.arrayTypes.get(name)
    if (info !== undefined)
      return info
    else {
      const found = this.findUsedArrayType(name)
      const info: [string, ArrayType, boolean]
        = [ found ? found[0] : `${prefixOfarrayTypeNameInC}${arrayTypeIndex++}`, type, !found ]
      this.arrayTypes.set(name, info)
      return info
    }
  }

  private findUsedArrayType(name: string) {
    let tbl = this.parentGlobalTable
    while (tbl !== undefined) {
      const info = tbl.arrayTypes?.get(name)
      if (info !== undefined)
        return info
      else
        tbl = tbl.parentGlobalTable
    }

    return undefined
  }
}

export function getVariableNameTable(node: AST.Node): NameTable<VariableInfo> {
  const vt = getNameTable<VariableInfo>(node)
  if (vt === undefined)
    throw new Error(`a symbol table is not available ${node}`)
  else
    return vt
}

// Variable Environment.

// This mainly manages memory allocation for local/global variables,
// in particular, when a variable is allocated in a local root set.
// It is a wrapper for NameTable<VariableInfo>.
export class VariableEnv {
  table: NameTable<VariableInfo>
  parent: VariableEnv | null

  constructor(table: NameTable<VariableInfo>, parent: VariableEnv | null) {
    this.table = table
    this.parent = parent
  }

  // returnType() returns null if this represents top-level.
  returnType(): StaticType | undefined | null {
    return this.table.returnType()
  }

  getNumOfVars(): number {
    if (this.parent)
      return this.parent.getNumOfVars()
    else
      throw new Error('cannot getNumOfVars')
  }

  // returns a new index
  allocate(): number {
    if (this.parent !== null)
      return this.parent.allocate()
    else
      throw new Error('cannot allocate')
  }

  deallocate(num: number) {
    this.parent?.deallocate(num)
  }

  allocateRootSet() {
    let num = 0
    this.table.forEach((info, key) => {
      if (info.isBoxed()
          || (!(info instanceof FreeVariableInfo) && !info.isTypeName
              && !isPrimitiveType(info.type))) {
        info.setIndex(this.allocate())
        num++
      }
    })
    return num
  }

  forEachBoxed(f: (i: VariableInfo, k: string) => void) {
    this.table.forEach((info, key) => {
      if (info.isBoxed())
        f(info, key)
    })
  }


  useArrayType(type: ArrayType): [ string, ArrayType, boolean ] {
    let env: VariableEnv | null = this
    while (env !== null)
      if (env.table instanceof GlobalVariableNameTable)
        return env.table.useArrayType(type)
      else
        env = env.parent

    throw new Error('internal error: cannot find a GlobalVariableNameTable for useArrayType()')
  }
}

export class FunctionEnv extends VariableEnv {
  numOfVars: number   // number of variables in the root set
  nextVar: number     // the next allocatable variable
  freeVars?: FreeVariableInfo[]

  constructor(table: NameTable<VariableInfo>, parent: VariableEnv | null) {
    super(table, parent)
    this.numOfVars = 0
    this.nextVar = 0
    this.freeVars = undefined
  }

  override getNumOfVars() { return this.numOfVars }

  override allocate() {
    const next = this.nextVar++
    if (this.numOfVars < this.nextVar)
      this.numOfVars = this.nextVar

    return next
  }

  override deallocate(num: number) { this.nextVar -= num }

  isFreeVariable(info: VariableInfo | undefined): info is FreeVariableInfo {
    return info instanceof FreeVariableInfo
  }

  getFreeVariables() {
    if (this.freeVars === undefined) {
      const vars: FreeVariableInfo[] = []
      this.table.forEach((info, k) => {
        if (info.isBoxedFreeVariable())
          vars.push(info)
      })
      this.freeVars = vars
    }
    return this.freeVars
  }
}

// GlobalEnv holds only GlobalVariableInfo or FreeGlobalVariableInfo.
export class GlobalEnv extends FunctionEnv {
  rootset: string

  constructor(table: NameTable<VariableInfo>, rootset: string) {
    super(table, null)
    this.rootset = rootset
  }

  override allocateRootSet() {
    let num = 0
    this.table.forEach((info, key) => {
      if (info instanceof GlobalVariableInfo) {
        if (isPrimitiveType(info.type)
            || (info.isFunction && info.type instanceof FunctionType)
            || (info.isTypeName && info.type instanceof InstanceType)) {
          // do nothing
        }
        else
          info.setIndex(num++, this.rootset)
      }
      else if (!(info instanceof FreeGlobalVariableInfo))
        throw new Error(`bad global info: ${key}, ${info.constructor.name}`)
    })
    return num
  }

  override forEachBoxed(f: (i: VariableInfo, k: string) => void) {
    // any global variable does not hold a boxed value.
  }

  // For a variable stored in a root set, f receives [info, c_name, undefined, index].
  // For other variables, f receives [info, c_name, type, undefined].
  // For a type name, f receives [info, undefined, type, undefined].
  forEachExternalVariable(f: (vinfo: VariableInfo, name?: string, type?: StaticType, index?: number) => void) {
    const set = new Set<VariableInfo>()
    this.table.forEach((info, key) => {
      if (info instanceof FreeGlobalVariableInfo) {
        const origInfo = info.original()
        if (origInfo instanceof GlobalVariableInfo) {
          // an imported class type may be included in this environment
          // with two different names.  One is a source-code name, and the other is
          // a fully-qualified name with a module ID.
          if (origInfo.isTypeName)
            if (set.has(origInfo))
              return
            else
              set.add(origInfo)

          const nameAndType = origInfo.externName(key)
          f(origInfo, nameAndType[0], nameAndType[1], nameAndType[2])
        }
        else
          throw new Error(`bad external name info: ${key}, ${origInfo.constructor.name}`)
      }
    })
  }
}
