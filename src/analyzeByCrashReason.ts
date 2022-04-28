import { resolve } from 'path';
import { readdirSync, readFileSync } from 'fs';

/**
 * Use Case:
 * 
 * Analyze crash reason and count from the generated stacks.
 * 
 * Instruction:
 * 
 * 1. make sure you have already run 
 * `npm run stackwalk /path/to/your/dump/dir`
 * and generated those stack file.
 * 
 * 2. then execute `npm run analyze /path/to/your/dump/dir`
 * to analyze crash reason and count
 */
const dumpDir = resolve(process.argv[2] || 'dump');
const stackPaths = readdirSync(dumpDir)
  .filter(path => path.endsWith('.stack.txt'))
  .map(path => resolve(dumpDir, path));

const crashReasonReg = /^Crash reason\:  (.+)$/;
const reasonMap: Map<string, number> = new Map<string, number>();

(async () => {
  for (const stackPath of stackPaths) {
    const stackContent = readFileSync(stackPath)
      .toString()
      .split(/\r\n|\n/);

    const reason = stackContent.find(i => i.startsWith('Crash reason:'))?.match(crashReasonReg)![1] || '';
    const count = reasonMap.get(reason);
    reasonMap.set(reason, count ? count + 1 : 1);
  }
  console.table([...reasonMap.entries()].map(i => ({ 'Crash Reason': i[0], 'Count': i[1] })).sort((a, b) => b['Count'] - a['Count']), ['Crash Reason', 'Count']);
})();