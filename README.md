## 启动方式

先安装前端依赖：

```powershell
npm install
```

再安装后端依赖：

```powershell
npm run backend:install
```

启动后端：

```powershell
npm run dev:backend
```

另开一个终端，启动前端：

```powershell
npm run dev
```

## 构建 PicoC WASM

先将 PicoC 源码放入：

```txt
third_party/picoc
```

然后执行：

```powershell
npm run build:picoc
```

生成文件位于：

- `public/wasm/picoc.js`
- `public/wasm/picoc.wasm`

