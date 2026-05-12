# Vue Turn.js

<p align="center">
  <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20beautiful%20realistic%20open%20book%20with%20pages%20turning%2C%20soft%20warm%20lighting%2C%20elegant%20paper%20texture%2C%20minimalist%20style%2C%20high%20quality%203D%20render&image_size=landscape_16_9" alt="Vue Turn.js" width="600"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vue-turnjs-flip"><img src="https://img.shields.io/npm/v/vue-turnjs-flip.svg" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/vue-turnjs-flip.svg" alt="License"></a>
  <a href="https://www.npmjs.com/package/vue-turnjs-flip"><img src="https://img.shields.io/npm/dt/vue-turnjs-flip.svg" alt="Downloads"></a>
</p>

<p align="center">
  <strong>基于 turn.js 改进的 Vue 3 翻书组件 / A Vue 3 book flip component based on turn.js</strong>
</p>

---

## ✨ 特性

- 📖 **逼真翻页效果** — 基于 [turn.js](https://github.com/blasten/turn.js) 的页面翻转动画算法，支持拖拽翻页和点击翻页
- ⚡ **Vue 3 原生** — 使用 Composition API + TypeScript 编写，完全适配 Vue 3 响应式系统
- 🎨 **折痕阴影** — 书脊处自然的页面折痕阴影效果（奇偶页双背景图方案）
- 👆 **触摸支持** — 完美支持桌面端鼠标和移动端触摸操作
- 📦 **轻量级** — 零运行时依赖，仅依赖 Vue 3
- 🛠️ **TypeScript** — 完整类型定义
- 📱 **响应式** — 自适应布局

## 🙏 致谢 / Acknowledgments

本项目核心翻页动画算法源自 [turn.js](https://github.com/blasten/turn.js) (by Emmanuel Garcia)，一个优秀的 jQuery 翻书插件。本组件将其完整移植到 **Vue 3 + TypeScript** 生态中，并做了以下改进：

- 移除 jQuery 依赖，使用原生 DOM API + Vue 3 Composition API 重写
- 使用 Vue 3 响应式系统管理状态（props / emits）
- 添加 TypeScript 完整类型支持
- 组件化封装，开箱即用
- 折痕阴影效果优化

> **原项目**: [https://github.com/blasten/turn.js](https://github.com/blasten/turn.js) (MIT License)

## 📦 安装

### NPM

```bash
npm install vue-turnjs-flip
```

### CDN

```html
<script src="https://unpkg.com/vue-turnjs-flip/dist/vue-turnjs-flip.umd.js"></script>
```

## 🚀 快速开始

### 基础用法

```vue
<template>
  <BookFlip :pages="pages" v-model:current-page="currentPage" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BookFlip } from 'vue-turnjs-flip'

const currentPage = ref(0)
const pages = ref([
  { title: '第 1 页', content: '这里是第一页的内容...' },
  { title: '第 2 页', content: '这里是第二页的内容...' },
  { title: '第 3 页', content: '这里是第三页的内容...' },
  { title: '第 4 页', content: '这里是第四页的内容...' },
])
</script>
```

### 全局注册

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import VueTurnJsFlip from 'vue-turnjs-flip'

const app = createApp(App)
app.use(VueTurnJsFlip)
app.mount('#app')
```

## 📖 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pages` | `Array<{ title?: string; content?: string }>` | `[]` | 页面数据数组，每项包含 title 和 content |
| `currentPage` | `number` | `0` | 当前页码（v-model 双向绑定） |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `update:currentPage` | `(page: number)` | 页码变化时触发 |
| `flip` | `(data: FlipData)` | 翻页动作触发时回调 |

### Slots

暂不支持插槽，页面内容通过 `pages` prop 的 `content` 字段渲染。

## 🔧 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建库文件
npm run build

# 预览构建结果
npm run preview
```

## 📁 项目结构

```
vue-turnjs-flip/
├── src/
│   ├── components/
│   │   └── BookFlip.vue      # 核心翻书组件
│   ├── index.ts               # 库入口（导出组件）
│   └── main.ts                # 开发示例入口
├── img/                       # 折痕阴影背景图
│   ├── pages_01.png           # 左页（偶数页）阴影
│   └── pages_02.png           # 右页（奇数页）阴影
├── dist/                      # 构建输出
├── package.json
├── vite.config.ts
└── README.md
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📄 License

[MIT](./LICENSE)

基于 [turn.js](https://github.com/blasten/turn.js) (Emmanuel Garcia, MIT License) 改进开发。
