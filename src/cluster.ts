import { resolve, basename } from 'path';
import { readdirSync, existsSync, readFileSync, renameSync, copyFileSync, mkdirSync } from 'fs';

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
 * 3. open the `cluster` folder and you will see
 * crash dump and stack in that folder named with
 * `(total: ${count}) ${last line function name}`.
 */
const dumpDir = resolve(process.argv[2] || 'dump');
const outDir = resolve('cluster');
const stackPaths = readdirSync(dumpDir)
  .filter(path => path.endsWith('.stack.txt'))
  .map(path => resolve(dumpDir, path));

const COPY_FOLDER = true;

//  Thread 23 (crashed)
const crashStartLineReg = /^Thread (\d+) \(crashed\)$/;
const crashEndLineReg = /^Thread (\d+)$/;
const crashFunctionExtractReg = /\d  (.+)/;
const folderNameMap = new Map<string, number>();

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

      const folderName = firstLine.slice(0, 200);
      const dir = resolve(outDir, folderName);  
      const mdRawPath = stackPath.replace('.stack.txt', '.dump.txt');
      const modulePath = stackPath.replace('.stack.txt', '.module.txt');
      const dumpPath = stackPath.replace('.stack.txt', '.dmp');
      const stackToPatch = resolve(dir, basename(stackPath));
      const mdRawToPath = resolve(dir, basename(mdRawPath));
      const moduleToPath = resolve(dir, basename(modulePath));
      const dumpToPath = resolve(dir, basename(dumpPath));

      const count = folderNameMap.get(folderName) as number;
      folderNameMap.set(folderName, count ? count + 1 : 1);
      
      if (COPY_FOLDER) {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
  
        existsSync(stackPath) && !existsSync(stackToPatch) && copyFileSync(stackPath, stackToPatch);
        // existsSync(mdRawPath) && !existsSync(mdRawToPath) && copyFileSync(mdRawPath, mdRawToPath);
        // existsSync(modulePath) && !existsSync(moduleToPath) && copyFileSync(modulePath, moduleToPath);
        // existsSync(dumpPath) && !existsSync(dumpToPath) && copyFileSync(dumpPath, dumpToPath);
      }
    } catch (e: unknown) {}
  }

  if (COPY_FOLDER) {
    for (const [_folderName, count] of folderNameMap.entries()) {
      const folderPath = resolve(outDir, _folderName);
      const folderPathWithCount = resolve(outDir, `(total ${count}) ${_folderName}`);
      if (existsSync(folderPath)) {
        renameSync(folderPath, folderPathWithCount);
      }
    }
  }

  const table = [...folderNameMap.entries()].map(i => ({ 'Crash Line': i[0], 'Count': i[1] })).sort((a, b) => b['Count'] - a['Count']);
  console.table(table)
})();