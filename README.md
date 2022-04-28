# electron-extract-dump

A tool to batch extract stack info from dmp + sym file to human readable content.

##### English | [简体中文](./README.zh_CN.md)

## Extract Crash Stack from a `.dmp`

### Use Case
batch parse the exeception stack of C++ code on Chromium/Electron/Node Addon from  `.dmp` file.

### Instruction
1. `wget -i list.txt`, and download those `.dmp` files.
2. put `.dmp` files to `/path/to/your/dump/dir` (Default: `dump`).
3. unzip `electron-v{version}-{platform}-{arch}-symbols.zip` of each platforms and arches and then copy all the files/folder from `breakpad_symbol` to `/path/to/electron-extract-dump/symbols` (must make sure the structure looks like `filename` - `breakpadId` - `filename.sym`).
4. then execute `npm run stackwalk /path/to/your/dump/dir`.
5. open the `/path/to/your/dump/dir` and debug those `.stack.txt` stack.

##### Notice: you can only do this on a Mac or Linux!!

## Convert Debug Symbol (`.dSYM` , `.pdb` , `.debug`) to `.sym`

### Use Case
Sometimes, we may need to use debug symbol to generate `.sym`, this is for it.

### Instruction
1. put those `.pdb` or `.dSYM` or `.debug` into `/path/to/your/debug-symbols/dir/electron-v${electronVersion}/${platform}-${arch}` dir.
2. then execute `npm run extract /path/to/your/debug-symbols/dir`
3. the `.sym` file will be auto generated to `symbols/electron-v${electronVersion}/${platform}-${arch}/${name}/${crashpadId}` dir.
4. and then you can use those `.sym` to stackwalk the `.dmp` file.

##### Notice 1: Different platfrom debug symbol can only be converted on the corresponding platform, eg: you can only use a Windows Pc to operate conversion from `.pdb` to `.sym`.

##### Notice 2: If windows shows you a `can't find dll` error, you may need to execute `regsvr32 \path\to\electron-extract-dump\dll\win32-x64\msdia140.dll`.

##### Notice 3: If you are trying to convert a x64 `.pdb` file, then you must put the `PE` file (eg: electron.exe.pdb 's `PE` file is electron.exe) nearby that `.pdb`. for x86 (ia32)  arch, `PE ` file is not the necessary part.

## Extract MDRaw from a `.dmp` 

### Use Case
Convert a `.dmp` file and get the minidump raw content from it, if you use `crashReport.start` with `globalExtra` passed, this will help you get those args.

### Instruction
1. `wget -i list.txt`, and download those `.dmp` files.
2. put `.dmp` files to `/path/to/your/dump/dir` (Default: `dump`).
3. then execute `npm run dump /path/to/your/dump/dir`.
4. open the `/path/to/your/dump/dir` and debug those `.dump.txt` stack.

## Enum the dynamic link files and versions stored in `.dmp` 

### Use Case
Enum all the dynamic link files and version stored in `.dmp` file
to `.module.txt`.

### Instruction
1. `wget -i list.txt`, and download those `.dmp` files.
2. put `.dmp` files to `/path/to/your/dump/dir` (Default: `dump`).
3. then execute `npm run modulelist /path/to/your/dump/dir`.
4. open the `/path/to/your/dump/dir` and debug those `.module.txt` stack.

## Analyse the crash reason & count

### Use Case
Analyze crash reason and count from the generated stacks.

### Instruction
1. make sure you have already run `npm run stackwalk /path/to/your/dump/dir` and generated those stack file.
2. then execute `npm run analyze /path/to/your/dump/dir` to analyze crash reason and count.

## Cluster crash from `.stack.txt`

### Use Case
Use the last function line name to cluster all crash files from the generated stacks.

### Instruction
1. make sure you have already run `npm run stackwalk /path/to/your/dump/dir` and generated those stack file.
2. then execute `npm run cluster /path/to/your/dump/dir` to cluster the crash reason.
3. open the `cluster` folder and you will see crash dump and stack in that folder named with `(total: ${count}) ${last line function name}`.

## License

MIT