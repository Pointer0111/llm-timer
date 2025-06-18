<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Timer, QuestionFilled } from '@element-plus/icons-vue'
import { useTaskStore } from '../stores/task'
import TaskList from '../components/TaskList.vue'
import PomodoroTimer from '../components/PomodoroTimer.vue'
import CalendarView from '../components/CalendarView.vue'

const taskStore = useTaskStore()
const activeTab = ref('tasks')
const helpVisible = ref(false)

const showHelp = () => {
  helpVisible.value = true
}

onMounted(() => {
  // 初始化时加载数据
  taskStore.loadFromLocalStorage()
})
</script>

<template>
  <div class="home">
    <el-container>
      <el-header class="app-header">
        <div class="header-content">
          <h1 class="app-title">
            <el-icon class="title-icon"><Timer /></el-icon>
            LLM Timer - 智能番茄钟
          </h1>
          <div class="header-actions">
            <el-button @click="showHelp" type="info" size="small">
              <el-icon><QuestionFilled /></el-icon>
              使用帮助
            </el-button>
          </div>
        </div>
      </el-header>

      <el-main class="main-content">
        <el-tabs v-model="activeTab" type="border-card" class="main-tabs">
          <el-tab-pane label="任务管理" name="tasks">
            <div class="tab-content">
              <div class="left-panel">
                <TaskList />
              </div>
              <div class="right-panel">
                <PomodoroTimer />
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="日历视图" name="calendar">
            <div class="tab-content">
              <CalendarView />
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-main>
    </el-container>

    <!-- 帮助对话框 -->
    <el-dialog
      v-model="helpVisible"
      title="使用帮助"
      width="60%"
    >
      <div class="help-content">
        <h3>🎯 核心功能</h3>
        <ul>
          <li><strong>任务管理</strong>：添加、编辑、删除任务，支持优先级设置</li>
          <li><strong>自然语言输入</strong>：使用自然语言描述任务，如"明天上午安排阅读1小时"</li>
          <li><strong>智能排期</strong>：AI自动为任务安排合理的时间段</li>
          <li><strong>番茄钟专注</strong>：25分钟专注 + 5分钟休息的经典番茄工作法</li>
          <li><strong>日历视图</strong>：可视化查看任务安排，支持拖拽调整时间</li>
        </ul>

        <h3>📝 自然语言输入示例</h3>
        <ul>
          <li>"明天上午安排阅读1小时"</li>
          <li>"下午写总结2小时（高优先级）"</li>
          <li>"晚上锻炼30分钟"</li>
          <li>"明天上午开会2小时，下午写报告1小时"</li>
        </ul>

        <h3>🎨 界面说明</h3>
        <ul>
          <li><strong>任务管理</strong>：查看所有任务，添加新任务，使用智能排期</li>
          <li><strong>番茄钟</strong>：选择任务后开始专注，支持暂停和重置</li>
          <li><strong>日历视图</strong>：月/周/日视图切换，点击任务查看详情，拖拽调整时间</li>
        </ul>

        <h3>🏷️ 任务标识</h3>
        <ul>
          <li><el-tag type="danger">高优先级</el-tag>：重要且紧急的任务</li>
          <li><el-tag type="warning">中优先级</el-tag>：一般重要的任务</li>
          <li><el-tag type="info">低优先级</el-tag>：不紧急的任务</li>
          <li><el-tag type="info">AI安排</el-tag>：由智能Agent自动安排的任务</li>
        </ul>
    </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.app-header {
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.app-title {
  margin: 0;
  font-size: 1.5rem;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  font-size: 1.8rem;
  color: #409EFF;
}

.main-content {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.main-tabs {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  min-height: 600px;
}

.tab-content {
  padding: 20px;
  min-height: 560px;
}

.left-panel {
  flex: 1;
  margin-right: 20px;
  min-height: 520px;
}

.right-panel {
  width: 400px;
  flex-shrink: 0;
  min-height: 520px;
}

/* 任务管理标签页的布局 */
.el-tab-pane[name="tasks"] .tab-content {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

/* 日历视图标签页的布局 */
.el-tab-pane[name="calendar"] .tab-content {
  width: 100%;
  padding: 20px;
}

.help-content {
  line-height: 1.6;
}

.help-content h3 {
  color: #303133;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.help-content h3:first-child {
  margin-top: 0;
}

.help-content ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.help-content li {
  margin-bottom: 0.5rem;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .el-tab-pane[name="tasks"] .tab-content {
    flex-direction: column;
  }
  
  .left-panel {
    margin-right: 0;
    margin-bottom: 20px;
  }
  
  .right-panel {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 1rem;
    padding: 10px 20px;
  }
  
  .main-content {
    padding: 10px;
  }
  
  .tab-content {
    padding: 10px;
  }
}
</style>
