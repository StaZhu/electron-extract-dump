import { resolve, basename } from 'path';
import { readdirSync, existsSync, readFileSync, renameSync, mkdirSync } from 'fs';

/**
 * Use Case:
 * 
 * Use the last function line name to cluster all crash files 
 * from the generated stacks.
 * 
 * Instruction:
 * 
 * 1. make sure you have already run 
 * `npm run stackwalk /path/to/your/dump/dir` 
 * and generated those stack file.
 * 
 * 2. then execute `npm run cluster /path/to/your/dump/dir`
 * to cluster the crash reason.
 * 
 * 3. open the `/path/to/your/dump/dir` and you will see
 * crash dump and stack are move to the folder named with
 * `last line function name`.
 */
const dumpDir = resolve(process.argv[2] || 'dump');
const stackPaths = readdirSync(dumpDir)
  .filter(path => path.endsWith('.stack.txt'))
  .map(path => resolve(dumpDir, path));

//  Thread 23 (crashed)
const crashStartLineReg = /^Thread (\d+) \(crashed\)$/;
const crashEndLineReg = /^Thread (\d+)$/;
const crashFunctionExtractReg = /\d  (.+)/;

(async () => {
  for (const stackPath of stackPaths) {
    try {
      const stackContent = readFileSync(stackPath)
        .toString()
        .split(/\r\n|\n/);
      const crashStartIndex = stackContent
        .findIndex(line => line.match(crashStartLineReg));
      const crashEndIndex = stackContent
        .findIndex(line => line.match(crashEndLineReg));
      const crashContent = stackContent
        .slice(crashStartIndex + 1, crashEndIndex - 1)
        .map(i => i.trim()).join('\n')
        .split(/Found by: .+\n/)

      const firstLine = (crashContent.find(i => !i.match(crashFunctionExtractReg)![1]
        .startsWith('0x')) || '')
        .split(/\r\n|\n/)[0]
        .match(crashFunctionExtractReg)![1]
        .replace(/\[.+\]/, '')
        .replace(/ \+ 0x(.+)/, '').trim();

      const dir = resolve(dumpDir, firstLine.slice(0, 200));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const mdRawPath = stackPath.replace('.stack.txt', '.dump.txt');
      const modulePath = stackPath.replace('.stack.txt', '.module.txt');
      const dumpPath = stackPath.replace('.stack.txt', '.dmp');
      
      existsSync(stackPath) && renameSync(stackPath, resolve(dir, basename(stackPath)));  
      existsSync(mdRawPath) && renameSync(mdRawPath, resolve(dir, basename(mdRawPath)));
      existsSync(modulePath) && renameSync(modulePath, resolve(dir, basename(modulePath)));
      existsSync(dumpPath) && renameSync(dumpPath, resolve(dir, basename(dumpPath)));
    } catch (e: unknown) {}
  }
})();