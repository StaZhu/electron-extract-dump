# electron-extract-dump

一个用来批处理解析Electron native崩溃堆栈的实用工具。

##### 简体中文 | [English](./README.md)

## 将 `.dmp` 批量转换为堆栈

### 场景
自动批处理解析 `.dmp` 的C++崩溃堆栈 (Chromium, Electron, 或者 Node Addon)。

### 用法
1. `wget -i list.txt`，批量下载好要解析的.dmp文件。
2. 将.dmp放到你希望解析的dump目录 (默认：dump)。
3. 将symbol目录解压缩，并将breakpad_symbol目录内容拷贝出来，需要确保包含.sym的文件夹按格式放置到Symbol目录 (必须按照 `文件名` - `breakpadId` - `文件名.sym`格式存放)。
4. 执行 `npm run stackwalk /path/to/your/dump/dir`。
5. 打开dump目录，获取生成的文件。

##### 注：只支持在mac、Linux进行解析!!

## 将原始符号(`.dSYM` , `.pdb` , `.debug`)转换为 `.sym`

### 场景
有些时候，可能因为一些原因没生成sym或者生成错了，此时可以利用本工具基于原始符号表生成breakpad `.sym` 文件。

### 用法
1. 将 `.pdb` 或者 `.dSYM` 或 `.debug` 放到 `/path/to/your/debug-symbols/dir/electron-v${electronVersion}/${platform}-${arch}` 目录 (默认：debug-symbols)下。
2. 执行 `npm run extract /path/to/your/debug-symbols/dir`。
3. `.sym` 会自动生成到 `symbols/electron-v${electronVersion}/${platform}-${arch}/${name}/${crashpadId}` 目录下。
4. 之后你可以用 `.sym` 到分析崩溃stack。

##### 注1：不同平台的原始符号只能在对应的平台转换，不可跨平台转换，比如pdb转sym只能在windows电脑进行, dSYM只能在mac电脑进行。

##### 注2：Windows报找不到dll，需要运行 `regsvr32 \path\to\electron-extract-dump\dll\win32-x64\msdia140.dll`。

##### 注3：如果符号表是 `.pdb` 且架构是x64的，则需要同时把 `.pdb` 对应的 `PE` 文件（例如electron.exe.pdb对应的 `PE` 文件是electron.exe）放到目录内才可以解析，如果是x86 (ia32) 的无需这一步。

## 提取 `.dmp` 的MDRaw信息

#### 场景

将electron的原始内存信息提取出来。如果有用到 `crashReport.start()` 并附带了 `globalExtra`，则执行该命令可以将 `globalExtra` 参数暴露出来。

### 用法
1. `wget -i list.txt`，批量下载好要解析的 `.dmp` 文件。
2. 将 `.dmp` 放到你希望解析的dump目录 (默认：dump)。
3. 执行 `npm run dump /path/to/your/dump/dir`。
4. 打开 `/path/to/your/dump/dir`, 并debug生成的 `xxx.dump.txt`。

## 提取 `.dmp` 引用的动态链接库路径和版本号

### 场景
将electron所引用的动态链接库位置与版本号枚举出来。

### 用法
1. `wget -i list.txt`，批量下载好要解析的.dmp文件。
2. 将 `.dmp` 放到 `/path/to/your/dump/dir` (默认：dump)。
3. 执行 `npm run modulelist /path/to/your/dump/dir`。
4. 打开 `/path/to/your/dump/dir` 并debug生成的 `.module.txt` 。

## 统计崩溃原因统计数量

### 场景
利用生成好的 `.stack.txt`，统计不同的崩溃原因和其数量。

### 用法
1. 先利用 `npm run stackwalk /path/to/your/dump/dir` 解析好崩溃dump。
2. 执行 `npm run analyze /path/to/your/dump/dir` 对崩溃原因和数量进行统计。

## 将解析后的堆栈聚类

### 场景
利用生成好的 `.stack.txt`，按照崩溃的函数名，建立文件夹，并将文件复制过去，用于统计。

### 用法
1. 先利用 `npm run stackwalk /path/to/your/dump/dir` 解析好崩溃dump。
2. 执行 `npm run cluster /path/to/your/dump/dir` 对崩溃聚类。
3. 打开 `/path/to/your/dump/dir`，获取按函数名聚类后的目录。

## License

MIT

