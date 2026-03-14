# InkVision — MVP 开发文档

---

## 目标

用最少代码最快上线，验证用户是否愿意为 AI 纹身设计付费。

---

## MVP 只做 4 件事

| # | 功能 | 用户动作 | 结果 |
|---|------|---------|------|
| 1 | 落地页 | 访问网站 | 看到产品介绍，点击开始 |
| 2 | AI 生成纹身 | 输入描述 + 选风格 | 得到 4 张 AI 纹身图 |
| 3 | 身体预览 | 上传照片 + 拖拽纹身 | 看到纹身在自己身上的效果（带水印） |
| 4 | 付费下载 | 点击下载 + PayPal 付款 | 获得无水印高清图 |

---

## MVP 不做的事

- ~~用户注册/登录~~
- ~~设计历史保存~~
- ~~画廊社区~~
- ~~社交分享~~
- ~~纹身师目录~~
- ~~月订阅~~

---

## 技术方案

### 前端
- 单个 `index.html` + `styles.css` + `app.js`
- 纯原生 JS，不用任何框架
- 移动端自适应

### AI 生成
- Firebase Cloud Function 作为中间层
- Cloud Function 调用 Replicate API（隐藏 API Key）
- 模型：SDXL 或 Flux，加纹身风格 prompt 模板
- 每次请求生成 4 张图

### 身体预览
- HTML Canvas API
- 支持：拖拽位置、缩放大小、旋转角度、调整透明度
- 支持鼠标和触摸操作
- 免费预览叠加 "INKVISION" 水印

### 收款
- PayPal Checkout SDK（前端 JS 直接调用）
- 付款成功后前端去掉水印允许下载
- MVP 阶段暂不做服务端支付验证（Phase 2 再加）

### 部署
- GitHub Pages（免费）
- Cloud Functions 部署在 Firebase（免费额度）

---

## 页面结构

一个单页应用，从上到下 5 个区块：

```
┌────────────────────────────┐
│         导航栏              │
├────────────────────────────┤
│         Hero 区域           │
│   标题 + 副标题 + CTA 按钮  │
├────────────────────────────┤
│       AI 纹身生成器          │
│  左：输入框 + 风格选择 + 按钮 │
│  右：4 张生成结果（带水印）   │
├────────────────────────────┤
│        身体预览编辑器        │
│  左：Canvas 画布（照片+纹身）│
│  右：大小/旋转/透明度 滑块   │
│      + 下载按钮（免费/付费）  │
├────────────────────────────┤
│         定价区域             │
│   免费 / $2单张 / $5十张     │
├────────────────────────────┤
│          页脚               │
└────────────────────────────┘
```

---

## 用户使用流程

```
访问网站
  │
  ▼
看到 Hero 区域 → 点击 "Design My Tattoo"
  │
  ▼
输入纹身描述（如 "a wolf on forearm, fine line style"）
选择风格 + 身体部位
点击 "Generate"
  │
  ▼
等待 2-5 秒 → 显示 4 张 AI 生成的纹身设计（带水印）
  │
  ▼
点击喜欢的设计 → 设计出现在下方预览区
  │
  ▼
上传自己的照片
拖拽纹身到想要的位置
调整大小、旋转、透明度
  │
  ├── 点击 "免费下载" → 得到带水印的预览图
  │
  └── 点击 "下载高清 $2" → PayPal 弹窗 → 付款 → 得到无水印高清图
```

---

## 文件清单

```
InkVision/
├── index.html          # 唯一页面
├── styles.css          # 样式
├── app.js              # 所有前端逻辑
├── functions/
│   └── index.js        # Cloud Function（Replicate API 代理）
├── PRD.md              # 完整产品需求文档
├── MVP.md              # 本文档
└── README.md           # 项目说明
```

---

## AI Prompt 模板

生成纹身时，用户输入会被包装成以下 prompt 发给 AI：

```
tattoo design, {用户描述}, {风格} style,
black and white, on white background,
clean lines, tattoo flash sheet,
high detail, professional tattoo design
```

示例：
```
tattoo design, a wolf howling at the moon,
fine line style, black and white,
on white background, clean lines,
tattoo flash sheet, high detail,
professional tattoo design
```

---

## 风格列表（10 种）

| 风格 | 英文 | Prompt 关键词 |
|------|------|-------------|
| 细线 | Fine Line | fine line, delicate, thin lines |
| 传统 | Traditional | american traditional, bold outlines, vivid colors |
| 日式 | Japanese | irezumi, waves, koi, dragon |
| 部落 | Tribal | tribal, bold black, symmetrical patterns |
| 水彩 | Watercolor | watercolor splashes, soft edges, colorful |
| 黑工 | Blackwork | blackwork, heavy black ink, geometric |
| 极简 | Minimalist | minimalist, simple, single line |
| 新传统 | Neo-Traditional | neo traditional, detailed, decorative |
| 点刺 | Dotwork | dotwork, stipple, dots creating texture |
| 写实 | Realistic | photorealistic, detailed shading, 3D |

---

## 定价

| 选项 | 价格 | 内容 |
|------|------|------|
| 免费 | $0 | 3 次生成，带水印预览下载 |
| 单张高清 | $2 | 无水印高清下载 |
| 十张套餐 | $5 | 10 次生成 + 无水印高清下载 |

---

## 需要的 Key

| Key | 用途 | 放在哪里 |
|-----|------|---------|
| Replicate API Token | AI 生成纹身图片 | Cloud Function 环境变量 |
| PayPal Client ID | 收款 | 前端 JS（安全） |
| Firebase Config | 连接 Firebase 服务 | 前端 JS（安全） |

---

## 上线检查清单

- [ ] 落地页在手机上显示正常
- [ ] AI 生成能返回 4 张图片
- [ ] Canvas 预览拖拽/缩放/旋转正常
- [ ] 水印正确显示在免费下载中
- [ ] PayPal 付款流程走通（先用 Sandbox 测试）
- [ ] 付款后能下载无水印高清图
- [ ] GitHub Pages 部署成功
- [ ] Cloud Function 部署成功
- [ ] 页面加载速度 < 3 秒
