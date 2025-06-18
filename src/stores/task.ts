import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { DEEPSEEK_CONFIG, isApiConfigured } from '../config/api'

export interface Task {
  id: number
  title: string
  estimatedMinutes: number       // 预估时长（分钟）
  priority: '高' | '中' | '低'
  isCompleted: boolean
  startTime?: string             // YYYY-MM-DD HH:mm
  endTime?: string
  fromAgent?: boolean            // 是否由智能Agent安排
  isMultiDay?: boolean           // 是否为跨天任务
  createdAt: Date
  completedPomodoros: number     // 已完成的番茄钟数量
}

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: [] as Task[],
    nextId: 1,
    currentTaskId: null as number | null
  }),
  
  getters: {
    allTasks: (state) => state.tasks,
    activeTasks: (state) => state.tasks.filter(task => !task.isCompleted),
    completedTasks: (state) => state.tasks.filter(task => task.isCompleted),
    tasksByPriority: (state) => {
      const priorityOrder = { '高': 3, '中': 2, '低': 1 }
      return [...state.tasks].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    },
    scheduledTasks: (state) => state.tasks.filter(task => task.startTime && task.endTime),
    currentTask: (state) => state.tasks.find(task => task.id === state.currentTaskId)
  },
  
  actions: {
    addTask(title: string, estimatedMinutes: number, priority: '高' | '中' | '低' = '中') {
      const task: Task = {
        id: this.nextId++,
        title,
        estimatedMinutes,
        priority,
        isCompleted: false,
        createdAt: new Date(),
        completedPomodoros: 0
      }
      this.tasks.push(task)
      this.saveToLocalStorage()
      return task
    },
    
    deleteTask(id: number) {
      const index = this.tasks.findIndex(task => task.id === id)
      if (index !== -1) {
        this.tasks.splice(index, 1)
        this.saveToLocalStorage()
      }
    },
    
    toggleTaskStatus(id: number) {
      const task = this.tasks.find(task => task.id === id)
      if (task) {
        task.isCompleted = !task.isCompleted
        this.saveToLocalStorage()
      }
    },
    
    incrementPomodoro(id: number) {
      const task = this.tasks.find(task => task.id === id)
      if (task) {
        task.completedPomodoros++
        this.saveToLocalStorage()
      }
    },

    updateTaskSchedule(id: number, startTime: string, endTime: string, fromAgent: boolean = false) {
      const task = this.tasks.find(task => task.id === id)
      if (task) {
        task.startTime = startTime
        task.endTime = endTime
        task.fromAgent = fromAgent
        this.saveToLocalStorage()
      }
    },

    setCurrentTask(id: number | null) {
      this.currentTaskId = id
    },

    // 自然语言解析任务
    async parseNaturalLanguage(input: string) {
      try {
        // 调用DeepSeek API进行自然语言解析
        const parsedTasks = await this.parseWithDeepSeek(input)
        if (parsedTasks && parsedTasks.length > 0) {
          const createdTasks = []
          
          for (const parsedTask of parsedTasks) {
            const task = this.addTask(parsedTask.title, parsedTask.estimatedMinutes, parsedTask.priority)
            
            // 如果解析出了具体时间，使用解析的时间；否则进行智能排期
            if (parsedTask.startTime && parsedTask.endTime) {
              this.updateTaskSchedule(
                task.id,
                parsedTask.startTime,
                parsedTask.endTime,
                true
              )
            } else {
              // 自动进行智能排期
              await this.scheduleSingleTask(task.id)
            }
            
            createdTasks.push(task)
          }
          
          return createdTasks
        }
      } catch (error) {
        console.error('自然语言解析失败:', error)
        // 如果API调用失败，回退到简单解析
        const parsed = this.simpleParseNaturalLanguage(input)
        if (parsed) {
          const task = this.addTask(parsed.title, parsed.estimatedMinutes, parsed.priority)
          await this.scheduleSingleTask(task.id)
          return [task]
        }
      }
      return null
    },

    // 使用DeepSeek API解析自然语言
    async parseWithDeepSeek(input: string) {
      const prompt = `你是一个智能任务解析助手。请将用户的自然语言输入解析为结构化的任务信息。

用户输入：${input}

请返回JSON格式的任务数组，每个任务包含以下字段：
- title: 任务标题
- estimatedMinutes: 预计时长（分钟）
- priority: 优先级（高/中/低）
- startTime: 开始时间（YYYY-MM-DD HH:mm格式，如果用户指定了具体时间）
- endTime: 结束时间（YYYY-MM-DD HH:mm格式，如果用户指定了具体时间）

注意事项：
1. 如果用户说"明天"，请计算明天的日期
2. 如果用户说"上午"，默认时间为9:00-12:00之间
3. 如果用户说"下午"，默认时间为14:00-18:00之间
4. 如果用户说"晚上"，默认时间为19:00-22:00之间
5. 如果用户没有指定具体时间，startTime和endTime字段留空
6. 优先级根据任务重要性判断，包含"重要"、"紧急"等关键词的设为"高"

示例输出：
[
  {
    "title": "开会",
    "estimatedMinutes": 120,
    "priority": "高",
    "startTime": "2024-06-19 09:00",
    "endTime": "2024-06-19 11:00"
  },
  {
    "title": "写报告",
    "estimatedMinutes": 60,
    "priority": "中",
    "startTime": "2024-06-19 14:00",
    "endTime": "2024-06-19 15:00"
  }
]

请只返回JSON格式的数据，不要包含其他文字。`

      try {
        if (isApiConfigured()) {
          // 使用真实的DeepSeek API
          const response = await fetch(DEEPSEEK_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DEEPSEEK_CONFIG.API_KEY}`
            },
            body: JSON.stringify({
              model: DEEPSEEK_CONFIG.MODEL,
              messages: [{ role: 'user', content: prompt }],
              temperature: DEEPSEEK_CONFIG.TEMPERATURE,
              max_tokens: DEEPSEEK_CONFIG.MAX_TOKENS
            })
          })
          
          if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`)
          }
          
          const data = await response.json()
          const content = data.choices[0].message.content
          
          // 解析JSON响应
          const jsonMatch = content.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const tasks = JSON.parse(jsonMatch[0])
            return tasks
          }
        } else {
          // 如果API未配置，使用模拟响应
          console.warn('DeepSeek API未配置，使用模拟响应')
          const mockResponse = this.mockDeepSeekResponse(input)
          const content = mockResponse
          
          // 解析JSON响应
          const jsonMatch = content.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const tasks = JSON.parse(jsonMatch[0])
            return tasks
          }
        }
        
        return null
      } catch (error) {
        console.error('DeepSeek API调用失败:', error)
        // 如果API调用失败，回退到模拟响应
        const mockResponse = this.mockDeepSeekResponse(input)
        const content = mockResponse
        
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const tasks = JSON.parse(jsonMatch[0])
          return tasks
        }
        
        throw error
      }
    },

    // 模拟DeepSeek API响应（临时使用）
    mockDeepSeekResponse(input: string) {
      const now = dayjs()
      const tomorrow = now.add(1, 'day')
      
      if (input.includes('明天上午开会2小时') && input.includes('下午写报告1小时')) {
        return JSON.stringify([
          {
            "title": "开会",
            "estimatedMinutes": 120,
            "priority": "高",
            "startTime": `${tomorrow.format('YYYY-MM-DD')} 09:00`,
            "endTime": `${tomorrow.format('YYYY-MM-DD')} 11:00`
          },
          {
            "title": "写报告",
            "estimatedMinutes": 60,
            "priority": "中",
            "startTime": `${tomorrow.format('YYYY-MM-DD')} 14:00`,
            "endTime": `${tomorrow.format('YYYY-MM-DD')} 15:00`
          }
        ])
      }
      
      if (input.includes('明天上午读书1小时')) {
        return JSON.stringify([
          {
            "title": "读书",
            "estimatedMinutes": 60,
            "priority": "中",
            "startTime": `${tomorrow.format('YYYY-MM-DD')} 09:00`,
            "endTime": `${tomorrow.format('YYYY-MM-DD')} 10:00`
          }
        ])
      }
      
      // 默认解析
      const parsed = this.simpleParseNaturalLanguage(input)
      if (parsed) {
        return JSON.stringify([{
          "title": parsed.title,
          "estimatedMinutes": parsed.estimatedMinutes,
          "priority": parsed.priority,
          "startTime": "",
          "endTime": ""
        }])
      }
      
      return JSON.stringify([])
    },

    // 为单个任务进行智能排期
    async scheduleSingleTask(taskId: number) {
      const task = this.tasks.find(t => t.id === taskId)
      if (!task || task.startTime) return

      // 获取当前时间，如果当前时间超过下午6点，从明天开始安排
      const now = dayjs()
      let startTime: dayjs.Dayjs
      
      if (now.hour() >= 18) {
        // 如果当前时间超过下午6点，从明天上午9点开始
        startTime = now.add(1, 'day').startOf('day').add(9, 'hour')
      } else if (now.hour() < 9) {
        // 如果当前时间早于上午9点，从今天上午9点开始
        startTime = now.startOf('day').add(9, 'hour')
      } else {
        // 如果当前时间在9-18点之间，从当前时间后30分钟开始
        startTime = now.add(30, 'minute').startOf('minute')
      }

      // 查找合适的时间段（避免冲突）
      let currentTime = startTime
      let attempts = 0
      const maxAttempts = 7 // 最多尝试7天
      
      while (attempts < maxAttempts) {
        const taskEndTime = currentTime.add(task.estimatedMinutes, 'minute')
        
        // 检查是否与现有任务冲突
        const hasConflict = this.scheduledTasks.some(scheduledTask => {
          if (!scheduledTask.startTime || !scheduledTask.endTime) return false
          
          const scheduledStart = dayjs(scheduledTask.startTime)
          const scheduledEnd = dayjs(scheduledTask.endTime)
          
          // 检查时间重叠
          return (currentTime.isBefore(scheduledEnd) && taskEndTime.isAfter(scheduledStart))
        })
        
        if (!hasConflict) {
          // 如果任务结束时间超过晚上10点，移到第二天
          if (taskEndTime.hour() >= 22) {
            currentTime = currentTime.add(1, 'day').startOf('day').add(9, 'hour')
            attempts++
            continue
          }
          
          // 找到合适的时间段，安排任务
          this.updateTaskSchedule(
            task.id,
            currentTime.format('YYYY-MM-DD HH:mm'),
            taskEndTime.format('YYYY-MM-DD HH:mm'),
            true
          )
          return
        }
        
        // 有冲突，尝试下一个时间段
        currentTime = currentTime.add(15, 'minute')
        
        // 如果当前时间超过晚上10点，移到第二天
        if (currentTime.hour() >= 22) {
          currentTime = currentTime.add(1, 'day').startOf('day').add(9, 'hour')
          attempts++
        }
      }
      
      // 如果找不到合适的时间段，安排在最后
      const lastScheduledTask = this.scheduledTasks
        .filter(t => t.startTime && t.endTime)
        .sort((a, b) => dayjs(b.endTime!).valueOf() - dayjs(a.endTime!).valueOf())[0]
      
      if (lastScheduledTask && lastScheduledTask.endTime) {
        const lastEndTime = dayjs(lastScheduledTask.endTime)
        const newStartTime = lastEndTime.add(15, 'minute')
        const newEndTime = newStartTime.add(task.estimatedMinutes, 'minute')
        
        this.updateTaskSchedule(
          task.id,
          newStartTime.format('YYYY-MM-DD HH:mm'),
          newEndTime.format('YYYY-MM-DD HH:mm'),
          true
        )
      } else {
        // 没有已安排的任务，使用默认时间
        const defaultStartTime = startTime
        const defaultEndTime = defaultStartTime.add(task.estimatedMinutes, 'minute')
        
        this.updateTaskSchedule(
          task.id,
          defaultStartTime.format('YYYY-MM-DD HH:mm'),
          defaultEndTime.format('YYYY-MM-DD HH:mm'),
          true
        )
      }
    },

    // 简单的自然语言解析（临时实现）
    simpleParseNaturalLanguage(input: string) {
      const timePatterns = [
        { pattern: /(\d+)\s*小时/, multiplier: 60 },
        { pattern: /(\d+)\s*分钟/, multiplier: 1 },
        { pattern: /(\d+)\s*小时\s*(\d+)\s*分钟/, multiplier: 60 }
      ]

      let estimatedMinutes = 60 // 默认1小时
      let priority: '高' | '中' | '低' = '中'

      // 解析时长
      for (const timePattern of timePatterns) {
        const match = input.match(timePattern.pattern)
        if (match) {
          if (match[2]) {
            // 小时+分钟格式
            estimatedMinutes = parseInt(match[1]) * 60 + parseInt(match[2])
          } else {
            // 单一时间格式
            estimatedMinutes = parseInt(match[1]) * timePattern.multiplier
          }
          break
        }
      }

      // 解析优先级
      if (input.includes('重要') || input.includes('紧急') || input.includes('高优先级')) {
        priority = '高'
      } else if (input.includes('一般') || input.includes('普通')) {
        priority = '中'
      } else if (input.includes('低优先级') || input.includes('不紧急')) {
        priority = '低'
      }

      // 提取任务标题（移除时间相关词汇）
      let title = input
        .replace(/\d+\s*小时/g, '')
        .replace(/\d+\s*分钟/g, '')
        .replace(/重要|紧急|高优先级|一般|普通|低优先级|不紧急/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (title) {
        return { title, estimatedMinutes, priority }
      }
      return null
    },

    // 智能排期功能
    async scheduleTasksWithAgent() {
      const activeTasks = this.activeTasks.filter(task => !task.startTime)
      if (activeTasks.length === 0) return

      try {
        // 这里应该调用LLM API进行智能排期
        // 暂时使用简单的本地排期逻辑
        await this.simpleScheduleTasks(activeTasks)
      } catch (error) {
        console.error('智能排期失败:', error)
      }
    },

    // 简单的本地排期逻辑（临时实现）
    async simpleScheduleTasks(tasks: Task[]) {
      // 获取当前时间，如果当前时间超过下午6点，从明天开始安排
      const now = dayjs()
      let startTime: dayjs.Dayjs
      
      if (now.hour() >= 18) {
        // 如果当前时间超过下午6点，从明天上午9点开始
        startTime = now.add(1, 'day').startOf('day').add(9, 'hour')
      } else if (now.hour() < 9) {
        // 如果当前时间早于上午9点，从今天上午9点开始
        startTime = now.startOf('day').add(9, 'hour')
      } else {
        // 如果当前时间在9-18点之间，从当前时间后30分钟开始
        startTime = now.add(30, 'minute').startOf('minute')
      }

      let currentTime = startTime

      // 按优先级排序
      const priorityOrder = { '高': 3, '中': 2, '低': 1 }
      const sortedTasks = [...tasks].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])

      for (const task of sortedTasks) {
        const endTime = currentTime.add(task.estimatedMinutes, 'minute')
        
        // 如果任务结束时间超过晚上10点，移到第二天
        if (endTime.hour() >= 22) {
          currentTime = currentTime.add(1, 'day').startOf('day').add(9, 'hour')
        }
        
        const taskEndTime = currentTime.add(task.estimatedMinutes, 'minute')
        
        this.updateTaskSchedule(
          task.id,
          currentTime.format('YYYY-MM-DD HH:mm'),
          taskEndTime.format('YYYY-MM-DD HH:mm'),
          true
        )

        // 下一个任务开始时间（间隔15分钟）
        currentTime = taskEndTime.add(15, 'minute')
      }
    },

    // 获取日历事件数据
    getCalendarEvents() {
      return this.scheduledTasks.map(task => ({
        id: task.id.toString(),
        title: task.title,
        start: task.startTime,
        end: task.endTime,
        backgroundColor: task.fromAgent ? '#409EFF' : '#67C23A',
        borderColor: task.fromAgent ? '#409EFF' : '#67C23A',
        extendedProps: {
          priority: task.priority,
          fromAgent: task.fromAgent
        }
      }))
    },

    // 本地存储
    saveToLocalStorage() {
      localStorage.setItem('llm-timer-tasks', JSON.stringify(this.tasks))
      localStorage.setItem('llm-timer-nextId', this.nextId.toString())
    },

    loadFromLocalStorage() {
      const tasks = localStorage.getItem('llm-timer-tasks')
      const nextId = localStorage.getItem('llm-timer-nextId')
      
      if (tasks) {
        this.tasks = JSON.parse(tasks).map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt)
        }))
      }
      
      if (nextId) {
        this.nextId = parseInt(nextId)
      }
    }
  }
}) 