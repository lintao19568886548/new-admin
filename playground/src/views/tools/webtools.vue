<script setup lang="ts">
import { ref } from 'vue';

import { Col, Divider, Input, Row } from 'ant-design-vue';

// AI工具分类数据
const categories = [
  {
    description: '智能文本生成和内容创作工具',
    id: 'writing',
    name: 'AI写作工具',
  },
  {
    description: '图像生成、编辑和处理工具',
    id: 'image',
    name: 'AI图像工具',
  },
  {
    description: '视频创作和编辑工具',
    id: 'video',
    name: 'AI视频工具',
  },
  {
    description: '语音创作和生成工具',
    id: 'voice',
    name: 'AI语音工具',
  },
  {
    description: '提升工作效率的智能办公助手',
    id: 'office',
    name: 'AI办公工具',
  },
  {
    description: '创意设计和图形生成工具',
    id: 'design',
    name: 'AI设计工具',
  },
  {
    description: '智能对话和聊天机器人',
    id: 'chat',
    name: 'AI对话聊天',
  },
  {
    description: '代码生成和编程辅助工具',
    id: 'code',
    name: 'AI编程工具',
  },
  {
    description: '智能搜索和信息检索工具',
    id: 'search',
    name: 'AI搜索引擎',
  },
  {
    description: '法律服务和咨询工具',
    id: 'law',
    name: 'AI法律助手',
  },
];

// AI工具列表数据
const aiTools = [
  // 写作工具
  {
    category: 'writing',
    color: '#5961f9',
    description: '智能AI写作助手，支持多种文体',
    hot: true,
    icon: 'icon-[ri--quill-pen-line]',
    name: '文心一言',
    url: 'https://yiyan.baidu.com/',
  },
  {
    category: 'writing',
    color: '#fa8c16',
    description: '专业文案和内容创作平台',
    icon: 'icon-[ri--draft-line]',
    name: '秘塔写作猫',
    url: 'https://xiezuocat.com/',
  },
  {
    category: 'writing',
    color: '#722ed1',
    description: '高效的AI写作和编辑工具',
    icon: 'icon-[ri--file-text-line]',
    name: '讯飞星火',
    url: 'https://xinghuo.xfyun.cn/',
  },

  // 图像工具
  {
    category: 'image',
    color: '#1890ff',
    description: 'AI艺术和图像生成平台',
    hot: true,
    icon: 'icon-[mdi--image-edit-outline]',
    name: '文心一格',
    url: 'https://yige.baidu.com/',
  },
  {
    category: 'image',
    color: '#eb2f96',
    description: 'AI图像生成模型',
    hot: true,
    icon: 'icon-[ph--paint-brush-bold]',
    name: '腾讯智影',
    url: 'https://zenvideo.qq.com/',
  },
  {
    category: 'image',
    color: '#52c41a',
    description: '阿里云AI图像生成工具',
    icon: 'icon-[mdi--palette-outline]',
    name: '通义万相',
    url: 'https://wanxiang.aliyun.com/',
  },
  {
    category: 'image',
    color: '#13c2c2',
    description: '智能图片背景移除工具',
    icon: 'icon-[mdi--image-remove-outline]',
    name: '美图云修',
    url: 'https://yunxiu.meitu.com/',
  },

  // 视频工具
  {
    category: 'video',
    color: '#f5222d',
    description: 'AI视频生成和编辑平台',
    hot: true,
    icon: 'icon-[mdi--video-outline]',
    name: '剪映专业版',
    url: 'https://www.capcut.cn/',
  },
  {
    category: 'video',
    color: '#faad14',
    description: '智能视频创作和编辑工具',
    icon: 'icon-[mdi--movie-edit-outline]',
    name: '万兴喵影',
    url: 'https://miao.wondershare.cn/',
  },

  // 语音工具
  {
    category: 'voice',
    color: '#1890ff',
    description: '免费在线文本转语音工具',
    hot: true,
    icon: 'icon-[mdi--microphone-outline]',
    name: 'TTSMaker',
    url: 'https://ttsmaker.cn/',
  },
  {
    category: 'voice',
    color: '#722ed1',
    description: '讯飞智能语音合成平台',
    icon: 'icon-[mdi--voice]',
    name: '讯飞配音',
    url: 'https://www.xfyun.cn/services/online_tts',
  },

  // 办公工具
  {
    category: 'office',
    color: '#1d39c4',
    description: 'AI驱动的演示文稿创建工具',
    icon: 'icon-[mdi--presentation]',
    name: '金山文档',
    url: 'https://www.kdocs.cn/',
  },
  {
    category: 'office',
    color: '#faad14',
    description: 'AI表格数据分析工具',
    icon: 'icon-[mdi--table-large]',
    name: '飞书多维表格',
    url: 'https://www.feishu.cn/product/base',
  },

  // 设计工具
  {
    category: 'design',
    color: '#722ed1',
    description: 'AI网站和应用设计工具',
    hot: true,
    icon: 'icon-[mdi--web]',
    name: '即时设计',
    url: 'https://js.design/',
  },
  {
    category: 'design',
    color: '#eb2f96',
    description: 'AI标志和品牌设计工具',
    icon: 'icon-[mdi--shape-outline]',
    name: '标小智',
    url: 'https://www.logosc.cn/',
  },

  // 对话聊天
  {
    category: 'chat',
    color: '#1890ff',
    description: 'DeepSeek智能对话助手',
    icon: 'icon-[ant-design--robot-outlined]',
    name: 'DeepSeeker',
    url: 'https://www.deepseek.com/',
  },
  {
    category: 'chat',
    color: '#1890ff',
    description: '豆包智能对话助手',
    icon: 'icon-[ant-design--robot-outlined]',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
  },
  {
    category: 'chat',
    color: '#1890ff',
    description: '智能对话与问答助手',
    icon: 'icon-[ant-design--robot-outlined]',
    name: '智谱AI',
    url: 'https://www.zhipuai.cn/',
  },
  {
    category: 'chat',
    color: '#fa8c16',
    description: '百度智能对话助手',
    hot: true,
    icon: 'icon-[simple-icons--baidu]',
    name: '文心一言',
    url: 'https://yiyan.baidu.com/',
  },

  // 编程工具
  {
    category: 'code',
    color: '#13c2c2',
    description: '阿里云代码助手',
    hot: true,
    icon: 'icon-[ri--code-box-line]',
    name: '通义灵码',
    url: 'https://tongyi.aliyun.com/lingma/',
  },
  {
    category: 'code',
    color: '#52c41a',
    description: 'AI代码解释和生成工具',
    icon: 'icon-[mdi--code-braces]',
    name: '腾讯云代码助手',
    url: 'https://cloud.tencent.com/product/tcca',
  },

  // 搜索引擎
  {
    category: 'search',
    color: '#faad14',
    description: '百度AI搜索引擎',
    hot: true,
    icon: 'icon-[simple-icons--baidu]',
    name: '百度搜索',
    url: 'https://www.baidu.com/',
  },
  {
    category: 'search',
    color: '#1d39c4',
    description: '新一代AI搜索引擎',
    icon: 'icon-[mdi--magnify]',
    name: '360搜索',
    url: 'https://www.so.com/',
  },
  {
    category: 'law',
    color: '#1d39c4',
    description: '法律知识问答助手',
    icon: 'icon-[mdi--magnify]',
    name: '元典智库',
    url: 'https://www.chineselaw.com/tyjs/index',
  },
];

// 当前选中的分类
const activeCategory = ref('all');

// 过滤工具列表
const filteredTools = (category: string) => {
  if (category === 'all') {
    return aiTools;
  }
  return aiTools.filter((tool) => tool.category === category);
};

// 搜索关键词
const searchKeyword = ref('');

// 搜索结果
const searchResults = () => {
  if (!searchKeyword.value) {
    return filteredTools(activeCategory.value);
  }

  const keyword = searchKeyword.value.toLowerCase();
  return filteredTools(activeCategory.value).filter(
    (tool) =>
      tool.name.toLowerCase().includes(keyword) ||
      tool.description.toLowerCase().includes(keyword),
  );
};

// 打开AI工具链接
function openAiTool(url: string) {
  window.open(url, '_blank');
}

// 切换分类
function changeCategory(category: string) {
  activeCategory.value = category;
}
</script>

<template>
  <div class="web-tools-container">
    <!-- 头部搜索区域 -->
    <div class="tools-header">
      <div class="header-content">
        <h1 class="main-title">AI工具导航</h1>
        <p class="sub-title">精选优质AI工具，提升工作效率</p>
        <div class="search-box">
          <Input
            v-model:value="searchKeyword"
            placeholder="搜索AI工具..."
            class="search-input"
            allow-clear
          >
            <!-- <template #prefix> -->
            <!-- <span class="icon-[fas--search] search-icon"></span> -->
            <!-- </template> -->
          </Input>
        </div>
      </div>
    </div>

    <!-- 分类导航 -->
    <div class="category-nav">
      <div class="category-tabs">
        <div
          class="category-tab"
          :class="{ active: activeCategory === 'all' }"
          @click="changeCategory('all')"
        >
          <!-- <span class="icon-[fas--th-large] mr-2"></span> -->
          全部工具
        </div>
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-tab"
          :class="{ active: activeCategory === category.id }"
          @click="changeCategory(category.id)"
        >
          <!-- <span class="mr-2" :class="[category.icon]"></span> -->
          {{ category.name }}
        </div>
      </div>
    </div>

    <!-- AI工具卡片区域 -->
    <div class="tools-content">
      <Row :gutter="[16, 16]">
        <Col
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
          v-for="tool in searchResults()"
          :key="tool.name"
        >
          <div class="ai-tool-card" @click="openAiTool(tool.url)">
            <div class="tool-icon" :style="{ backgroundColor: tool.color }">
              <span :class="tool.icon"></span>
            </div>
            <div class="tool-info">
              <div class="tool-name-wrapper">
                <h3 class="tool-name">{{ tool.name }}</h3>
                <span v-if="tool.hot" class="hot-tag">热门</span>
              </div>
              <p class="tool-description">{{ tool.description }}</p>
            </div>
          </div>
        </Col>
      </Row>

      <!-- 无搜索结果提示 -->
      <div v-if="searchResults().length === 0" class="no-results">
        <span class="icon-[ant-design--search-outlined] no-results-icon"></span>
        <p>没有找到匹配的AI工具，请尝试其他关键词</p>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="tools-footer">
      <Divider>
        <span class="footer-text">发现更多AI工具，提升工作效率</span>
      </Divider>
      <p class="copyright">© 2025 AI工具导航 | 精选全球优质AI工具</p>
    </div>
  </div>
</template>

<style scoped>
/* 响应式调整 */
@media (max-width: 768px) {
  .tools-header {
    padding: 40px 20px 30px;
  }

  .main-title {
    font-size: 24px;
  }

  .sub-title {
    font-size: 14px;
  }
}

.web-tools-container {
  position: relative;
  min-height: 100%;
  padding: 0;
  background-color: #f9f9f9;
}

/* 头部区域样式 */
.tools-header {
  position: relative;
  padding: 60px 20px 40px;
  margin-bottom: 20px;
  text-align: center;
  background-image: url('https://ai-bot.cn/wp-content/uploads/2023/07/blury-shape-bg-light.png');
  background-size: cover;
}

.header-content {
  max-width: 800px;
  margin: 0 auto;
}

.main-title {
  margin-bottom: 10px;
  font-size: 32px;
  font-weight: 700;
  color: #333;
}

.sub-title {
  margin-bottom: 30px;
  font-size: 16px;
  color: #666;
}

.search-box {
  max-width: 600px;
  margin: 0 auto;
}

.search-input {
  height: 50px;
  font-size: 16px;
  border-radius: 25px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 8%);
}

.search-icon {
  font-size: 18px;
  color: #5961f9;
}

/* 分类导航样式 */
.category-nav {
  padding: 0 20px;
  margin-bottom: 20px;
  overflow-x: auto;
}

.category-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  padding-bottom: 5px;
}

.category-tab {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  cursor: pointer;
  background-color: white;
  border-radius: 20px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 5%);
  transition: all 0.3s ease;
}

.category-tab.active {
  color: white;
  background-color: #5961f9;
}

.category-tab:hover:not(.active) {
  background-color: #f0f0f0;
}

/* 工具卡片区域样式 */
.tools-content {
  padding: 0 20px 40px;
}

.ai-tool-card {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 16px;
  cursor: pointer;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
  transition: all 0.3s ease;
}

.ai-tool-card:hover {
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  transform: translateY(-5px);
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-right: 16px;
  font-size: 24px;
  color: white;
  border-radius: 12px;
}

.tool-info {
  flex: 1;
}

.tool-name-wrapper {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.tool-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.hot-tag {
  display: inline-block;
  padding: 2px 6px;
  margin-left: 8px;
  font-size: 12px;
  line-height: 1;
  color: white;
  background-color: #ff4d4f;
  border-radius: 10px;
}

.tool-description {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #666;
}

/* 无搜索结果样式 */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
}

.no-results-icon {
  margin-bottom: 20px;
  font-size: 48px;
  color: #ddd;
}

/* 底部信息样式 */
.tools-footer {
  padding: 20px;
  text-align: center;
}

.footer-text {
  font-size: 14px;
  color: #999;
}

.copyright {
  margin-top: 10px;
  font-size: 12px;
  color: #999;
}

/* 全局样式 */
</style>
