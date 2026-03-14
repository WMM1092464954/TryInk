# InkVision — AI 纹身预览与设计

## 产品需求文档 (PRD)

---

## 1. 产品概述

**名称：** InkVision
**标语：** 纹身之前，先看效果
**描述：** AI 驱动的纹身设计生成器 + 身体实时预览。用户描述想要的纹身，AI 生成多个设计，上传照片即可预览纹身在自己身上的效果。

**目标用户：** 英语用户（18-40岁），纹身爱好者，第一次想纹身的人，寻找设计灵感的纹身师。

**核心价值：** 消除纹身后悔——先试再纹。

---

## 2. 技术栈

| 层级 | 技术 | 成本 |
|------|------|------|
| 前端 | HTML / CSS / JavaScript | 免费 |
| 部署 | GitHub Pages → 后期 Vercel/Cloudflare | 免费 |
| 后端 | Firebase（Auth + Firestore + Storage + Cloud Functions） | 免费额度 |
| AI 生成 | Replicate API（SDXL / Flux） | 约 $0.01-0.05/张 |
| 收款 | PayPal Checkout SDK | 4.4% + $0.30/笔 |
| 域名 | inkvision.ai 或类似 | 约 $12/年 |

---

## 3. 系统架构

```
┌─────────────┐     ┌──────────────────────┐     ┌──────────────┐
│    前端      │────▶│ Firebase Cloud Func   │────▶│ Replicate API│
│  (静态 JS)   │     │  (隐藏 API Key)       │     │  (AI 生成)    │
└──────┬───────┘     └──────────────────────┘     └──────────────┘
       │
       │  Firebase JS SDK
       ▼
┌──────────────────────────────────────────┐
│              Firebase                     │
│  ┌──────┐  ┌───────────┐  ┌───────────┐ │
│  │ Auth │  │ Firestore  │  │  Storage  │ │
│  │ 认证  │  │  用户数据   │  │  图片存储  │ │
│  │Google │  │  设计记录   │  │           │ │
│  │邮箱   │  │  画廊数据   │  │           │ │
│  └──────┘  └───────────┘  └───────────┘ │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│  PayPal SDK  │
│   (收款)      │
└──────────────┘
```

---

## 4. 功能拆解

### 第一阶段 — MVP（上线赚钱）

#### 4.1 落地页
- Hero 区域：核心卖点
- 使用流程（4 步）
- 纹身风格展示
- 定价区域
- 页脚（法律链接）
- 移动端自适应
- SEO meta 标签

#### 4.2 AI 纹身生成器
- 文本输入：用户描述想要的纹身
- 风格选择器：10+ 种纹身风格
  - Fine Line（细线）、Traditional（传统）、Japanese（日式）
  - Tribal（部落）、Watercolor（水彩）、Blackwork（黑工）
  - Minimalist（极简）、Neo-Traditional（新传统）
  - Dotwork（点刺）、Realistic（写实）
- 身体部位选择（前臂、肩膀、背部等）
- 每次生成 4 个设计
- 免费 3 次生成，之后付费
- 加载动画

#### 4.3 身体预览（Canvas 编辑器）
- 上传照片（点击或拖拽）
- 将纹身放置在照片上
- 控制选项：
  - 拖拽调整位置
  - 大小滑块
  - 旋转滑块（0-360°）
  - 透明度滑块
- 支持手机触摸操作
- 免费预览带 "INKVISION" 水印
- 付费下载去水印

#### 4.4 收款（PayPal）
- 单张下载：$2
- 设计包（10 张）：$5
- PayPal Checkout SDK（前端调用）
- Cloud Functions 服务端验证支付
- 验证通过后解锁高清下载

---

### 第二阶段 — 用户系统

#### 4.5 认证（Firebase Auth）
- Google 登录
- 邮箱/密码登录
- 匿名用户 → 转正式账号（保留历史）

#### 4.6 设计历史
- 保存所有生成的设计
- 重新下载已购买的设计
- 删除不要的设计
- 数据结构：
  ```
  users/{uid}/
    profile: { name, email, credits, createdAt }
    designs/{designId}: { prompt, style, placement, imageUrl, createdAt, purchased }
  ```

---

### 第三阶段 — 增长

#### 4.7 公开画廊
- 浏览社区设计（用户选择公开）
- 点赞 / 收藏
- 按风格、热度、时间筛选
- SEO：每个设计有独立 URL，吸引自然流量
- 数据结构：
  ```
  gallery/{designId}: { prompt, style, imageUrl, authorUid, likes, createdAt, public }
  ```

#### 4.8 社交分享
- 一键分享到 Instagram、Pinterest、TikTok、Twitter
- 自动生成带 InkVision 品牌的分享卡片
- 免费版分享图带品牌水印（免费推广）

#### 4.9 纹身师目录（远期）
- 纹身师创建个人主页
- 用户按地区找纹身师
- 收入：入驻费或预约抽佣

---

## 5. 安全设计

### 5.1 Firestore 数据库规则
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 用户只能读写自己的数据
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
    // 画廊：任何人可读公开设计，只有作者可写
    match /gallery/{designId} {
      allow read: if resource.data.public == true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
                            && request.auth.uid == resource.data.authorUid;
    }
  }
}
```

### 5.2 Storage 存储规则
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### 5.3 API Key 保护
- **Replicate API Key**：存在 Cloud Functions 环境变量中，绝不放前端
- **PayPal Client ID**：可以放前端（官方设计就是客户端使用）
- **Firebase Config**：可以放前端（安全由规则控制）

### 5.4 支付验证
- 前端发起 PayPal 支付
- Cloud Function 调用 PayPal API 验证支付结果
- 验证通过才解锁高清下载，防止伪造支付

---

## 6. 定价与变现

| 层级 | 价格 | 用户获得 |
|------|------|---------|
| 免费 | $0 | 3 次 AI 生成，带水印预览 |
| 单张下载 | $2 | 1 张高清设计，无水印，商用授权 |
| 设计包 | $5 | 10 次生成 + 高清下载 |
| 月订阅（第三阶段） | $9.9/月 | 无限生成 + 下载 |

### 收入预估（保守）
- 每天 1000 访客（SEO + 社交）
- 5% 转化 = 50 笔/天
- 平均 $3/笔
- **约 $4,500/月**

---

## 7. SEO 关键词策略

### 目标关键词
- "ai tattoo generator"
- "tattoo preview on body"
- "tattoo design generator free"
- "see tattoo on my body"
- "tattoo placement preview"
- "[风格] tattoo design"（如 fine line tattoo design）

### 技术 SEO
- 语义化 HTML，完整 meta 标签，OG 标签
- 极快加载（静态站，无框架臃肿）
- 画廊页面产生长尾关键词页面

---

## 8. 需要注册的账号

| 服务 | 地址 | 获取内容 |
|------|------|---------|
| Firebase | https://console.firebase.google.com | 创建项目 → 复制 firebaseConfig 配置 |
| Replicate | https://replicate.com | 注册 → 账号设置中获取 API Token |
| PayPal | https://developer.paypal.com | 创建 App → 获取 Client ID |

---

## 9. 开发路线

### 第一阶段 — MVP（第 1-2 周）
- [x] 创建 GitHub 仓库
- [ ] 落地页（响应式、SEO）
- [ ] 纹身生成器 UI + 风格选择
- [ ] Canvas 身体预览（拖拽/缩放/旋转）
- [ ] 通过 Cloud Function 对接 Replicate API
- [ ] PayPal 支付集成
- [ ] 水印逻辑（免费 vs 付费）
- [ ] 部署到 GitHub Pages

### 第二阶段 — 用户系统（第 3-4 周）
- [ ] Firebase Auth（Google + 邮箱）
- [ ] 用户个人页面
- [ ] 设计历史（保存/查看/重新下载）
- [ ] 积分系统（免费 vs 付费生成次数）

### 第三阶段 — 增长（第 5-8 周）
- [ ] 公开画廊 + 点赞
- [ ] 社交分享（Instagram、Pinterest、Twitter）
- [ ] SEO 优化的画廊页面
- [ ] PayPal 订阅

### 第四阶段 — 扩展（第 3 个月+）
- [ ] 纹身师目录
- [ ] 第三方 API 授权
- [ ] 移动 App（PWA 或 React Native）
- [ ] 多语言支持

---

## 10. 项目文件结构

```
InkVision/
├── index.html              # 主页面（落地页 + 应用）
├── styles.css              # 全局样式
├── app.js                  # 核心应用逻辑
├── firebase-config.js      # Firebase 初始化配置
├── auth.js                 # 认证逻辑
├── generator.js            # AI 生成 + Replicate API 调用
├── preview.js              # Canvas 身体预览编辑器
├── payment.js              # PayPal 集成
├── gallery.html            # 公开画廊页面
├── gallery.js              # 画廊逻辑
├── profile.html            # 用户个人页面
├── profile.js              # 个人页面逻辑
├── functions/              # Firebase Cloud Functions
│   ├── index.js            # 函数入口
│   ├── generate.js         # Replicate API 代理
│   └── verify-payment.js   # PayPal 支付验证
├── assets/
│   ├── og-image.png        # 社交分享图片
│   └── favicon.ico         # 网站图标
├── PRD.md                  # 本文档
└── README.md               # 项目说明
```
