# Alpha Monitor

一个基于 React + TypeScript + Chakra UI 的 PostgreSQL 数据库实时监控面板。

## 功能特性

- 🔄 **实时监控**: 监听 PostgreSQL 数据库表变化
- 👥 **用户管理**: 重点监控 users 表，显示用户信息和类型
- 📊 **数据概览**: 实时统计各表数据量和连接状态
- 🎯 **事件追踪**: 实时显示数据库 INSERT/UPDATE/DELETE 事件
- 🎨 **现代UI**: 使用 Chakra UI，白绿配色，简洁大方
- 📱 **响应式**: 支持桌面和移动端

## 技术栈

- **前端框架**: React 18.2.0 + TypeScript
- **UI组件库**: Chakra UI 2.8.1
- **样式方案**: Emotion (CSS-in-JS)
- **动画库**: Framer Motion 10.16.4
- **图标库**: React Icons 5.5.0
- **数据库**: PostgreSQL

## 监控的数据表

### 主要表 (重点监控)
- `users` - 用户表

### 辅助表
- `orders` - 订单表
- `user_assets` - 用户资产表
- `asset_history` - 资产历史记录表
- `strategies` - 策略表
- `trades` - 交易表
- `user_strategy_tracking` - 用户策略跟踪表

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm start
```

应用将在 http://localhost:3000 启动。

### 3. 构建生产版本

```bash
npm run build
```

## 项目结构

```
src/
├── components/          # React 组件
│   ├── ConnectionStatus.tsx    # 数据库连接状态
│   ├── EventsMonitor.tsx      # 实时事件监控
│   ├── StatsOverview.tsx      # 数据统计概览
│   └── UsersTable.tsx         # 用户表显示
├── context/            # React Context
│   └── DatabaseContext.tsx   # 数据库状态管理
├── services/           # 服务层
│   └── database.ts           # 数据库连接服务
├── types/              # TypeScript 类型定义
│   └── database.ts           # 数据库表类型
├── theme/              # 主题配置
│   └── index.ts              # Chakra UI 主题
├── App.tsx             # 主应用组件
└── index.tsx           # 应用入口
```

## 主要组件说明

### ConnectionStatus
- 显示数据库连接状态
- 提供连接/断开/刷新操作
- 显示监听的表列表

### UsersTable
- 显示用户表数据
- 区分管理员和普通用户
- 支持用户信息详细展示

### EventsMonitor
- 实时显示数据库变更事件
- 支持事件类型过滤和高亮
- 动画效果展示新事件

### StatsOverview
- 数据统计卡片
- 实时更新各表数据量
- 连接状态和事件统计

## 配置说明

### 数据库连接

目前使用模拟数据进行演示。在生产环境中，需要:

1. 配置 PostgreSQL 连接参数
2. 实现真实的数据库监听逻辑
3. 设置适当的数据库权限

### 主题定制

在 `src/theme/index.ts` 中可以自定义:
- 颜色方案 (当前为白绿配色)
- 字体设置
- 组件样式

## 开发说明

### 添加新的监控表

1. 在 `src/types/database.ts` 中添加表类型定义
2. 在 `src/services/database.ts` 中添加查询方法
3. 在 `src/context/DatabaseContext.tsx` 中添加状态管理
4. 创建对应的显示组件

### 自定义事件处理

在 `DatabaseContext` 的 `handleDatabaseEvent` 方法中可以添加自定义的事件处理逻辑。

## 许可证

MIT License