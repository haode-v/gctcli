# Alpha Monitor - Windows 部署说明

## 系统要求

- Windows 10 或更高版本
- PostgreSQL 数据库（推荐版本 12 或更高）
- 至少 4GB 可用内存
- 至少 1GB 可用磁盘空间

## 文件说明

- `alpha-monitor.exe` - 主应用程序可执行文件
- `build/` - 前端静态文件目录
- `database/` - 数据库初始化脚本目录
- `start.bat` - 快速启动脚本
- `README.md` - 本说明文档

## 安装步骤

### 1. 安装 PostgreSQL

1. 下载并安装 PostgreSQL：https://www.postgresql.org/download/windows/
2. 记住安装时设置的数据库密码
3. 确保 PostgreSQL 服务正在运行

### 2. 创建数据库

1. 打开 pgAdmin 或使用命令行工具
2. 创建新数据库，建议命名为 `alpha_monitor`
3. 运行 `database/` 目录下的 SQL 脚本来初始化数据库结构：
   - `users_db.sql` - 用户表
   - `assets_db.sql` - 资产表
   - `strategy_and_trades_db.sql` - 策略和交易表
   - `user_strategies_db.sql` - 用户策略表
   - `alpha_db.sql` - Alpha 数据表
   - `add_avg_price_column.sql` - 平均价格列
   - `migrations/add_optimization_tables.sql` - 优化表

### 3. 配置环境变量

在运行应用前，需要设置以下环境变量（可以在系统环境变量中设置，或创建 `.env` 文件）：

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=alpha_monitor
DB_USER=postgres
DB_PASSWORD=你的数据库密码
PORT=24797
```

## 运行应用

### 方法一：使用启动脚本（推荐）

1. 双击 `start.bat` 文件
2. 等待应用启动完成
3. 打开浏览器访问：http://localhost:24797

### 方法二：命令行运行

1. 打开命令提示符（CMD）
2. 导航到应用目录
3. 运行：`alpha-monitor.exe`
4. 打开浏览器访问：http://localhost:24797

## 使用说明

1. **首次使用**：需要先注册用户账号
2. **登录系统**：使用注册的用户名和密码登录
3. **功能模块**：
   - 资产管理：添加和管理投资资产
   - 策略配置：设置投资策略
   - 交易记录：查看和管理交易历史
   - Alpha 分析：查看投资表现分析

## 故障排除

### 应用无法启动

1. 检查 PostgreSQL 是否正在运行
2. 确认数据库连接信息是否正确
3. 检查端口 24797 是否被其他程序占用
4. 查看控制台错误信息

### 无法访问网页

1. 确认应用已成功启动
2. 检查防火墙设置，确保允许访问端口 24797
3. 尝试使用 http://127.0.0.1:24797 访问

### 数据库连接错误

1. 确认 PostgreSQL 服务正在运行
2. 检查数据库用户名和密码
3. 确认数据库名称是否正确
4. 检查数据库是否已正确初始化

## 技术支持

如遇到其他问题，请检查：

1. 控制台输出的错误信息
2. PostgreSQL 日志文件
3. 确保所有依赖文件完整

## 注意事项

- 请定期备份数据库数据
- 建议在生产环境中使用更强的数据库密码
- 如需修改端口，请同时更新环境变量和防火墙设置
- 首次运行可能需要较长时间来初始化

---

**版本信息**：Alpha Monitor v0.1.0  
**构建日期**：2024年12月15日  
**支持平台**：Windows 10/11 x64