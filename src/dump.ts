
import { dump } from './minidump';
import { resolve } from 'path';
import { writeFileSync, readdirSync } from 'fs';
import chalk from 'chalk';

/**
 * Use Case
 * 
 * Convert a `.dmp` file and get the minidump raw content from it,
 * if you use `crashReport.start` with `globalExtra` passed,
 * this will help you get those args.
 * 
 * Instruction
 *
 * 1. `wget -i list.txt`, and download those `.dmp` files.
 * 2. put `.dmp` files to `/path/to/your/dump/dir` (Default: `dump`).
 * 3. then execute `npm run dump /path/to/your/dump/dir`.
 * 4. open the `/path/to/your/dump/dir` and debug those `.dump.txt` stack.
 */
const dumpDir = resolve(process.argv[2] || 'dump');
const dumpPaths = readdirSync(dumpDir)
  .filter(path => path.endsWith('.dmp'))
  .map(path => resolve(dumpDir, path));

for (const dumpPath of dumpPaths) {
  const outPath = dumpPath.replace('.dmp', '.dump.txt');

  dump(dumpPath, (e, r) => {
    if (e) {
      console.error(e);
      process.exit(1);
    }
    if (r) {
      writeFileSync(outPath, r);
      console.log(`dump -> mdRaw success, output: ${chalk.blueBright(outPath)}`)
    }
  });
}
