<template>
  <div class="app">
    <BookFlip
      v-model:currentPage="currentPage"
      :flipDuration="600"
      @flip="handleFlip"
    >
      <BookFlipPage>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;">
          <h1 style="font-size:2rem;margin-bottom:.5rem;">📖 Vue Turn.js</h1>
          <p style="font-size:.9rem;opacity:.8;">A Vue 3 Book Flip Component</p>
          <p style="margin-top:1.5rem;font-size:.78rem;opacity:.6;">Based on turn.js by Emmanuel Garcia</p>
        </div>
      </BookFlipPage>

      <BookFlipPage>
        <div style="padding:1.5rem;">
          <h2 style="font-size:1.3rem;color:#333;border-bottom:2px solid #667eea;padding-bottom:.4rem;">第一章 插槽模式</h2>
          <p style="margin-top:1rem;line-height:1.8;color:#555;">现在支持使用默认插槽定义页面内容了！</p>
          <ul style="margin-top:.8rem;line-height:2;color:#444;padding-left:1.2rem;">
            <li>每个子元素就是一页</li>
            <li>支持任意 HTML 结构</li>
            <li>支持 Vue 组件嵌套</li>
            <li>支持图片、表格等</li>
          </ul>
          <div style="margin-top:1rem;padding:.8rem;background:#f0f4ff;border-radius:8px;font-size:.85rem;color:#444;">
            <strong>💡 类似 Swiper 的 slider 用法</strong>
          </div>
        </div>
      </BookFlipPage>

      <BookFlipPage>
        <div style="padding:1.5rem;">
          <h2 style="font-size:1.3rem;color:#333;">第二章 翻页动画</h2>
          <div style="margin-top:1rem;display:flex;gap:.8rem;">
            <div style="flex:1;padding:.8rem;background:#fff3e0;border-radius:8px;text-align:center;">
              <div style="font-size:1.5rem;">👆</div>
              <div style="font-size:.82rem;color:#666;margin-top:.3rem;">拖拽翻页</div>
            </div>
            <div style="flex:1;padding:.8rem;background:#e8f5e9;border-radius:8px;text-align:center;">
              <div style="font-size:1.5rem;">👆</div>
              <div style="font-size:.82rem;color:#666;margin-top:.3rem;">点击翻页</div>
            </div>
            <div style="flex:1;padding:.8rem;background:#fce4ec;border-radius:8px;text-align:center;">
              <div style="font-size:1.5rem;">📱</div>
              <div style="font-size:.82rem;color:#666;margin-top:.3rem;">触摸支持</div>
            </div>
          </div>
          <table style="width:100%;margin-top:1rem;border-collapse:collapse;font-size:.85rem;">
            <tr style="background:#f5f5f5;"><th style="padding:.5rem;border:1px solid #ddd;">特性</th><th style="padding:.5rem;border:1px solid #ddd;">状态</th></tr>
            <tr><td style="padding:.5rem;border:1px solid #ddd;">折痕阴影</td><td style="padding:.5rem;border:1px solid #ddd;color:green;">✅ 支持</td></tr>
            <tr><td style="padding:.5rem;border:1px solid #ddd;">TypeScript</td><td style="padding:.5rem;border:1px solid #ddd;color:green;">✅ 完整类型</td></tr>
            <tr><td style="padding:.5rem;border:1px solid #ddd;">零依赖</td><td style="padding:.5rem;border:1px solid #ddd;color:green;">✅ 仅需 Vue 3</td></tr>
          </table>
        </div>
      </BookFlipPage>

      <BookFlipPage>
        <div style="display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,#11998e 0%,#38ef7d 100%);color:#fff;">
          <div style="text-align:center;">
            <div style="font-size:3rem;margin-bottom:.5rem;">🎉</div>
            <h2 style="font-size:1.5rem;">感谢阅读</h2>
            <p style="opacity:.8;margin-top:.5rem;">vue-turnjs-flip v1.0.0</p>
          </div>
        </div>
      </BookFlipPage>
    </BookFlip>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BookFlip from './components/BookFlip.vue'
import BookFlipPage from './components/BookFlipPage.vue'

const currentPage = ref(0)

const handleFlip = (direction: 'next' | 'prev') => {
  console.log(`Flipped ${direction}, now on page ${currentPage.value + 1}`)
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app {
  width: 100%;
  height: 100%;
}
</style>
