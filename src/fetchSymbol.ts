import fs from 'fs';
import os from 'os';
import path from 'path';
import { dump } from './minidump';
import chalk from 'chalk';

const skipFileName = '.skip';

export const downloadSymbolIfNecessary = async (dumpPath: string, symbolDirPath: string): Promise<void> => {
  const fh = await fs.promises.open(dumpPath, 'r');
  const buf = Buffer.alloc(4);
  const { bytesRead } = await fh.read(buf, 0, 4, 0);
  if (bytesRead !== buf.length) {
    console.error(`not a minidump (file too short): ${chalk.blue(dumpPath)}`);
    process.exit(1);
  }

  if (buf.readUInt32BE(0) !== 0x4D444D50 /* MDMP */) {
    // Breakpad .dmp files have some http junk at the beginning.
    // read the first 16kb and look for MDMP to see if this is the case.
    const { buffer } = await fh.read({ position: 0 });
    for (let offset = 0; offset < buffer.length - 4; offset++) {
      if (buffer.readUInt32BE(offset) === 0x4D444D50) {
        // Found MDMP, write it to a tmp file
        const tmp = path.join(os.tmpdir(), 'electron-minidump-' + ((Math.random()*256*256*256)|0).toString(16).padStart(6, '0') + '.dmp');
        await new Promise((resolve, reject) => {
          fs.createReadStream(dumpPath, { start: offset })
            .on('end', resolve)
            .on('error', reject)
            .pipe(fs.createWriteStream(tmp));
        })
        await downloadSymbolIfNecessary(tmp, symbolDirPath);
        await fs.promises.unlink(tmp);
      }
    }
    fh.close();
    console.error(`not a minidump (MDMP header not found): ${chalk.blue(dumpPath)}`);
    process.exit(1);
  }

  fh.close();
  await findSymbols(symbolDirPath, dumpPath);
}

const SYMBOL_BASE_URLS = [
  'https://symbols.mozilla.org/try',
  'https://symbols.electronjs.org',
];

function fetchSymbol(
  directory: string,
  baseUrl: string,
  pdb: string,
  id: string,
  symbolFileName: string,
  file: string
) {
  const url = `${baseUrl}/${encodeURIComponent(pdb)}/${id}/${encodeURIComponent(symbolFileName)}`;
  const symbolPath = path.join(directory, pdb, id, symbolFileName);
  console.log(`start download the missing symbol, dump ${chalk.blue(file)}, symbol ${chalk.green(symbolFileName)}`);
  return new Promise((resolve, reject) => {
    // We use curl here in order to avoid having to deal with redirects +
    // gzip + saving to a file ourselves. It would be more portable to
    // handle this in JS rather than by shelling out, though, so TODO.
    const child = require('child_process').spawn('curl', [
      // We don't need progress bars.
      '--silent',

      // The Mozilla symbol server redirects to S3, so follow that
      // redirect.
      '--location',

      // We want to create all the parent directories for the target path,
      // which is breakpad_symbols/foo.pdb/0123456789ABCDEF/foo.sym
      '--create-dirs',

      // The .sym file is gzipped, but minidump_stackwalk needs it
      // uncompressed, so ask curl to ungzip it for us.
      '--compressed',

      // If we get a 404, don't write anything and exit with code 22. The
      // parent directories will still be created, though.
      '--fail',

      // Save the file directly into the cache.
      '--output', symbolPath,

      // This is the URL we want to fetch.
      url
    ]);

    child.once('close', (code: number) => {
      if (code === 0) {
        resolve(true);
      } else {
        // code === 22 means 404
        resolve(false);
      }
    })
  })
}

const findSymbols = async (directory: string, file: string) => {
  const r: string = await new Promise(resolve => {
    dump(file, (err, rep) => {
      resolve(rep!.toString('utf8'));
    })
  })

  // minidump_dump's output has lines like:
  //   (debug_file)                    = "user32.pdb"
  //   (debug_identifier)              = "034AFFE8331738A54EC07A7655CAF0DC1"
  // or on a linux dump:
  //   (debug_file)                    = "/XXXX/XXXXXX/XXXX/XXX/XXXXXXXXXXXXXXXX/libc.so.6"
  //   (debug_identifier)              = "4B76CFD3972F3EACFE366DDD07AD902F0"
  let m;
  const re = /\(debug_file\)\s+= "(?:.+\/)?([^"]+)"\s+\(debug_identifier\)\s+= "([0-9A-F]+)"/mg
  const modules = [];
  while (m = re.exec(r)) {
    const [, file, id] = m;
    modules.push([file, id]);
  }

  const promises = [];
  for (const [pdb, id] of modules) {
    if (/^0+$/.test(id)) continue
    const symbolFileName = pdb.replace(/(\.pdb)?$/, '.sym');
    const symbolSkipFilePath = path.join(directory, pdb, id, skipFileName);
    const symbolPath = path.join(directory, pdb, id, symbolFileName);
    if (!fs.existsSync(symbolPath) && !fs.existsSync(symbolSkipFilePath)) {
      promises.push((async () => {
        // try another baseurl if failed
        let success = false;
        for (const baseUrl of SYMBOL_BASE_URLS) {
          if (await fetchSymbol(directory, baseUrl, pdb, id, symbolFileName, file)) {
            success = true; 
            break;
          }
        }
        if (!success) {
          // write .skip file and next time skip this
          fs.writeFileSync(symbolSkipFilePath, '');
          throw new Error('failed to download symbol');
        }
      })())
    }
  }
  if (promises.length > 0) {
    console.log(`start download missing symbol, dump ${chalk.blue(file)}, total: ${chalk.greenBright(promises.length)}`);
    await Promise.allSettled(promises).then(result => {
      let successLength = 0;
      let failedLength = 0;
      result.forEach(r => {
        if (r.status === 'fulfilled') {
          // @ts-ignore
          successLength++;
        } else {
          failedLength++;
        }
      })
      console.log(`finish download missing symbol, dump ${chalk.blue(file)}, success: ${chalk.greenBright(successLength)}, failed: ${chalk.red(failedLength)}`);
    })
  }
}