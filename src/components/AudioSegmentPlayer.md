# AudioSegmentPlayer 组件使用文档

## 概述

`AudioSegmentPlayer` 是一个高度可复用的音频分段播放器组件，用于加载和播放课文的分段音频内容。组件支持自动高亮当前播放段落、独立段落播放、进度控制等功能。

## 组件结构

```
AudioSegmentPlayer (主组件)
├── 音频控制栏（播放/暂停、进度条、速度控制）
└── SegmentItem (子组件列表)
    ├── 角色头像
    ├── 角色名
    ├── 文本内容
    └── 独立播放按钮
```

## Props 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wenId` | `string` | - | **必填** 课文ID，用于拉取对应分段数据 |
| `autoLoad` | `boolean` | `true` | 是否自动加载数据 |
| `cacheEnabled` | `boolean` | `true` | 是否启用缓存机制 |
| `requestTimeout` | `number` | `10000` | 请求超时时间（毫秒） |
| `audioBaseUrl` | `string` | `'/audio/'` | 音频和JSON数据的基础URL |

## Events 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `load-start` | - | 开始加载数据时触发 |
| `load-success` | `data: WenData` | 数据加载成功时触发 |
| `load-error` | `error: string` | 数据加载失败时触发 |
| `play` | - | 开始播放时触发 |
| `pause` | - | 暂停播放时触发 |
| `ended` | - | 播放结束时触发 |
| `segment-change` | `index: number` | 当前播放段落变化时触发 |

## 暴露方法

组件通过 `defineExpose` 暴露以下方法：

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `loadData()` | - | `void` | 手动触发数据加载 |
| `play()` | - | `Promise<void>` | 开始播放 |
| `pause()` | - | `void` | 暂停播放 |
| `seek(time)` | `time: number` | `void` | 跳转到指定时间（秒） |
| `getCurrentSegment()` | - | `Segment \| null` | 获取当前播放段落 |

## 数据类型定义

### Segment（段落）

```typescript
interface Segment {
  id: string;           // 段落ID
  text: string;         // 段落文本内容
  role: string;         // 角色名称
  avatar: string;       // 角色头像（emoji）
  startTime: number;    // 开始时间（秒）
  endTime: number;      // 结束时间（秒）
}
```

### WenData（课文数据）

```typescript
interface WenData {
  wenId: string;        // 课文ID
  title: string;        // 课文标题
  audioUrl: string;     // 音频文件URL
  segments: Segment[];  // 段落列表
}
```

## 使用示例

### 基础用法

```vue
<template>
  <AudioSegmentPlayer
    wenId="WEN_01"
    @load-success="handleLoadSuccess"
    @load-error="handleLoadError"
    @segment-change="handleSegmentChange"
  />
</template>

<script setup lang="ts">
import AudioSegmentPlayer from '@/components/AudioSegmentPlayer.vue';
import type { WenData } from '@/components/AudioSegmentPlayer.vue';

function handleLoadSuccess(data: WenData) {
  console.log('数据加载成功:', data);
}

function handleLoadError(error: string) {
  console.error('数据加载失败:', error);
}

function handleSegmentChange(index: number) {
  console.log('当前段落索引:', index);
}
</script>
```

### 手动控制加载

```vue
<template>
  <div>
    <button @click="playerRef?.loadData()">加载音频</button>
    <AudioSegmentPlayer
      ref="playerRef"
      wenId="WEN_02"
      :auto-load="false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AudioSegmentPlayer from '@/components/AudioSegmentPlayer.vue';

const playerRef = ref<InstanceType<typeof AudioSegmentPlayer> | null>(null);
</script>
```

### 自定义配置

```vue
<template>
  <AudioSegmentPlayer
    wenId="WEN_03"
    :cache-enabled="false"
    :request-timeout="15000"
    audio-base-url="/api/audio/"
  />
</template>

<script setup lang="ts">
import AudioSegmentPlayer from '@/components/AudioSegmentPlayer.vue';
</script>
```

## JSON数据格式要求

组件期望从 `${audioBaseUrl}${wenId}.json` 拉取数据，数据格式如下：

```json
{
  "wenId": "WEN_01",
  "title": "论语·学而篇",
  "audioUrl": "/audio/WEN_01.mp3",
  "segments": [
    {
      "id": "seg_001",
      "text": "子曰：学而时习之，不亦说乎？",
      "role": "孔子",
      "avatar": "👴",
      "startTime": 0,
      "endTime": 3.5
    },
    {
      "id": "seg_002",
      "text": "有朋自远方来，不亦乐乎？",
      "role": "孔子",
      "avatar": "👴",
      "startTime": 3.5,
      "endTime": 7
    }
  ]
}
```

**注意**：`startTime` 和 `endTime` 需要与音频文件的实际时间轴对应，单位为秒。

## 错误处理机制

### 网络错误
- 请求超时自动取消
- 提供重试按钮

### 数据格式错误
- 自动验证返回数据结构
- 验证失败时显示错误提示

### 请求取消
- 组件卸载前自动取消正在进行的请求
- 支持手动取消（通过 AbortController）

## 缓存机制

组件内置了简单的内存缓存：

1. 缓存键：`wenId`
2. 缓存有效期：组件生命周期内
3. 可通过 `cacheEnabled` prop 控制是否启用

## 性能优化

1. **防抖机制**：通过 `requestTimeout` 控制请求频率
2. **请求取消**：避免重复请求和内存泄漏
3. **虚拟滚动**：大数据量下建议配合虚拟滚动组件使用

## 浏览器兼容性

- 支持所有现代浏览器（Chrome、Firefox、Safari、Edge）
- 需要 Font Awesome 图标库支持

## 依赖说明

- Vue 3 + TypeScript
- Font Awesome 6.x（用于图标）
- 无需其他额外依赖
