
import { dumpSymbol } from './minidump';
import { resolve, dirname, basename } from 'path';
import { writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import chalk from 'chalk';

/**
 * Use Case
 * 
 * Sometimes, we may need to use debug symbol to generate `.sym`.
 * this is for it.
 *
 * Instruction
 * 
 * 1. put thos `.pdb` or `.dSYM` or `.debug` into 
 * `/path/to/your/debug-symbols/dir/electron-v${electronVersion}/${platform}-${arch}` dir.
 * 2. then execute `npm run extract /path/to/your/debug-symbols/dir`
 * 3. the `.sym` file will be auto generated to 
 * `symbols/electron-v${electronVersion}/${platform}-${arch}/${name}/${crashpadId}`dir.
 * 4. and then you can use those `.sym` to stackwalk the `.dmp` file.
 */
type DebugSymbolFormat = '.pdb' | '.debug' | '.dSYM';
type NodeJSArch = 'x64' | 'ia32' | 'arm64';
const debugSymbolsPath = resolve(process.argv[2] || './debug-symbols');
const platform = process.platform;
let count = 0;

const getArchFromDirname = (dirpath: string): NodeJSArch => {
  if (dirpath.endsWith('ia32') || dirpath.endsWith('x86')) {
    return 'ia32';
  } else if (dirpath.endsWith('x64') || dirpath.endsWith('x86_64')) {
    return 'x64';
  } else if (dirpath.endsWith('arm64')) {
    return 'arm64';
  } else {
    throw new Error('directionary must ends with x64, ia32, or arm64');
  }
}

const getFormatFromPlatform = (platform: NodeJS.Platform): DebugSymbolFormat => {
  switch (platform) {
    case 'win32':
      return '.pdb';
    case 'darwin':
      return '.dSYM';
    case 'linux':
      return '.debug';
    default:
      throw new TypeError(`platform: ${platform} not supported`);
  }
}

if (existsSync(debugSymbolsPath)) {
  const electronVersionPaths = readdirSync(debugSymbolsPath)
    .filter(path => statSync(resolve(debugSymbolsPath, path)).isDirectory())
    .map(path => resolve(debugSymbolsPath, path));

  for (const electronVersionPath of electronVersionPaths) {
    const debugSymbolsDirPaths = readdirSync(electronVersionPath)
      .filter(path => path.startsWith(platform))
      .map(path => resolve(electronVersionPath, path));

    for (const debugSymbolDir of debugSymbolsDirPaths) {
      const debugSymbolsPaths = readdirSync(debugSymbolDir)
        .filter(path => path.endsWith(getFormatFromPlatform(platform)))
        .map(path => resolve(debugSymbolDir, path));

      for (const path of debugSymbolsPaths) {
        const debugSymbolFormat = getFormatFromPlatform(platform);
        const distSymPath = path.replace(debugSymbolFormat, '.sym').replace('debug-symbols', 'symbols');
        const distSymDir =  dirname(distSymPath); // windows still reserve pdb
        const distSymFile = basename(distSymPath);
        if (existsSync(resolve(distSymDir, distSymFile.replace('.sym', platform === 'win32' ? '.pdb' : '')))) {
          console.log(`skip convert debug symbol, the dict already exists, file: ${chalk.blue(path)}`);
          continue;
        }
        console.log(`start convert debug symbol, file: ${chalk.blue(path)}`);
        count++;
        dumpSymbol(path, getArchFromDirname(distSymDir), (e, r) => {
          if (e) {
            if (e.message.includes('loadDataForPdb and loadDataFromExe failed')) {
              console.log(`skip convert debug symbol, can't find PE file, file: ${chalk.blue(path)}`);
            } else {
              console.error(e);
              process.exit(1);
            }
          }
          if (r) {
            count--;
            const firstLine = r.toString().split('\n')[0];
            const [module, p, arch, crashpadId, ...filenames] = firstLine.split(' ').map(i => i.trim());
            const distFinalDir = resolve(distSymDir, distSymFile.replace('.sym', platform === 'win32' ? '.pdb' : ''), crashpadId);
            const distFinalPath = resolve(distFinalDir, distSymFile);
            if (!existsSync(distFinalDir)) {
              mkdirSync(distFinalDir, {
                recursive: true
              });
            }
            writeFileSync(distFinalPath, r);
            console.log(`successfully convert debug symbol, output: ${chalk.blueBright(distFinalPath)}, remain: ${chalk.green(count)}`);
          }
        })
      }
    }
  }
}


