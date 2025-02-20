import { transpile } from '../transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { GlobalVariableNameTable } from '../transpiler/code-generator/variables'
import { FILE_PATH } from '../constants'
import Session from "../server/session";


const cProlog = `
#include <stdint.h>
#include "c-runtime.h"
`

let sessionId = 0;
const modules: Map<string, GlobalVariableNameTable> = new Map();
let globalNameTable = transpile(++sessionId, '').names;

function main(moduleName: string) {
  const importer = (fname: string) => {
    const mod = modules.get(fname);
    if (mod)
      return mod;
    else {
      const ffi = fs.readFileSync(`${FILE_PATH.MODULES}/${fname}/${fname}.bs`).toString();
      const moduleId = Session.moduleNameToId(fname);
      const result = transpile(++sessionId, ffi, globalNameTable, importer, moduleId);
      modules.set(fname, result.names);
      return result.names;
    }
  }

  const src = fs.readFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.bs`).toString()
  const result = transpile(++sessionId, src, globalNameTable, importer, Session.moduleNameToId(moduleName)).code
  fs.writeFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.c`, cProlog + result)
  console.log('done')
}

main(process.argv[2]);