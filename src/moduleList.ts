
import { moduleList } from './minidump';
import { resolve } from 'path';
import { writeFileSync, readdirSync } from 'fs';
import chalk from 'chalk';

/**
 * Use Case
 * 
 * Enum all the dynamic link files and version stored in `.dmp` file
 * to `.module.txt`.
 *
 * Instruction
 * 1. `wget -i list.txt`, and download those `.dmp` files.
 * 2. put `.dmp` files to `/path/to/your/dump/dir` (Default: `dump`).
 * 3. then execute `npm run modulelist /path/to/your/dump/dir`.
 * 4. open the `/path/to/your/dump/dir` and debug those `.module.txt` stack.
 */
const dumpDir = resolve(process.argv[2] || 'dump');
const dumpPath = readdirSync(dumpDir)
  .filter(path => path.endsWith('.dmp'))
  .map(path => resolve(dumpDir, path));

for (const symPath of dumpPath) {
  const dumpOutPath = symPath.replace('.dmp', '.module.txt');

  console.log(`start parse module list, dump ${chalk.blue(symPath)}`);
  moduleList(symPath, (e, r) => {
    if (e) {
      console.error(e);
      process.exit(1);
    }
    if (r) {
      writeFileSync(dumpOutPath, JSON.stringify(r, null, 2));
      console.log(`finish parse module list, output ${chalk.blueBright(dumpOutPath)}`)
    }
  });
}
