# Gemini Image

一个用于产品白底图、场景图和局部精修的前端工具，支持上传产品图片后通过 Gemini 图像能力生成电商白底图、商业场景图、重绘修图和比例扩展图。

本地目录名是 `白底图/proshot-ai`，对应的 GitHub 仓库是 `gemini-image`。

## 核心功能

- 白底图生成：把产品图处理成纯白背景电商主图
- 场景图生成：把产品自然融入酒店卫浴、商场卫生间、办公空间等预设场景
- 自定义场景：输入自定义描述生成指定商业场景
- 局部精修：通过蒙版指定区域进行局部重绘或修复
- 比例扩展：扩展到 1:1、3:4、4:3、9:16、16:9 等目标比例
- 覆盖图合并：叠加额外素材并导出合成结果
- 历史记录：支持单图历史回退和侧边历史面板
- 导出控制：支持 JPG / PNG、原图或指定分辨率导出

## 技术栈

- React 19、TypeScript、Vite
- Gemini API
- `heic2any` 图片格式转换
- Nginx 静态部署

## 本地运行

### 环境要求

- Node.js 20+
- npm

### 安装依赖

```bash
npm ci
```

### 配置环境变量

在项目根目录创建 `.env.local`：

```bash
GEMINI_API_KEY=your_gemini_api_key
```

说明：

- 项目通过 `vite.config.ts` 把该值注入到前端
- 运行时也支持从浏览器 `localStorage` 的 `gemini_api_key` 读取密钥

### 启动开发环境

```bash
npm run dev
```

默认地址：

- 前端：`http://localhost:3000`

## 使用流程

1. 上传一张或多张产品图
2. 选择处理模式：白底图、场景图、扩图或精修
3. 选择场景预设，或填写自定义描述
4. 如需局部修改，在画布上绘制蒙版
5. 设置是否加阴影、生成张数、目标比例和导出格式
6. 调用 Gemini 生成结果并保存到历史
7. 下载最终导出图

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建结果 |

## Docker 部署

项目构建后由 Nginx 托管静态文件：

```bash
docker build -t gemini-image:latest .
docker run -d --name gemini-image -p 8080:80 gemini-image:latest
```

## 目录结构

```text
.
├── components/      # 上传、遮罩画布、历史面板、按钮等 UI
├── services/        # Gemini 图像生成与分析服务
├── App.tsx          # 主应用入口
├── types.ts         # 类型定义
├── Dockerfile
└── README.md
```

## 注意事项

- 这是前端直连 Gemini 的方案，密钥会在客户端环境中使用
- 白底图和场景图都依赖图像模型可用性与账户额度
- 如果没有配置密钥，分析与生成能力会降级或直接失败
- 当前本地目录没有 `.git` 元数据，所以仅修改本地文件并不会自动同步到 GitHub
