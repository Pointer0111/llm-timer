<template>
  <div class="task-list">
    <el-card>
      <template #header>
        <div class="task-header">
          <h2>任务列表</h2>
          <div class="header-actions">
            <el-button type="success" @click="showNaturalLanguageDialog">
              <el-icon><ChatDotRound /></el-icon>
              自然语言输入
            </el-button>
            <el-button type="primary" @click="showAddTaskDialog">
              <el-icon><Plus /></el-icon>
              添加任务
            </el-button>
            <el-button type="warning" @click="scheduleTasks" :disabled="!hasUnscheduledTasks">
              <el-icon><MagicStick /></el-icon>
              智能排期
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="全部" name="all">
          <task-table :tasks="taskStore.allTasks" />
        </el-tab-pane>
        <el-tab-pane label="进行中" name="active">
          <task-table :tasks="taskStore.activeTasks" />
        </el-tab-pane>
        <el-tab-pane label="已完成" name="completed">
          <task-table :tasks="taskStore.completedTasks" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 自然语言输入对话框 -->
    <el-dialog
      v-model="naturalLanguageDialogVisible"
      title="自然语言输入任务"
      width="40%"
    >
      <div class="natural-language-input">
        <el-input
          v-model="naturalLanguageInput"
          type="textarea"
          :rows="3"
          placeholder="例如：我明天上午安排阅读1小时，或者：下午写总结2小时（高优先级）"
          @keyup.enter.ctrl="parseNaturalLanguage"
        />
        <div class="input-examples">
          <p class="examples-title">输入示例：</p>
          <ul>
            <li>明天上午安排阅读1小时</li>
            <li>下午写总结2小时（高优先级）</li>
            <li>晚上锻炼30分钟</li>
            <li>明天上午开会2小时，下午写报告1小时</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="naturalLanguageDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="parseNaturalLanguage" :loading="parsing">
            解析并添加
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 添加任务对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="添加新任务"
      width="30%"
    >
      <el-form :model="newTask" label-width="100px">
        <el-form-item label="任务名称">
          <el-input v-model="newTask.title" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="预计时长">
          <el-input-number 
            v-model="newTask.estimatedMinutes" 
            :min="15" 
            :max="480" 
            :step="15"
            placeholder="分钟"
          />
          <span class="time-hint">分钟</span>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="newTask.priority" placeholder="选择优先级">
            <el-option label="高" value="高" />
            <el-option label="中" value="中" />
            <el-option label="低" value="低" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="addTask">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 智能排期任务选择对话框 -->
    <el-dialog
      v-model="scheduleDialogVisible"
      title="选择需要智能排期的任务"
      width="50%"
    >
      <div class="schedule-selection">
        <p class="dialog-description">请选择需要智能排期的任务：</p>
        <el-table
          :data="unscheduledTasks"
          @selection-change="handleSelectionChange"
          style="width: 100%"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="title" label="任务名称" />
          <el-table-column prop="priority" label="优先级" width="100">
            <template #default="{ row }">
              <el-tag :type="getPriorityType(row.priority)" size="small">
                {{ row.priority }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="estimatedMinutes" label="预计时长" width="120">
            <template #default="{ row }">
              {{ formatDuration(row.estimatedMinutes) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="scheduleDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="executeSchedule" 
            :loading="scheduling"
            :disabled="selectedTasksForSchedule.length === 0"
          >
            开始排期 ({{ selectedTasksForSchedule.length }}个任务)
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, Plus, MagicStick } from '@element-plus/icons-vue'
import { useTaskStore } from '../stores/task'
import TaskTable from './TaskTable.vue'

const taskStore = useTaskStore()
const activeTab = ref('all')
const dialogVisible = ref(false)
const naturalLanguageDialogVisible = ref(false)
const scheduleDialogVisible = ref(false)
const parsing = ref(false)
const scheduling = ref(false)
const naturalLanguageInput = ref('')
const selectedTasksForSchedule = ref<any[]>([])
const newTask = ref({
  title: '',
  estimatedMinutes: 60,
  priority: '中' as '高' | '中' | '低'
})

const hasUnscheduledTasks = computed(() => {
  return taskStore.activeTasks.some(task => !task.startTime)
})

const unscheduledTasks = computed(() => {
  return taskStore.activeTasks.filter(task => !task.startTime)
})

const getPriorityType = (priority: string) => {
  switch (priority) {
    case '高': return 'danger'
    case '中': return 'warning'
    case '低': return 'info'
    default: return 'info'
  }
}

const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}分钟`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (remainingMinutes === 0) {
      return `${hours}小时`
    } else {
      return `${hours}小时${remainingMinutes}分钟`
    }
  }
}

const showAddTaskDialog = () => {
  dialogVisible.value = true
  newTask.value = {
    title: '',
    estimatedMinutes: 60,
    priority: '中'
  }
}

const showNaturalLanguageDialog = () => {
  naturalLanguageDialogVisible.value = true
  naturalLanguageInput.value = ''
}

const addTask = () => {
  if (newTask.value.title.trim()) {
    taskStore.addTask(
      newTask.value.title, 
      newTask.value.estimatedMinutes,
      newTask.value.priority
    )
    dialogVisible.value = false
    ElMessage.success('任务添加成功')
  } else {
    ElMessage.warning('请输入任务名称')
  }
}

const parseNaturalLanguage = async () => {
  if (!naturalLanguageInput.value.trim()) {
    ElMessage.warning('请输入任务描述')
    return
  }

  parsing.value = true
  try {
    const task = await taskStore.parseNaturalLanguage(naturalLanguageInput.value)
    if (task) {
      naturalLanguageDialogVisible.value = false
      ElMessage.success('任务解析并添加成功')
    } else {
      ElMessage.error('无法解析任务，请检查输入格式')
    }
  } catch (error) {
    ElMessage.error('解析失败，请重试')
  } finally {
    parsing.value = false
  }
}

const scheduleTasks = () => {
  scheduleDialogVisible.value = true
  selectedTasksForSchedule.value = []
}

const handleSelectionChange = (selection: any[]) => {
  selectedTasksForSchedule.value = selection
}

const executeSchedule = async () => {
  if (selectedTasksForSchedule.value.length === 0) {
    ElMessage.warning('请选择需要排期的任务')
    return
  }

  scheduling.value = true
  try {
    // 为选中的任务进行智能排期
    for (const task of selectedTasksForSchedule.value) {
      await taskStore.scheduleSingleTask(task.id)
    }
    
    scheduleDialogVisible.value = false
    ElMessage.success(`成功为 ${selectedTasksForSchedule.value.length} 个任务安排了时间`)
  } catch (error) {
    ElMessage.error('排期失败，请重试')
  } finally {
    scheduling.value = false
  }
}
</script>

<style scoped>
.task-list {
  max-width: 1000px;
  margin: 0 auto;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.natural-language-input {
  margin-bottom: 1rem;
}

.input-examples {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.examples-title {
  margin: 0 0 0.5rem 0;
  font-weight: bold;
  color: #606266;
}

.input-examples ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #606266;
}

.input-examples li {
  margin-bottom: 0.25rem;
}

.time-hint {
  margin-left: 0.5rem;
  color: #909399;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.schedule-selection {
  margin-bottom: 1rem;
}

.dialog-description {
  margin-bottom: 1rem;
  color: #606266;
}
</style> 