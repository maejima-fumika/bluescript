import { transpile } from '../transpiler/code-generator/code-generator'
import * as fs from 'fs'
import { FILE_PATH } from '../constants'


const cProlog = `
#include <stdint.h>
#include "../${FILE_PATH.C_RUNTIME_H}"
#include "../${FILE_PATH.PROFILER_H}"
`

function readModuleId(moduleName: string) {
  const moduleIds: {[name: string]: string} = JSON.parse(fs.readFileSync(FILE_PATH.MODULE_NAME_TO_ID).toString());
  const moduleId = moduleIds[moduleName];
    if (moduleId === undefined) {
      throw Error(`Cannot find module id corresponding to module name: ${moduleName}`);
    }
    return moduleId;
}

function main(moduleName: string) {
  const src = fs.readFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.bs`).toString();
  const result = transpile(0, src, undefined, undefined, readModuleId(moduleName)).code;
  fs.writeFileSync(`${FILE_PATH.MODULES}/${moduleName}/${moduleName}.c`, cProlog + result);
  console.log('done');
}

main(process.argv[2]);