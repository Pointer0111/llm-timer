<template>
  <div class="calendar-view">
    <el-card>
      <template #header>
        <div class="calendar-header">
          <h2>日历视图</h2>
          <div class="calendar-controls">
            <el-button-group>
              <el-button 
                :type="viewType === 'dayGridMonth' ? 'primary' : ''"
                @click="changeView('dayGridMonth')"
              >
                月视图
              </el-button>
              <el-button 
                :type="viewType === 'timeGridWeek' ? 'primary' : ''"
                @click="changeView('timeGridWeek')"
              >
                周视图
              </el-button>
              <el-button 
                :type="viewType === 'timeGridDay' ? 'primary' : ''"
                @click="changeView('timeGridDay')"
              >
                日视图
              </el-button>
            </el-button-group>
          </div>
        </div>
      </template>
      
      <div class="calendar-container">
        <FullCalendar
          ref="calendarRef"
          :options="calendarOptions"
        />
      </div>
    </el-card>

    <!-- 任务详情对话框 -->
    <el-dialog
      v-model="taskDetailVisible"
      title="任务详情"
      width="40%"
    >
      <div v-if="selectedTask" class="task-detail">
        <div class="detail-item">
          <label>任务名称：</label>
          <span>{{ selectedTask.title }}</span>
        </div>
        <div class="detail-item">
          <label>优先级：</label>
          <el-tag :type="getPriorityType(selectedTask.priority)">
            {{ selectedTask.priority }}
          </el-tag>
        </div>
        <div class="detail-item">
          <label>预计时长：</label>
          <span>{{ formatDuration(selectedTask.estimatedMinutes) }}</span>
        </div>
        <div class="detail-item">
          <label>开始时间：</label>
          <span>{{ formatDateTime(selectedTask.startTime) }}</span>
        </div>
        <div class="detail-item">
          <label>结束时间：</label>
          <span>{{ formatDateTime(selectedTask.endTime) }}</span>
        </div>
        <div class="detail-item">
          <label>番茄钟进度：</label>
          <span>{{ selectedTask.completedPomodoros }} / {{ Math.ceil(selectedTask.estimatedMinutes / 25) }}</span>
        </div>
        <div class="detail-item">
          <label>状态：</label>
          <el-tag :type="selectedTask.isCompleted ? 'success' : 'warning'">
            {{ selectedTask.isCompleted ? '已完成' : '进行中' }}
          </el-tag>
        </div>
        <div class="detail-item" v-if="selectedTask.fromAgent">
          <label>安排方式：</label>
          <el-tag type="info">AI智能安排</el-tag>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="taskDetailVisible = false">关闭</el-button>
          <el-button 
            type="primary" 
            @click="selectTaskForPomodoro"
            :disabled="!selectedTask || selectedTask.isCompleted"
          >
            开始专注
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useTaskStore, type Task } from '../stores/task'
import dayjs from 'dayjs'

const taskStore = useTaskStore()
const calendarRef = ref()
const viewType = ref('dayGridMonth')
const taskDetailVisible = ref(false)
const selectedTask = ref<Task | null>(null)

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: viewType.value,
  headerToolbar: false as const, // 使用自定义头部
  locale: 'zh-cn',
  height: 'auto',
  events: taskStore.getCalendarEvents(),
  eventClick: handleEventClick,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  editable: true,
  selectable: true,
  dayMaxEvents: true,
  eventTimeFormat: {
    hour: '2-digit' as const,
    minute: '2-digit' as const,
    hour12: false
  },
  slotMinTime: '08:00:00',
  slotMaxTime: '22:00:00',
  allDaySlot: false,
  slotDuration: '00:30:00',
  slotLabelInterval: '01:00:00',
  snapDuration: '00:15:00', // 15分钟对齐
  slotEventOverlap: false,
  eventOverlap: false,
  eventConstraint: {
    startTime: '08:00',
    endTime: '22:00',
    dows: [0, 1, 2, 3, 4, 5, 6] // 允许所有天
  }
}))

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

const formatDateTime = (timeString: string | undefined) => {
  if (!timeString) return '未设置'
  const date = new Date(timeString.replace(' ', 'T'))
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const changeView = (view: string) => {
  viewType.value = view
  if (calendarRef.value) {
    const calendarApi = calendarRef.value.getApi()
    calendarApi.changeView(view)
  }
}

const handleEventClick = (info: any) => {
  const taskId = parseInt(info.event.id)
  const task = taskStore.allTasks.find(t => t.id === taskId)
  if (task) {
    selectedTask.value = task
    taskDetailVisible.value = true
  }
}

const handleEventDrop = (info: any) => {
  const taskId = parseInt(info.event.id)
  const newStart = info.event.start
  const newEnd = info.event.end || new Date(newStart.getTime() + 60 * 60 * 1000) // 默认1小时
  
  // 确保时间在合理范围内
  const startHour = newStart.getHours()
  const endHour = newEnd.getHours()
  
  if (startHour < 8 || endHour > 22) {
    ElMessage.warning('任务时间必须在8:00-22:00之间')
    // 回滚拖拽
    info.revert()
    return
  }
  
  // 检查时间冲突
  const hasConflict = taskStore.scheduledTasks.some(scheduledTask => {
    if (scheduledTask.id === taskId || !scheduledTask.startTime || !scheduledTask.endTime) return false
    
    const scheduledStart = dayjs(scheduledTask.startTime)
    const scheduledEnd = dayjs(scheduledTask.endTime)
    
    // 检查时间重叠
    return (dayjs(newStart).isBefore(scheduledEnd) && dayjs(newEnd).isAfter(scheduledStart))
  })
  
  if (hasConflict) {
    ElMessage.warning('时间冲突，请选择其他时间段')
    info.revert()
    return
  }
  
  taskStore.updateTaskSchedule(
    taskId,
    dayjs(newStart).format('YYYY-MM-DD HH:mm'),
    dayjs(newEnd).format('YYYY-MM-DD HH:mm'),
    false
  )
  
  ElMessage.success('任务时间已更新')
}

const handleEventResize = (info: any) => {
  const taskId = parseInt(info.event.id)
  const newStart = info.event.start
  const newEnd = info.event.end
  
  // 确保时间在合理范围内
  const startHour = newStart.getHours()
  const endHour = newEnd.getHours()
  
  if (startHour < 8 || endHour > 22) {
    ElMessage.warning('任务时间必须在8:00-22:00之间')
    info.revert()
    return
  }
  
  // 检查时间冲突
  const hasConflict = taskStore.scheduledTasks.some(scheduledTask => {
    if (scheduledTask.id === taskId || !scheduledTask.startTime || !scheduledTask.endTime) return false
    
    const scheduledStart = dayjs(scheduledTask.startTime)
    const scheduledEnd = dayjs(scheduledTask.endTime)
    
    // 检查时间重叠
    return (dayjs(newStart).isBefore(scheduledEnd) && dayjs(newEnd).isAfter(scheduledStart))
  })
  
  if (hasConflict) {
    ElMessage.warning('时间冲突，请选择其他时间段')
    info.revert()
    return
  }
  
  taskStore.updateTaskSchedule(
    taskId,
    dayjs(newStart).format('YYYY-MM-DD HH:mm'),
    dayjs(newEnd).format('YYYY-MM-DD HH:mm'),
    false
  )
  
  ElMessage.success('任务时长已更新')
}

const selectTaskForPomodoro = () => {
  if (selectedTask.value) {
    taskStore.setCurrentTask(selectedTask.value.id)
    taskDetailVisible.value = false
    ElMessage.success('已选择任务，可以开始专注了')
  }
}

// 监听任务变化，更新日历事件
onMounted(() => {
  // 初始化时加载数据
  taskStore.loadFromLocalStorage()
})
</script>

<style scoped>
.calendar-view {
  max-width: 1200px;
  margin: 0 auto;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.calendar-header h2 {
  margin: 0;
}

.calendar-container {
  margin-top: 1rem;
}

.task-detail {
  padding: 1rem 0;
}

.detail-item {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item label {
  font-weight: bold;
  min-width: 100px;
  color: #606266;
}

.detail-item span {
  flex: 1;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

:deep(.fc-event) {
  cursor: pointer;
}

:deep(.fc-event:hover) {
  opacity: 0.8;
}

:deep(.fc-toolbar-title) {
  font-size: 1.2rem;
}

:deep(.fc-button) {
  background-color: #409EFF;
  border-color: #409EFF;
}

:deep(.fc-button:hover) {
  background-color: #66b1ff;
  border-color: #66b1ff;
}

:deep(.fc-button:focus) {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}
</style> 