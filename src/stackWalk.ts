
import { walkStack, dump } from './minidump';
import { resolve } from 'path';
import { cpus } from 'os'
import { writeFileSync, readdirSync, existsSync, watch } from 'fs';
import { downloadSymbolIfNecessary } from './fetchSymbol';
import chalk from 'chalk';

const FORCE = false;
const BATCH_TASK_COUNT = cpus().length * 8;
// whether or not extract MDRAW as well (default: false)
const NEED_EXTRACT_MDRAW = false;

/**
 * Use Case
 * 
 * batch parse the exeception stack of C++ code on 
 * Chromium/Electron/Node Addon from `.dmp` file.
 *
 * Instruction
 * 
 * 1. `wget -i list.txt --tries=3 --continue ‐‐no-clobber`, and download those `.dmp` files.
 * 2. put `.dmp` files to `/path/to/your/dump/dir` (Default: `dump`).
 * 3. unzip `electron-v{version}-{platform}-{arch}-symbols.zip` of each platforms and arches and then copy all the files/folder from `breakpad_symbol` to `/path/to/electron-extract-dump/symbols` (must make sure the structure looks like `filename` - `breakpadId` - `filename.sym`).
 * 4. then execute `npm run stackwalk /path/to/your/dump/dir`.
 * 5. open the `/path/to/your/dump/dir` and debug those `.stack.txt` stack.
 */
const dumpDir = resolve(process.argv[2] || 'dump');
const dumpPaths = readdirSync(dumpDir)
  .filter(path => path.endsWith('.dmp'))
  .map(path => resolve(dumpDir, path));
let count = 0;

const walkStackDump = async (dumpPath: string, stackPath: string) => {
  const symbolPath = resolve('./symbols/');
  await downloadSymbolIfNecessary(dumpPath, symbolPath);
  await new Promise((resolve, reject) => {
    console.log(`stackwalk start, dump ${chalk.blue(dumpPath)}`);
    walkStack(dumpPath, [symbolPath], (e, r) => {
      if (e) {
        reject(e);
        process.exit(1);
      }
      if (r) {
        count--;
        writeFileSync(stackPath, r);
        console.log(`stackwalk finished, output ${chalk.blueBright(stackPath)}, remain: ${chalk.green(count)}`);
        resolve(true);
      }
    });
  })
}

(async () => {
  const promises: Array<() => Promise<void>> = [];

  const pushToPromises = (dumpPath: string) => {
    const dumpOutPath = dumpPath.replace('.dmp', '.dump.txt');
    const stackPath = dumpPath.replace('.dmp', '.stack.txt');

    // we can skip those already parsed one
    if (existsSync(stackPath) && !FORCE) {
      return true;
    }
    
    if (NEED_EXTRACT_MDRAW) {
      if (existsSync(dumpOutPath)) {
        count++;
        promises.push(async () => {
          await walkStackDump(dumpPath, stackPath);
        });
      } else {
        count++;
        promises.push(async () => {
          console.log(`extract MDRaw start, dump ${chalk.blue(dumpPath)}`);
          await new Promise((resolve, reject) => {
            dump(dumpPath, async (e, r: Buffer | undefined) => {
              if (r) {
                writeFileSync(dumpOutPath, r);
                console.log(`extract MDRaw success, output ${chalk.blueBright(dumpOutPath)}`)
                await walkStackDump(dumpPath, stackPath);
                resolve(true);
              } else {
                const e = new Error(`extract MDRaw failed, please check the file itself, dump ${chalk.blue(dumpPath)}`);
                console.error(e.message);
                reject(e);
              }
            })
          })
        });
      }
    } else {
      count++;
      promises.push(async () => {
        await walkStackDump(dumpPath, stackPath);
      });
    }
  }

  for (const dumpPath of dumpPaths) {
    pushToPromises(dumpPath);
  }

  let promisesCount = promises.length
  if (promisesCount) {
    console.log(`total file count: ${chalk.green(promisesCount)}`)
  }

  watch(dumpDir, (e, filename: string) => {
    if (e === 'rename' && filename.endsWith('.dmp')) {
      const newFilePath = resolve(dumpDir, filename);
      if (!dumpPaths.includes(newFilePath)) {
        dumpPaths.push(newFilePath);
        if (!pushToPromises(newFilePath)) {
          promisesCount++;
          console.log(`new file: ${chalk.blue(newFilePath)} added!, total count: ${chalk.green(promisesCount)}`,);
        }
      }
    }
  });

  const startTime = Date.now();
  let i = 0;

  const checkPromisesCountAndExecute = () => {
    return new Promise(resolve => {
      while (promises.length && i < BATCH_TASK_COUNT) {
        const task = promises.shift();
        if (task) {
          i++;
          task().finally(() => {
            i--;
            checkPromisesCountAndExecute().then(() => {
              if (!promises.length && i === 0) {
                resolve(true);
              }
            })
          });
        }
      }
      if (!promises.length && i === 0) {
        resolve(true);
      }
    })
  }

  await checkPromisesCountAndExecute();

  const endTime = Date.now();
  const eachTooks = Math.floor((endTime - startTime) / promisesCount);
  console.log(`total file count: ${chalk.green(promisesCount)}, total tooks: ${chalk.blue(endTime - startTime)} ms, each file tooks: ${chalk.greenBright((!isNaN(eachTooks) && eachTooks !== Infinity) ? eachTooks : 0)} ms`);
})();