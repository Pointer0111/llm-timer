<template>
  <div class="pomodoro-timer">
    <el-card class="timer-card">
      <template #header>
        <div class="timer-header">
          <h2>{{ currentTask ? currentTask.title : '请选择任务' }}</h2>
          <div v-if="currentTask" class="task-info">
            <el-tag :type="getPriorityType(currentTask.priority)" size="small">
              {{ currentTask.priority }}优先级
            </el-tag>
            <span class="task-duration">{{ formatDuration(currentTask.estimatedMinutes) }}</span>
          </div>
        </div>
      </template>
      
      <div class="timer-display">
        <div class="time-display">
          <span class="time">{{ formatTime(timeLeft) }}</span>
          <div class="timer-mode">
            <el-tag :type="isBreak ? 'success' : 'primary'" size="small">
              {{ isBreak ? '休息时间' : '专注时间' }}
            </el-tag>
          </div>
        </div>
      </div>
      
      <div class="timer-controls">
        <el-button 
          type="primary" 
          :icon="isRunning ? 'Pause' : 'VideoPlay'"
          @click="toggleTimer"
          :disabled="!currentTask"
          size="large"
        >
          {{ isRunning ? '暂停' : '开始' }}
        </el-button>
        <el-button 
          type="danger" 
          icon="RefreshRight"
          @click="resetTimer"
          :disabled="!currentTask"
          size="large"
        >
          重置
        </el-button>
      </div>

      <!-- 番茄钟设置 -->
      <div class="pomodoro-settings" v-if="currentTask">
        <el-divider content-position="left">番茄钟设置</el-divider>
        <div class="settings-row">
          <span>专注时长：</span>
          <el-input-number 
            v-model="workTimeMinutes" 
            :min="5" 
            :max="60" 
            size="small"
            @change="updateWorkTime"
          />
          <span>分钟</span>
        </div>
        <div class="settings-row">
          <span>休息时长：</span>
          <el-input-number 
            v-model="breakTimeMinutes" 
            :min="1" 
            :max="30" 
            size="small"
            @change="updateBreakTime"
          />
          <span>分钟</span>
        </div>
      </div>
      
      <div class="pomodoro-progress" v-if="currentTask">
        <el-progress 
          :percentage="getProgressPercentage()"
          :format="format"
          :stroke-width="12"
          :color="getProgressColor"
        />
        <p class="progress-text">
          已完成: {{ formatDuration(completedMinutes) }} / {{ formatDuration(currentTask.estimatedMinutes) }}
        </p>
      </div>

      <div v-if="!currentTask" class="no-task">
        <el-empty description="请从任务列表中选择一个任务开始专注" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskStore, type Task } from '../stores/task'

const taskStore = useTaskStore()
const workTimeMinutes = ref(25)
const breakTimeMinutes = ref(5)
let workTime = computed(() => workTimeMinutes.value * 60)
let breakTime = computed(() => breakTimeMinutes.value * 60)

const timeLeft = ref(workTime.value)
const isRunning = ref(false)
const isBreak = ref(false)
const completedMinutes = ref(0)
let timer: number | null = null

const currentTask = computed(() => taskStore.currentTask)

// 监听当前任务的变化
watch(currentTask, (newTask, oldTask) => {
  if (oldTask && newTask?.id !== oldTask.id) {
    // 任务切换时重置计时器
    resetTimer()
  }
})

// 监听任务完成状态
watch(() => taskStore.allTasks, (tasks) => {
  const currentTaskId = currentTask.value?.id
  if (currentTaskId) {
    const task = tasks.find(t => t.id === currentTaskId)
    if (task && task.isCompleted) {
      // 当前任务被标记为完成，重置计时器
      resetTimer()
      ElMessage.success('任务已完成！')
    }
  }
}, { deep: true })

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

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

const getProgressPercentage = () => {
  if (!currentTask.value) return 0
  return (completedMinutes.value / currentTask.value.estimatedMinutes) * 100
}

const getProgressColor = computed(() => {
  const percentage = getProgressPercentage()
  if (percentage < 30) return '#F56C6C'
  if (percentage < 70) return '#E6A23C'
  return '#67C23A'
})

const updateWorkTime = () => {
  workTime = computed(() => workTimeMinutes.value * 60)
  if (!isRunning.value && !isBreak.value) {
    timeLeft.value = workTime.value
  }
}

const updateBreakTime = () => {
  breakTime = computed(() => breakTimeMinutes.value * 60)
  if (!isRunning.value && isBreak.value) {
    timeLeft.value = breakTime.value
  }
}

// 播放提示音
const playNotificationSound = () => {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT')
    audio.play()
  } catch (error) {
    console.log('无法播放提示音')
  }
}

const toggleTimer = () => {
  if (isRunning.value) {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  } else {
    timer = window.setInterval(() => {
      if (timeLeft.value > 0) {
        timeLeft.value--
      } else {
        if (!isBreak.value) {
          // 工作时间结束，开始休息
          isBreak.value = true
          timeLeft.value = breakTime.value
          
          // 计算完成的分钟数
          const completedWorkMinutes = workTimeMinutes.value
          completedMinutes.value += completedWorkMinutes
          
          // 检查是否完成任务
          if (currentTask.value && completedMinutes.value >= currentTask.value.estimatedMinutes) {
            taskStore.toggleTaskStatus(currentTask.value.id)
            ElMessage.success('任务已完成！')
            resetTimer()
            return
          }
          
          playNotificationSound()
          ElMessage.success(`专注时间结束！开始休息${breakTimeMinutes.value}分钟`)
        } else {
          // 休息时间结束，开始工作
          isBreak.value = false
          timeLeft.value = workTime.value
          playNotificationSound()
          ElMessage.info('休息结束！开始新的专注时间')
        }
      }
    }, 1000)
  }
  isRunning.value = !isRunning.value
}

const resetTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  isRunning.value = false
  isBreak.value = false
  timeLeft.value = workTime.value
  completedMinutes.value = 0
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped>
.pomodoro-timer {
  max-width: 400px;
  margin: 0 auto;
}

.timer-card {
  text-align: center;
}

.timer-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.timer-header h2 {
  margin: 0;
  color: #303133;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.task-duration {
  color: #606266;
  font-size: 0.875rem;
}

.timer-display {
  margin: 2rem 0;
}

.time-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.time {
  font-size: 4rem;
  font-weight: bold;
  color: #303133;
  font-family: 'Courier New', monospace;
}

.timer-mode {
  margin-top: 0.5rem;
}

.timer-controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.pomodoro-settings {
  margin: 1rem 0;
  text-align: left;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  justify-content: center;
}

.settings-row span {
  min-width: 60px;
  text-align: right;
}

.pomodoro-progress {
  margin-top: 2rem;
}

.progress-text {
  margin-top: 0.5rem;
  color: #606266;
  font-size: 0.875rem;
}

.no-task {
  padding: 2rem 0;
}
</style> 