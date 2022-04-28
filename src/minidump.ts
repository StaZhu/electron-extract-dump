import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { readMinidump, streamTypes } from './format';

type ModuleInfo = {
  version?: string;
  name?: string | null;
  pdb_file_name?: string;
  debug_identifier?: string;
}

const exe = process.platform === 'win32' ? '.exe' : ''
const binDir = path.join(__dirname, '../bin', `${process.platform}-${process.arch}`)
const globalSymbolPaths: string[] = [];

const commands = {
  minidump_stackwalk: path.join(binDir, 'minidump_stackwalk') + exe,
  minidump_dump: path.join(binDir, 'minidump_dump') + exe,
  dump_syms: path.join(binDir, 'dump_syms') + exe
}

// we do not use this because the slow speed
function execute(command: string, args: string[], callback: (e: Error | null, r?: Buffer) => void) {
  let stdout = Buffer.alloc(0)
  let stderr = Buffer.alloc(0)
  const child = spawn(command, args)
  child.stdout.on('data', function (chunk) {
    stdout = Buffer.concat([stdout, chunk])
  })
  child.stderr.on('data', function (chunk) {
    stderr = Buffer.concat([stderr, chunk])
  })
  child.on('close', function (code) {
    if (code !== 0) {
      callback(stderr ? new Error(stderr.toString()) : new Error('Command `' + command + '` failed: ' + code), stdout)
    } else {
      callback(null, stdout)
    }
  })
}

// create child process speed must faster then spawn (execute)
function executeFile(command: string, args: string[], callback: (e: Error | null, r?: Buffer) => void) {
  execFile(command, args, { maxBuffer: Infinity }, (stderr, stdout) => {
    callback(stderr, stdout as unknown as Buffer)
  });
}

// macOS may have stderr and stdout when executre dump, so we reserce all of it here
function executeNoError(command: string, args: string[], callback: (e: Error | null, r?: Buffer) => void) {
  let stdout = Buffer.alloc(0);
  let stdErr = Buffer.alloc(0);
  const child = spawn(command, args);
  child.stdout.on('data', function (chunk) {
    stdout = Buffer.concat([stdout, chunk])
  })
  child.stderr.on('data', function (chunk) {
    stdErr = Buffer.concat([stdErr, chunk])
  });
  child.on('close', function (code) {
    callback(null, Buffer.concat([stdErr, stdout]))
  });
}

export const addSymbolPath = Array.prototype.push.bind(globalSymbolPaths)

export const moduleList = (minidump: string, callback: (e: NodeJS.ErrnoException | null, r?: ModuleInfo[]) => void) => {
  fs.readFile(minidump, (err: NodeJS.ErrnoException | null, data: Buffer) => {
    if (err) return callback(err)
    const { streams } = readMinidump(data)
    const moduleList = streams.find(s => s.type === streamTypes.MD_MODULE_LIST_STREAM)
    if (!moduleList) return callback(new Error('minidump does not contain module list'))
    const modules: ModuleInfo[] = moduleList.modules!.map(m => {
      const mod: ModuleInfo = {
        version: m.version,
        name: m.name
      }
      if (m.cv_record) {
        mod.pdb_file_name = m.cv_record.pdb_file_name
        mod.debug_identifier = m.cv_record.debug_file_id
      }
      return mod;
    })
    callback(null, modules)
  })
}

export const walkStack = (minidump: string, symbolPaths: string[], callback: (e: Error | null, r?: Buffer) => void, commandArgs: string[] = []) => {
  let stackwalk = commands.minidump_stackwalk
  let args = [minidump].concat(symbolPaths, globalSymbolPaths)
  args = commandArgs ? [...commandArgs].concat(args) : args
  executeFile(stackwalk, args, callback);
}

export const dump = (minidump: string, callback: (e: Error | null, r?: Buffer) => void, commandArgs: string[] = []) => {
  executeNoError(commands.minidump_dump, [minidump].concat(commandArgs || []), callback);
}

export const dumpSymbol = (binary: string, arch: string, callback: (e: Error | null, r?: Buffer) => void) => {
  const dumpsyms = commands.dump_syms;

  if (process.platform === 'win32' && (arch === 'ia32' || arch === 'x86')) {
    // windows ia32 can directly generate sym from pdb, so the binary here is pdb
    executeFile(dumpsyms, [binary], callback);
  } else if (process.platform === 'win32') {
    // windows x64's binary is the PE file of the pdb
    // so we have to put PE file in the same dir of pbd
    // example: electron.exe.pdb's PE file is electron.exe
    // notice: no matter pdb or pe file, do not modify the filename
    // we enum all posibility here
    // if .exe, .dll, .node all cant found, we throw the error
    executeFile(dumpsyms, [binary.replace('.pdb', '')], (e, r) => {
      if (e && e.message.includes('loadDataForPdb and loadDataFromExe failed')) {
        executeFile(dumpsyms, [binary.replace('.pdb', '.exe')], (e, r) => {
          if (e && e.message.includes('loadDataForPdb and loadDataFromExe failed')) {
            executeFile(dumpsyms, [binary.replace('.pdb', '.dll')], (e, r) => {
              if (e && e.message.includes('loadDataForPdb and loadDataFromExe failed')) {
                executeFile(dumpsyms, [binary.replace('.pdb', '.node')], (e, r) => {
                  callback(e, r);
                });
              } else {
                callback(e, r);
              }
            });
          } else {
            callback(e, r);
          }
        });
      } else {
        callback(e, r);
      }
    });
  } else if (process.platform === 'linux') {
    // linux's binary is the PE file of .debug
    executeFile(dumpsyms, ['-r', '-c', binary.replace('.debug', '')], callback);
  } else {
    // mac's binary is dSYM, since we can directly use dSYM to generate sym
    executeFile(dumpsyms, ['-r', '-c', binary], callback)
  }
}
