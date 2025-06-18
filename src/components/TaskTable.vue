<template>
  <el-table :data="tasks" style="width: 100%">
    <el-table-column prop="title" label="任务名称" min-width="200">
      <template #default="{ row }">
        <div class="task-title">
          <span>{{ row.title }}</span>
          <el-tag 
            v-if="row.fromAgent" 
            size="small" 
            type="info"
            class="agent-tag"
          >
            AI安排
          </el-tag>
        </div>
      </template>
    </el-table-column>
    
    <el-table-column label="优先级" width="80">
      <template #default="{ row }">
        <el-tag 
          :type="getPriorityType(row.priority)" 
          size="small"
        >
          {{ row.priority }}
        </el-tag>
      </template>
    </el-table-column>
    
    <el-table-column label="时长" width="100">
      <template #default="{ row }">
        <span>{{ formatDuration(row.estimatedMinutes) }}</span>
      </template>
    </el-table-column>
    
    <el-table-column label="时间安排" width="200">
      <template #default="{ row }">
        <div v-if="row.startTime && row.endTime" class="time-schedule">
          <div>{{ formatTime(row.startTime) }}</div>
          <div class="time-separator">至</div>
          <div>{{ formatTime(row.endTime) }}</div>
        </div>
        <span v-else class="no-schedule">未安排</span>
      </template>
    </el-table-column>
    
    <el-table-column label="番茄钟进度" width="150">
      <template #default="{ row }">
        <el-progress 
          :percentage="getPomodoroPercentage(row)"
          :format="format"
          :stroke-width="8"
        />
        <div class="pomodoro-count">
          {{ row.completedPomodoros }} / {{ Math.ceil(row.estimatedMinutes / 25) }}
        </div>
      </template>
    </el-table-column>
    
    <el-table-column label="状态" width="100">
      <template #default="{ row }">
        <el-tag :type="row.isCompleted ? 'success' : 'warning'">
          {{ row.isCompleted ? '已完成' : '进行中' }}
        </el-tag>
      </template>
    </el-table-column>
    
    <el-table-column label="操作" width="200">
      <template #default="{ row }">
        <div class="action-buttons">
          <el-button
            type="primary"
            size="small"
            @click="selectTask(row.id)"
            :disabled="row.isCompleted"
          >
            选择
          </el-button>
          <el-button
            type="warning"
            size="small"
            @click="showScheduleDialog(row)"
            :disabled="row.isCompleted"
          >
            排期
          </el-button>
        <el-button
            :type="row.isCompleted ? 'warning' : 'success'"
          size="small"
          @click="toggleTaskStatus(row.id)"
        >
            {{ row.isCompleted ? '标记未完成' : '标记完成' }}
        </el-button>
        <el-button
          type="danger"
          size="small"
          @click="deleteTask(row.id)"
        >
          删除
        </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>

  <!-- 自定义排期对话框 -->
  <el-dialog
    v-model="scheduleDialogVisible"
    title="自定义排期"
    width="40%"
  >
    <div v-if="selectedTaskForSchedule" class="schedule-form">
      <div class="form-item">
        <label>任务名称：</label>
        <span>{{ selectedTaskForSchedule.title }}</span>
      </div>
      <div class="form-item">
        <label>开始时间：</label>
        <el-date-picker
          v-model="scheduleStartTime"
          type="datetime"
          placeholder="选择开始时间"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DD HH:mm"
          :disabled-date="disabledDate"
          :disabled-time="disabledTime"
        />
      </div>
      <div class="form-item">
        <label>结束时间：</label>
        <el-date-picker
          v-model="scheduleEndTime"
          type="datetime"
          placeholder="选择结束时间"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DD HH:mm"
          :disabled-date="disabledDate"
          :disabled-time="disabledTime"
        />
      </div>
      <div class="form-item">
        <label>预计时长：</label>
        <span>{{ formatDuration(selectedTaskForSchedule.estimatedMinutes) }}</span>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="scheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSchedule">保存排期</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskStore, type Task } from '../stores/task'
import dayjs from 'dayjs'

const props = defineProps<{
  tasks: Task[]
}>()

const taskStore = useTaskStore()
const scheduleDialogVisible = ref(false)
const selectedTaskForSchedule = ref<Task | null>(null)
const scheduleStartTime = ref('')
const scheduleEndTime = ref('')

const format = (percentage: number) => {
  return `${Math.round(percentage)}%`
}

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

const formatTime = (timeString: string) => {
  const date = new Date(timeString.replace(' ', 'T'))
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getPomodoroPercentage = (task: Task) => {
  const totalPomodoros = Math.ceil(task.estimatedMinutes / 25)
  if (totalPomodoros === 0) return 0
  return (task.completedPomodoros / totalPomodoros) * 100
}

const selectTask = (id: number) => {
  taskStore.setCurrentTask(id)
}

const toggleTaskStatus = (id: number) => {
  taskStore.toggleTaskStatus(id)
}

const deleteTask = (id: number) => {
  taskStore.deleteTask(id)
}

const showScheduleDialog = (task: Task) => {
  selectedTaskForSchedule.value = task
  scheduleStartTime.value = task.startTime || ''
  scheduleEndTime.value = task.endTime || ''
  scheduleDialogVisible.value = true
}

const disabledDate = (time: Date) => {
  return time.getTime() < Date.now() - 8.64e7 // 禁用过去的日期
}

const disabledTime = (date: Date) => {
  if (!date) return {}
  
  const hour = date.getHours()
  if (hour < 8 || hour >= 22) {
    return {
      hours: () => Array.from({ length: 24 }, (_, i) => i).filter(h => h < 8 || h >= 22)
    }
  }
  return {}
}

const saveSchedule = () => {
  if (!selectedTaskForSchedule.value) return
  
  if (!scheduleStartTime.value || !scheduleEndTime.value) {
    ElMessage.warning('请选择开始和结束时间')
    return
  }
  
  const startTime = dayjs(scheduleStartTime.value)
  const endTime = dayjs(scheduleEndTime.value)
  
  if (startTime.isAfter(endTime)) {
    ElMessage.error('开始时间不能晚于结束时间')
    return
  }
  
  const duration = endTime.diff(startTime, 'minute')
  const estimatedDuration = selectedTaskForSchedule.value.estimatedMinutes
  
  if (Math.abs(duration - estimatedDuration) > 30) {
    ElMessage.warning(`时间跨度与预计时长差异较大（${duration}分钟 vs ${estimatedDuration}分钟）`)
  }
  
  taskStore.updateTaskSchedule(
    selectedTaskForSchedule.value.id,
    scheduleStartTime.value,
    scheduleEndTime.value,
    false
  )
  
  scheduleDialogVisible.value = false
  ElMessage.success('排期已保存')
}
</script> 

<style scoped>
.task-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.agent-tag {
  font-size: 0.75rem;
}

.time-schedule {
  font-size: 0.875rem;
  line-height: 1.2;
}

.time-separator {
  color: #909399;
  font-size: 0.75rem;
  margin: 0.25rem 0;
}

.no-schedule {
  color: #909399;
  font-style: italic;
}

.pomodoro-count {
  font-size: 0.75rem;
  color: #606266;
  margin-top: 0.25rem;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.schedule-form {
  padding: 1rem 0;
}

.form-item {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.form-item label {
  min-width: 80px;
  font-weight: bold;
  color: #606266;
}

.form-item span {
  flex: 1;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}
</style> 