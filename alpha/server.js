const express = require('express');
const cors = require('cors');
const { Client, Pool } = require('pg');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = process.env.PORT || 3001;

// WebSocket管理器
class WebSocketManager {
  constructor() {
    this.clients = new Set();
    this.heartbeatTimer = null;
    this.startHeartbeat();
  }

  addClient(ws) {
    this.clients.add(ws);
    ws.isAlive = true;
    ws.lastPing = Date.now();
    Logger.logInfo('新的WebSocket连接');
    
    // 发送连接成功消息
    this.sendToClient(ws, {
      type: 'connected',
      message: '连接成功',
      timestamp: new Date().toISOString()
    });
  }

  removeClient(ws) {
    this.clients.delete(ws);
    Logger.logInfo('WebSocket连接已断开');
  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        Logger.logError('发送WebSocket消息', error);
        this.removeClient(ws);
      }
    }
  }

  broadcast(type, data) {
    if (this.clients.size === 0) {
      return; // 没有客户端连接，直接返回
    }

    const message = { type, data, timestamp: new Date().toISOString() };
    const deadClients = [];

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          Logger.logError('广播WebSocket消息', error);
          deadClients.push(client);
        }
      } else {
        deadClients.push(client);
      }
    });

    // 清理无效连接
    deadClients.forEach(client => this.removeClient(client));

    if (deadClients.length > 0) {
      Logger.logInfo(`清理了 ${deadClients.length} 个无效的WebSocket连接`);
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const deadClients = [];
      
      this.clients.forEach(ws => {
        if (!ws.isAlive || (Date.now() - ws.lastPing) > 60000) {
          deadClients.push(ws);
        } else {
          ws.isAlive = false;
          ws.ping();
        }
      });
      
      deadClients.forEach(ws => {
        ws.terminate();
        this.removeClient(ws);
      });
    }, 30000); // 每30秒检查一次
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      Logger.logInfo('WebSocket心跳定时器已停止');
    }
  }

  closeAll() {
    Logger.logInfo(`正在关闭 ${this.clients.size} 个WebSocket连接...`);
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, '服务器关闭');
      }
    });
    this.clients.clear();
    this.stopHeartbeat();
  }
}

// 创建WebSocket管理器实例
const wsManager = new WebSocketManager();

// 中间件
app.use(cors());
app.use(express.json());

// 密码哈希工具函数
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// 简化的数据库配置
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 15000, // 连接超时15秒
  query_timeout: 60000, // 查询超时60秒（增加以应对大数据量查询）
  statement_timeout: 60000, // 语句超时60秒（增加以应对大数据量查询）
  // 连接池配置
  max: 20, // 最大连接数
  min: 2,  // 最小连接数
  idle: 10000, // 空闲连接超时时间
  // SSL配置（适用于远程数据库）
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false // 对于自签名证书
  } : false,
  // 连接保活
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // 应用名称（便于数据库监控）
  application_name: 'alpha_monitor_backend'
};

// 数据库连接池
let pool = null;
let client = null; // 保持向后兼容

// 统一缓存管理器
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5分钟
    this.startCleanupTimer();
  }

  get(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  set(key, data, ttl = this.CACHE_TTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    Logger.logInfo('缓存已清除');
  }

  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];
      this.cache.forEach((value, key) => {
        if (now - value.timestamp > value.ttl) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    }, 60000); // 每分钟清理一次
  }

  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// 统一日志管理器
class Logger {
  static logDataChange(tableName, action, recordId = null) {
    console.log(`[DATA CHANGE] ${tableName} - ${action} - ${recordId} at ${new Date().toISOString()}`);
  }

  static logError(operation, error) {
    console.error(`[ERROR] ${operation}:`, error.message || error);
  }

  static logInfo(message) {
    console.log(`[INFO] ${message}`);
  }
}

// 创建缓存管理器实例
const cacheManager = new CacheManager();
let lastDataRefreshTime = 0;

// 数据库索引优化函数
async function optimizeDatabase() {
  try {
    Logger.logInfo('开始优化数据库索引...');
    
    // 检查并创建必要的索引
    const indexQueries = [
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_assets_updated_at ON user_assets(last_updated_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_assets_uuid ON user_assets(uuid)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_strategies_created_at ON strategies(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ust_created_at ON user_strategy_tracking(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ust_user_id ON user_strategy_tracking(user_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ust_strategy_id ON user_strategy_tracking(strategy_id)'
    ];
    
    for (const query of indexQueries) {
      try {
        await client.query(query);
        Logger.logInfo(`索引创建成功: ${query.split(' ')[5]}`);
      } catch (error) {
        // 索引已存在或其他错误，记录但不中断
        Logger.logInfo(`索引跳过: ${error.message}`);
      }
    }
    
    Logger.logInfo('数据库索引优化完成');
  } catch (error) {
    Logger.logError('数据库索引优化失败', error);
  }
}

// 数据服务类
class DataService {
  // 获取用户数据（支持过滤条件）
  static async getUsers(filters = {}) {
    const { status, search, limit, offset, sortBy = 'created_at', sortOrder = 'DESC' } = filters;
    const cacheKey = `users_${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    let whereConditions = ["u.status != 'inactive'"];
    let queryParams = [];
    let paramIndex = 1;
    
    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }
    
    if (search) {
      whereConditions.push(`(username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY CASE WHEN u.status = 'unauthenticated' THEN 0 ELSE 1 END, ${sortBy} ${sortOrder}`;
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const offsetClause = offset ? `OFFSET ${offset}` : '';
    
    const query = `
      SELECT u.*, uls.status as login_status, uls.qr_code_status 
      FROM users u 
      LEFT JOIN user_login_status uls ON u.id = uls.user_id 
      ${whereClause} ${orderClause} ${limitClause} ${offsetClause}
    `;
    
    try {
      const result = await client.query(query, queryParams);
      const data = result.rows;
      // 增加缓存时间到5分钟，减少频繁查询
      cacheManager.set(cacheKey, data, 300000); // 1分钟缓存
      return data;
    } catch (error) {
      Logger.logError('获取用户数据', error);
      throw error;
    }
  }
  
  // 获取订单数据（支持过滤条件）
  static async getOrders(filters = {}) {
    const { userId, status, dateFrom, dateTo, limit = 500, offset = 0 } = filters;
    const cacheKey = `orders_${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (userId) {
      whereConditions.push(`o.user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }
    
    if (status) {
      whereConditions.push(`o.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }
    
    if (dateFrom) {
      whereConditions.push(`o.created_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      whereConditions.push(`o.created_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const query = `
      SELECT o.*, u.username 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ${whereClause}
      ORDER BY o.created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    try {
      const result = await client.query(query, queryParams);
      const data = result.rows;
      cacheManager.set(cacheKey, data, 60000);
      return data;
    } catch (error) {
      Logger.logError('获取订单数据', error);
      throw error;
    }
  }
  
  // 获取用户资产数据（支持过滤条件）
  static async getUserAssets(filters = {}) {
    const { userId, symbol, limit = 500, offset = 0 } = filters;
    const cacheKey = `user_assets_${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (userId) {
      whereConditions.push(`ua.uuid = (SELECT UUID FROM users WHERE id = $${paramIndex})`);
      queryParams.push(userId);
      paramIndex++;
    }
    
    if (symbol) {
      whereConditions.push(`ua.symbol = $${paramIndex}`);
      queryParams.push(symbol);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const query = `
      SELECT ua.*, u.username 
      FROM user_assets ua 
      LEFT JOIN users u ON ua.uuid = u.UUID 
      ${whereClause}
      ORDER BY ua.last_updated_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    try {
      const result = await client.query(query, queryParams);
      const data = result.rows;
      cacheManager.set(cacheKey, data, 60000);
      return data;
    } catch (error) {
      Logger.logError('获取用户资产数据', error);
      throw error;
    }
  }
  
  // 获取策略数据（支持过滤条件）
  static async getStrategies(filters = {}) {
    const { status, userId, limit = 10000, offset = 0 } = filters;
    const cacheKey = `strategies_${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }
    
    // userId 过滤已移除，因为 strategies 表中没有 created_by 字段
    // if (userId) {
    //   whereConditions.push(`created_by = $${paramIndex}`);
    //   queryParams.push(userId);
    //   paramIndex++;
    // }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    // 优化查询 - 只选择必要字段，添加索引提示
    const query = `SELECT id, name, symbol, status, funding_type, funding_value, profit_margin_percent, stop_loss_percent, speed, max_total_volume_usdt, start_time, end_time, created_at, updated_at, avg_price FROM strategies ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    try {
      const result = await client.query(query, queryParams);
      const data = result.rows;
      cacheManager.set(cacheKey, data, 60000);
      return data;
    } catch (error) {
      Logger.logError('获取策略数据', error);
      throw error;
    }
  }
  
  // 获取交易数据（支持过滤条件）
  static async getTrades(filters = {}) {
    const { strategyId, userId, symbol, dateFrom, dateTo, limit = 1000, offset = 0 } = filters;
    const cacheKey = `trades_${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (strategyId) {
      whereConditions.push(`t.strategy_id = $${paramIndex}`);
      queryParams.push(strategyId);
      paramIndex++;
    }
    
    if (userId) {
      whereConditions.push(`t.user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }
    
    if (symbol) {
      whereConditions.push(`t.symbol = $${paramIndex}`);
      queryParams.push(symbol);
      paramIndex++;
    }
    
    if (dateFrom) {
      whereConditions.push(`t.created_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      whereConditions.push(`t.created_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const query = `
      SELECT t.*, s.name as strategy_name 
      FROM trades t 
      LEFT JOIN strategies s ON t.strategy_id = s.id 
      ${whereClause}
      ORDER BY t.created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    try {
      const result = await client.query(query, queryParams);
      const data = result.rows;
      cacheManager.set(cacheKey, data, 60000);
      return data;
    } catch (error) {
      Logger.logError('获取交易数据', error);
      throw error;
    }
  }
  
  // 获取用户策略跟踪数据（支持过滤条件）
  static async getUserStrategyTracking(filters = {}) {
    const { userId, strategyId, status, limit = 500, offset = 0 } = filters;
    const cacheKey = `user_strategy_tracking_${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    // 根据传入的status参数决定是否过滤状态
    if (status) {
      whereConditions.push(`ust.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }
    
    if (userId) {
      whereConditions.push(`ust.user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    }
    
    if (strategyId) {
      whereConditions.push(`ust.strategy_id = $${paramIndex}`);
      queryParams.push(strategyId);
      paramIndex++;
    }
    
    // 移除对策略状态和时间的强制过滤，让前端决定显示哪些数据
    // const now = new Date().toISOString();
    // whereConditions.push(`s.status = 'active'`);
    // whereConditions.push(`(s.start_time IS NULL OR s.start_time <= '${now}')`);
    // whereConditions.push(`(s.end_time IS NULL OR s.end_time >= '${now}')`);
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const query = `
      SELECT ust.*, u.username, s.name as strategy_name 
      FROM user_strategy_tracking ust 
      LEFT JOIN users u ON ust.user_id = u.id 
      LEFT JOIN strategies s ON ust.strategy_id = s.id 
      ${whereClause}
      ORDER BY ust.created_at DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    try {
      const result = await client.query(query, queryParams);
      const data = result.rows;
      cacheManager.set(cacheKey, data, 60000);
      return data;
    } catch (error) {
      Logger.logError('获取用户策略跟踪数据', error);
      throw error;
    }
  }
  
  // 兼容性方法：获取所有数据（已优化）
  static async getAllDataFromDB(filters = {}) {
    const cacheKey = `all_data_${JSON.stringify(filters)}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const startTime = Date.now();
    
    try {
      // 并行获取各类数据，使用优化的查询方法
      const [users, orders, userAssets, strategies, trades, userStrategyTracking] = await Promise.all([
        this.getUsers({ limit: 1000 }),
        this.getOrders({ limit: 500 }),
        this.getUserAssets({ limit: 500 }),
        this.getStrategies({ limit: 10000 }),
        this.getTrades({ limit: 1000 }),
        this.getUserStrategyTracking({ limit: 500 })
      ]);
      
      const data = {
        users,
        orders,
        userAssets,
        strategies,
        trades,
        userStrategyTracking,
        timestamp: new Date().toISOString()
      };
      
      cacheManager.set(cacheKey, data, 120000); // 2分钟缓存
      
      lastDataRefreshTime = Date.now();
      const duration = Date.now() - startTime;
      Logger.logInfo(`优化数据获取完成，耗时: ${duration}ms`);
      
      return data;
    } catch (error) {
      Logger.logError('获取数据', error);
      
      if (cached) {
        Logger.logInfo('使用过期缓存数据作为降级方案');
        return cached;
      }
      
      throw error;
    }
  }
  
  static clearCache() {
    // 清除所有相关缓存
    const keys = cacheManager.cache.keys();
    keys.forEach(key => {
      if (key.startsWith('users_') || key.startsWith('orders_') || 
          key.startsWith('user_assets_') || key.startsWith('strategies_') || 
          key.startsWith('trades_') || key.startsWith('user_strategy_tracking_') ||
          key.startsWith('all_data_')) {
        cacheManager.delete(key);
      }
    });
    lastDataRefreshTime = 0;
    Logger.logInfo('数据缓存已清除');
  }
}

// WebSocket连接处理
wss.on('connection', (ws) => {
  wsManager.addClient(ws);
  
  // 处理心跳响应
  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastPing = Date.now();
  });
  
  // 处理客户端消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        wsManager.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
      }
    } catch (error) {
      Logger.logError('处理WebSocket消息', error);
    }
  });
  
  ws.on('close', (code, reason) => {
    Logger.logInfo(`WebSocket连接关闭: ${code} - ${reason}`);
    wsManager.removeClient(ws);
  });
  
  ws.on('error', (error) => {
    // 忽略常见的连接重置错误，避免程序崩溃
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ENOTFOUND') {
      Logger.logInfo(`WebSocket连接错误 (${error.code}): 客户端断开连接`);
    } else {
      Logger.logError('WebSocket错误', error);
    }
    wsManager.removeClient(ws);
  });
});

// 广播更新函数（简化版，使用WebSocket管理器）
function broadcastUpdate(type, data) {
  wsManager.broadcast(type, data);
}

// 简化的数据库连接初始化
async function initDatabase() {
  try {
    // 创建数据库连接池
    pool = new Pool(dbConfig);
    
    // 测试连接池
    const testClient = await pool.connect();
    await testClient.query('SELECT NOW()');
    testClient.release();
    
    // 为向后兼容保留client引用
    client = {
      query: async (text, params) => {
        const poolClient = await pool.connect();
        try {
          const result = await poolClient.query(text, params);
          return result;
        } finally {
          poolClient.release();
        }
      }
    };
    
    Logger.logInfo('数据库连接初始化成功');
    
    // 优化数据库索引
    await optimizeDatabase();
    
    // 添加连接池错误处理
    pool.on('error', (err) => {
      // 处理常见的网络连接错误
      if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        Logger.logInfo(`数据库连接池错误 (${err.code}): ${err.message}`);
      } else {
        Logger.logError('数据库连接池', err);
      }
    });
    
    pool.on('connect', (client) => {
      Logger.logInfo('新的数据库连接已建立');
    });
    
    pool.on('remove', (client) => {
      Logger.logInfo('数据库连接已从池中移除');
    });
    
    // 为client对象添加慢查询检测
    const originalQuery = client.query;
    client.query = async (text, params) => {
      const start = Date.now();
      try {
        const res = await originalQuery(text, params);
        const duration = Date.now() - start;
        
        // 慢查询检测和统计
        if (duration > 1000) {
          Logger.logInfo(`慢查询检测 (${duration}ms): ${text.substring(0, 100)}...`);
        } else if (duration > 500) {
          Logger.logInfo(`查询耗时 (${duration}ms): ${text.substring(0, 50)}...`);
        }
        
        return res;
      } catch (error) {
        const duration = Date.now() - start;
        Logger.logError(`查询执行失败 (${duration}ms)`, error);
        Logger.logError('查询语句', new Error(text.substring(0, 200)));
        throw error;
      }
    };
    
    // 启动定时数据刷新
    startDataRefresh();
    
  } catch (error) {
    Logger.logError('数据库连接初始化', error);
    
    // 实现重连机制
    Logger.logInfo('10秒后尝试重新连接...');
    setTimeout(() => {
      initDatabase();
    }, 10000);
  }
}



// 优化的定时数据刷新
let dataRefreshTimer = null;

function startDataRefresh() {
  // 每120秒刷新一次数据（进一步降低频率，减少数据库负载）
  dataRefreshTimer = setInterval(async () => {
    try {
      // 使用统一数据获取函数，避免重复查询
      const data = await DataService.getAllDataFromDB();
      
      // 通过WebSocket广播更新
      broadcastUpdate('users_updated', data.users);
      broadcastUpdate('orders_updated', data.orders);
      broadcastUpdate('user_assets_updated', data.userAssets);
      broadcastUpdate('strategies_updated', data.strategies);
      broadcastUpdate('trades_updated', data.trades);
      broadcastUpdate('user_strategy_tracking_updated', data.userStrategyTracking);
      
      Logger.logInfo('数据刷新完成: ' + new Date().toISOString());
    } catch (error) {
      Logger.logError('定时数据刷新', error);
    }
  }, 120000); // 120秒（优化：进一步降低刷新频率）
}

// 停止数据刷新
function stopDataRefresh() {
  if (dataRefreshTimer) {
    clearInterval(dataRefreshTimer);
    dataRefreshTimer = null;
    Logger.logInfo('数据刷新定时器已停止');
  }
}



// 认证API路由
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 查询用户
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await client.query(query, [username]);
    
    if (result.rows.length === 0) {
      Logger.logInfo(`登录失败 - 用户不存在或未激活: ${username}`);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];
    
    // 验证密码
    if (!verifyPassword(password, user.password_hash)) {
      Logger.logInfo(`登录失败 - 密码错误: ${username}`);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    Logger.logInfo(`用户登录成功: ${username}`);
    
    // 返回用户信息（不包含密码哈希）
    const { password_hash, ...userInfo } = user;
    res.json({ 
      success: true, 
      user: userInfo,
      message: '登录成功'
    });
    
  } catch (error) {
    Logger.logError('用户登录', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 修改密码API
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: '用户ID、当前密码和新密码不能为空' });
    }

    // 查询用户
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await client.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = result.rows[0];
    
    // 验证当前密码
    if (!verifyPassword(currentPassword, user.password_hash)) {
      Logger.logInfo(`修改密码失败 - 当前密码错误: ${user.username}`);
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 对新密码进行哈希加密
    const hashedNewPassword = hashPassword(newPassword);
    
    // 更新密码
    const updateQuery = 'UPDATE users SET password_hash = $1 WHERE id = $2';
    await client.query(updateQuery, [hashedNewPassword, userId]);

    Logger.logInfo(`用户密码修改成功: ${user.username}`);
    
    res.json({ 
      success: true, 
      message: '密码修改成功'
    });
    
  } catch (error) {
    Logger.logError('修改密码', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 优化功能：批量获取所有数据的优化接口
// 批量获取所有数据的API（支持过滤条件）
app.get('/api/batch/all', async (req, res) => {
  try {
    const filters = req.query;
    const data = await DataService.getAllDataFromDB(filters);
    res.json(data);
  } catch (error) {
    Logger.logError('批量获取数据', error);
    res.status(500).json({ error: '批量获取数据失败' });
  }
});

// 获取用户数据API
app.get('/api/users-filtered', async (req, res) => {
  try {
    const filters = req.query;
    const data = await DataService.getUsers(filters);
    res.json(data);
  } catch (error) {
    Logger.logError('获取用户数据API', error);
    res.status(500).json({ error: '获取用户数据失败' });
  }
});

// 获取订单数据API
app.get('/api/orders-filtered', async (req, res) => {
  try {
    const filters = req.query;
    const data = await DataService.getOrders(filters);
    res.json(data);
  } catch (error) {
    Logger.logError('获取订单数据API', error);
    res.status(500).json({ error: '获取订单数据失败' });
  }
});

// 获取用户资产数据API
app.get('/api/user-assets-filtered', async (req, res) => {
  try {
    const filters = req.query;
    const data = await DataService.getUserAssets(filters);
    res.json(data);
  } catch (error) {
    Logger.logError('获取用户资产数据API', error);
    res.status(500).json({ error: '获取用户资产数据失败' });
  }
});

// 获取策略数据API
app.get('/api/strategies-filtered', async (req, res) => {
  try {
    const filters = req.query;
    const data = await DataService.getStrategies(filters);
    res.json(data);
  } catch (error) {
    Logger.logError('获取策略数据API', error);
    res.status(500).json({ error: '获取策略数据失败' });
  }
});

// 获取交易数据API
app.get('/api/trades-filtered', async (req, res) => {
  try {
    const filters = req.query;
    const data = await DataService.getTrades(filters);
    res.json(data);
  } catch (error) {
    Logger.logError('获取交易数据API', error);
    res.status(500).json({ error: '获取交易数据失败' });
  }
});

// 获取用户策略跟踪数据API
app.get('/api/user-strategy-tracking-filtered', async (req, res) => {
  try {
    const filters = req.query;
    const data = await DataService.getUserStrategyTracking(filters);
    res.json(data);
  } catch (error) {
    Logger.logError('获取用户策略跟踪数据API', error);
    res.status(500).json({ error: '获取用户策略跟踪数据失败' });
  }
});

// 优化功能：增量更新接口
app.get('/api/incremental', async (req, res) => {
  try {
    const { since } = req.query;
    const sinceTimestamp = parseInt(since) || 0;
    const currentTime = Date.now();
    
    // 修复增量更新逻辑：只有在首次请求(since=0)或数据有更新时才返回数据
    const shouldReturnAllData = sinceTimestamp === 0 || lastDataRefreshTime > sinceTimestamp;
    
    let updates = [];
    
    if (shouldReturnAllData) {
      // 使用统一数据获取函数，复用缓存
      const data = await DataService.getAllDataFromDB();
      
      updates = [
        { table: 'users', operation: 'update', data: data.users, timestamp: lastDataRefreshTime },
        { table: 'orders', operation: 'update', data: data.orders, timestamp: lastDataRefreshTime },
        { table: 'user_assets', operation: 'update', data: data.userAssets, timestamp: lastDataRefreshTime },
        { table: 'strategies', operation: 'update', data: data.strategies, timestamp: lastDataRefreshTime },
        { table: 'trades', operation: 'update', data: data.trades, timestamp: lastDataRefreshTime },
        { table: 'user_strategy_tracking', operation: 'update', data: data.userStrategyTracking, timestamp: lastDataRefreshTime }
      ];
      Logger.logInfo(`增量更新API完成，返回 ${updates.length} 个更新 (数据时间戳: ${lastDataRefreshTime}, 请求时间戳: ${sinceTimestamp})`);
  } else {
    Logger.logInfo(`增量更新API完成，无新数据 (数据时间戳: ${lastDataRefreshTime}, 请求时间戳: ${sinceTimestamp})`);
    }

    const response = {
      updates,
      lastUpdateTime: lastDataRefreshTime || currentTime
    };

    res.json(response);
  } catch (error) {
    Logger.logError('获取增量更新', error);
    res.status(500).json({ error: '获取增量更新失败' });
  }
});

// 优化功能：分页用户数据接口
app.get('/api/users/paginated', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      search,
      status
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const cacheKey = `users_paginated_${JSON.stringify(req.query)}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < 300000)) { // 增加缓存时间到5分钟
      return res.json(cached.data);
    }

    // 构建WHERE条件
    let whereConditions = ['status != \'inactive\''];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      // 支持UUID搜索：如果search是纯数字，则按UUID精确匹配，否则按用户名、昵称、邮箱模糊匹配
      if (/^\d+$/.test(search.trim())) {
        whereConditions.push(`uuid = $${paramIndex}`);
        queryParams.push(search.trim());
      } else {
        whereConditions.push(`(username ILIKE $${paramIndex} OR nickname ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
      }
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // 获取分页数据
    const dataQuery = `
      SELECT id, username, admin_id, nickname, email, mobile, uuid, status, created_at
      FROM users 
      ${whereClause} 
      ${orderClause} 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const dataResult = await client.query(dataQuery, [...queryParams, parseInt(limit), offset]);

    const result = {
      data: dataResult.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    };

    // 缓存5分钟 - 减少频繁查询
    cacheManager.set(cacheKey, { data: result, timestamp: Date.now() }, 300000);
    res.json(result);
  } catch (error) {
    Logger.logError('分页获取用户数据', error);
    res.status(500).json({ error: '分页获取用户数据失败' });
  }
});

// 获取用户数据
app.get('/api/users', async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC");
    res.json(result.rows);
    // 广播数据更新
    broadcastUpdate('users_updated', result.rows);
  } catch (error) {
    Logger.logError('获取用户数据', error);
    res.status(500).json({ error: '获取用户数据失败' });
  }
});

// 根据UUID批量查询用户
app.post('/api/users/by-uuids', async (req, res) => {
  try {
    const { uuids } = req.body;
    
    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
      return res.status(400).json({ error: 'UUID列表不能为空' });
    }
    
    // 过滤有效的UUID（纯数字）
    const validUuids = uuids.filter(uuid => /^\d+$/.test(String(uuid).trim()));
    
    if (validUuids.length === 0) {
      return res.json([]);
    }
    
    // 构建查询条件
    const placeholders = validUuids.map((_, index) => `$${index + 1}`).join(', ');
    const query = `SELECT id, username, admin_id, nickname, email, mobile, uuid, status, created_at FROM users WHERE uuid IN (${placeholders}) AND status = 'active' ORDER BY created_at DESC`;
    
    const result = await client.query(query, validUuids);
    res.json(result.rows);
    
    Logger.logInfo(`根据UUID批量查询用户: 查询${validUuids.length}个UUID，返回${result.rows.length}个用户`);
  } catch (error) {
    Logger.logError('根据UUID批量查询用户', error);
    res.status(500).json({ error: '根据UUID批量查询用户失败' });
  }
});


// 创建新用户
app.post('/api/users', async (req, res) => {
  try {
    const { username, password_hash, admin_id, mobile, email, nickname, uuid, status } = req.body;
    
    // 验证必填字段
    if (!username || !password_hash) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    // 检查用户名是否已存在
    const existingUser = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }
    
    // 对密码进行哈希加密
    const hashedPassword = hashPassword(password_hash);
    
    const result = await client.query(
      `INSERT INTO users (username, password_hash, admin_id, mobile, email, nickname, uuid, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [username, hashedPassword, admin_id || null, mobile || null, email || null, nickname || null, uuid || null, status || 'active']
    );
    
    const newUser = result.rows[0];
    res.status(201).json(newUser);
    
    // 记录数据变更
    Logger.logDataChange('users', 'INSERT', newUser.id);
    
    // 清除缓存并获取最新数据
    DataService.clearCache();
    const data = await DataService.getAllDataFromDB();
    broadcastUpdate('users_updated', data.users);
  } catch (error) {
    Logger.logError('创建用户', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

// 更新用户
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password_hash, admin_id, mobile, email, nickname, uuid, status } = req.body;
    
    // 验证用户是否存在
    const existingUser = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 如果更新用户名，检查是否与其他用户冲突
    if (username && username !== existingUser.rows[0].username) {
      const duplicateUser = await client.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
      if (duplicateUser.rows.length > 0) {
        return res.status(409).json({ error: '用户名已存在' });
      }
    }
    
    // 构建更新查询
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (username !== undefined) {
      updateFields.push(`username = $${paramIndex++}`);
      updateValues.push(username);
    }
    if (password_hash !== undefined) {
      updateFields.push(`password_hash = $${paramIndex++}`);
      // 对密码进行哈希加密
      updateValues.push(hashPassword(password_hash));
    }
    if (admin_id !== undefined) {
      updateFields.push(`admin_id = $${paramIndex++}`);
      updateValues.push(admin_id);
    }
    if (mobile !== undefined) {
      updateFields.push(`mobile = $${paramIndex++}`);
      updateValues.push(mobile);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      updateValues.push(email);
    }
    if (nickname !== undefined) {
      updateFields.push(`nickname = $${paramIndex++}`);
      updateValues.push(nickname);
    }
    if (uuid !== undefined) {
      updateFields.push(`uuid = $${paramIndex++}`);
      updateValues.push(uuid);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有提供要更新的字段' });
    }
    
    updateValues.push(id);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await client.query(query, updateValues);
    const updatedUser = result.rows[0];
    
    res.json(updatedUser);
    
    // 记录数据变更
    Logger.logDataChange('users', 'UPDATE', id);
    
    // 清除缓存并获取最新数据
    DataService.clearCache();
    const data = await DataService.getAllDataFromDB();
    broadcastUpdate('users_updated', data.users);
  } catch (error) {
    Logger.logError('更新用户', error);
    res.status(500).json({ error: '更新用户失败' });
  }
});

// 删除用户
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证用户是否存在
    const existingUser = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({ message: '用户删除成功' });
    
    // 记录数据变更
    Logger.logDataChange('users', 'DELETE', id);
    
    // 清除缓存并获取最新数据
    DataService.clearCache();
    const data = await DataService.getAllDataFromDB();
    broadcastUpdate('users_updated', data.users);
  } catch (error) {
    Logger.logError('删除用户', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// POST /api/strategies - 创建新策略
app.post('/api/strategies', async (req, res) => {
  try {
    const {
      name,
      symbol,
      funding_type,
      funding_value,
      profit_margin_percent,
      stop_loss_percent,
      max_total_volume_usdt,
      start_time,
      end_time,
      status = 'active',
      avg_price,
      speed
    } = req.body;

    // 验证必填字段
    if (!name || !symbol || !funding_value || !max_total_volume_usdt || !start_time || !end_time) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 验证时间格式
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: '时间格式无效' });
    }

    if (startDate >= endDate) {
      return res.status(400).json({ error: '开始时间必须早于结束时间' });
    }

    // 插入新策略
    const query = `
      INSERT INTO strategies (
        name, symbol, funding_type, funding_value, 
        profit_margin_percent, stop_loss_percent, 
        max_total_volume_usdt, start_time, end_time, status, avg_price, speed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      name,
      symbol,
      funding_type,
      parseFloat(funding_value),
      profit_margin_percent ? parseFloat(profit_margin_percent) : null,
      stop_loss_percent ? parseFloat(stop_loss_percent) : null,
      parseFloat(max_total_volume_usdt),
      start_time,
      end_time,
      status,
      avg_price ? parseFloat(avg_price) : null,
      speed ? parseInt(speed) : null
    ];

    const result = await client.query(query, values);
    const newStrategy = result.rows[0];

    res.status(201).json(newStrategy);

    // 记录数据变更
    Logger.logDataChange('strategies', 'INSERT', newStrategy.id);

    // 清除缓存并获取最新数据
    DataService.clearCache();
    const data = await DataService.getAllDataFromDB();
    broadcastUpdate('strategies_updated', data.strategies);
  } catch (error) {
    Logger.logError('创建策略', error);
    res.status(500).json({ error: '创建策略失败' });
  }
});

// POST /api/user-strategies - 创建用户策略绑定关系
app.post('/api/user-strategies', async (req, res) => {
  try {
    const { user_id, strategy_id } = req.body;

    // 验证必填字段
    if (!user_id || !strategy_id) {
      return res.status(400).json({ error: '缺少必填字段：user_id 和 strategy_id' });
    }

    // 验证用户是否存在
    const userExists = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证策略是否存在
    const strategyExists = await client.query('SELECT id FROM strategies WHERE id = $1', [strategy_id]);
    if (strategyExists.rows.length === 0) {
      return res.status(404).json({ error: '策略不存在' });
    }

    // 检查绑定关系是否已存在
    const existingBinding = await client.query(
      'SELECT * FROM user_strategies WHERE user_id = $1 AND strategy_id = $2',
      [user_id, strategy_id]
    );
    if (existingBinding.rows.length > 0) {
      return res.status(409).json({ error: '用户策略绑定关系已存在' });
    }

    // 创建绑定关系
    const result = await client.query(
      'INSERT INTO user_strategies (user_id, strategy_id, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [user_id, strategy_id]
    );

    res.status(201).json({
      message: '用户策略绑定关系创建成功',
      data: result.rows[0]
    });

    // 记录数据变更
    Logger.logDataChange('user_strategies', 'INSERT', result.rows[0].id);

    // 清除缓存
    DataService.clearCache();
  } catch (error) {
    Logger.logError('创建用户策略绑定关系', error);
    res.status(500).json({ error: '创建用户策略绑定关系失败' });
  }
});

// 策略状态更新接口
app.put('/api/strategies/update-status', async (req, res) => {
  try {
    const { id, status } = req.body;
    
    // 验证必填字段
    if (!id || !status) {
      return res.status(400).json({ error: '策略ID和状态为必填字段' });
    }
    
    // 验证状态值
    const validStatuses = ['active', 'inactive', 'paused', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    
    // 验证策略是否存在
    const existingStrategy = await client.query('SELECT * FROM strategies WHERE id = $1', [id]);
    if (existingStrategy.rows.length === 0) {
      return res.status(404).json({ error: '策略不存在' });
    }
    
    // 更新策略状态
    await client.query('UPDATE strategies SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
    
    res.json({ message: '策略状态更新成功', id, status });
    
    // 记录数据变更
    Logger.logDataChange('strategies', 'UPDATE', id);
    
    // 清除缓存并获取最新数据
    DataService.clearCache();
    const data = await DataService.getAllDataFromDB();
    broadcastUpdate('strategies_updated', data.strategies);
  } catch (error) {
    Logger.logError('更新策略状态', error);
    res.status(500).json({ error: '更新策略状态失败' });
  }
});

// 用户策略跟踪状态更新接口
app.put('/api/user-strategy-tracking/update-status', async (req, res) => {
  try {
    const { userId, strategyId, status } = req.body;
    
    // 验证必填字段
    if (!userId || !strategyId || !status) {
      return res.status(400).json({ error: '用户ID、策略ID和状态为必填字段' });
    }
    
    // 验证状态值
    const validStatuses = ['active', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    
    // 验证用户策略跟踪记录是否存在
    const existingTracking = await client.query(
      'SELECT * FROM user_strategy_tracking WHERE user_id = $1 AND strategy_id = $2', 
      [userId, strategyId]
    );
    if (existingTracking.rows.length === 0) {
      return res.status(404).json({ error: '用户策略跟踪记录不存在' });
    }
    
    // 更新用户策略跟踪状态
    await client.query(
      'UPDATE user_strategy_tracking SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND strategy_id = $3', 
      [status, userId, strategyId]
    );
    
    res.json({ message: '用户策略跟踪状态更新成功', userId, strategyId, status });
    
    // 记录数据变更
    Logger.logDataChange('user_strategy_tracking', 'UPDATE', `${userId}-${strategyId}`);
    
    // 清除缓存并获取最新数据
    DataService.clearCache();
    const data = await DataService.getAllDataFromDB();
    broadcastUpdate('user_strategy_tracking_updated', data.userStrategyTracking);
  } catch (error) {
    Logger.logError('更新用户策略跟踪状态', error);
    res.status(500).json({ error: '更新用户策略跟踪状态失败' });
  }
});

// 优化功能：优化的统计数据接口
app.get('/api/stats/optimized', async (req, res) => {
  try {
    const cacheKey = 'optimized_stats';
    const cached = cacheManager.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < 60000)) {
      return res.json(cached.data);
    }

    // 优化统计查询 - 使用更高效的单个查询替代多个子查询
    const statsQuery = `
      WITH stats AS (
        SELECT 
          'users' as table_name,
          COUNT(*) FILTER (WHERE status = 'active') as active_count,
          COUNT(*) as total_count
        FROM users
        UNION ALL
        SELECT 'orders', COUNT(*), COUNT(*) FROM orders
        UNION ALL  
        SELECT 'user_assets', COUNT(*), COUNT(*) FROM user_assets
        UNION ALL
        SELECT 
          'strategies',
          COUNT(*) FILTER (WHERE status = 'active'),
          COUNT(*)
        FROM strategies
      )
      SELECT 
        MAX(CASE WHEN table_name = 'users' THEN active_count END) as total_users,
        MAX(CASE WHEN table_name = 'orders' THEN total_count END) as total_orders,
        MAX(CASE WHEN table_name = 'user_assets' THEN total_count END) as total_assets,
        MAX(CASE WHEN table_name = 'strategies' THEN total_count END) as total_strategies,
        MAX(CASE WHEN table_name = 'strategies' THEN active_count END) as active_strategies
      FROM stats
    `;

    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];

    const result = {
      totalUsers: parseInt(stats.total_users),
      totalOrders: parseInt(stats.total_orders),
      totalAssets: parseInt(stats.total_assets),
      totalStrategies: parseInt(stats.total_strategies),
      activeStrategies: parseInt(stats.active_strategies),
      recentActivity: []
    };

    // 缓存1分钟
    cacheManager.set(cacheKey, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch (error) {
    Logger.logError('获取优化统计数据', error);
    res.status(500).json({ error: '获取优化统计数据失败' });
  }
});

// 获取用户USDT余额接口
app.get('/api/users/:userId/usdt-balance', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 验证用户ID
    if (!userId) {
      return res.status(400).json({ error: '用户ID不能为空' });
    }
    
    // 首先获取用户的UUID
    const userQuery = 'SELECT uuid FROM users WHERE id = $1';
    const userResult = await client.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const userUuid = userResult.rows[0].uuid;
    
    if (!userUuid) {
      return res.status(404).json({ error: '用户UUID不存在', balance: '0.00' });
    }
    
    // 查询用户的USDT余额
    const balanceQuery = `
      SELECT valuation 
      FROM user_assets 
      WHERE uuid = $1 AND asset = 'USDT' AND wallet_type = 'FUNDING'
      ORDER BY last_updated_at DESC 
      LIMIT 1
    `;
    
    const balanceResult = await client.query(balanceQuery, [userUuid]);
    
    let balance = '0.00';
    if (balanceResult.rows.length > 0) {
      balance = parseFloat(balanceResult.rows[0].valuation || '0').toFixed(2);
    }
    
    res.json({ 
      userId: parseInt(userId),
      uuid: userUuid,
      usdtBalance: balance,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    Logger.logError('获取用户USDT余额', error);
    res.status(500).json({ error: '获取用户USDT余额失败' });
  }
});

// 批量获取多个用户的USDT余额
app.post('/api/users/usdt-balances', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: '用户ID列表不能为空' });
    }
    
    // 限制批量查询的数量
    if (userIds.length > 100) {
      return res.status(400).json({ error: '批量查询用户数量不能超过100个' });
    }
    
    // 构建查询参数
    const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
    
    // 查询用户的UUID和USDT余额
    const query = `
      SELECT 
        u.id as user_id,
        u.uuid,
        COALESCE(ua.valuation, '0') as usdt_balance
      FROM users u
      LEFT JOIN user_assets ua ON u.uuid = ua.uuid 
        AND ua.asset = 'USDT' 
        AND ua.wallet_type = 'FUNDING'
      WHERE u.id IN (${placeholders})
      ORDER BY u.id
    `;
    
    const result = await client.query(query, userIds);
    
    // 验证查询结果
    if (!result || !Array.isArray(result.rows)) {
      return res.status(500).json({ error: '查询用户余额失败' });
    }
    
    const balances = result.rows.map(row => ({
      userId: parseInt(row.user_id),
      uuid: row.uuid,
      usdtBalance: parseFloat(row.usdt_balance || '0').toFixed(2)
    }));
    
    res.json({
      balances,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    Logger.logError('批量获取用户USDT余额', error);
    res.status(500).json({ error: '批量获取用户USDT余额失败' });
  }
});

// 获取所有不重复的交易对信息
app.get('/api/trading-pairs', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.symbol,
        COUNT(DISTINCT s.id) as strategy_count,
        COUNT(DISTINCT ust.user_id) as user_count,
        SUM(ust.achieved_trade_volume) as total_volume,
        MAX(ust.updated_at) as latest_trade_time
      FROM strategies s
      LEFT JOIN user_strategy_tracking ust ON s.id = ust.strategy_id
      WHERE s.symbol IS NOT NULL AND s.symbol != '' AND ust.achieved_trade_volume > 0
      GROUP BY s.symbol
      ORDER BY latest_trade_time DESC NULLS LAST, strategy_count DESC
      LIMIT 8
    `;
    
    const result = await client.query(query);
    
    // 验证查询结果
    if (!result || !Array.isArray(result.rows)) {
      return res.status(500).json({ error: '查询交易对失败' });
    }
    
    const tradingPairs = result.rows.map(row => ({
      symbol: row.symbol,
      strategyCount: parseInt(row.strategy_count || 0),
      userCount: parseInt(row.user_count || 0),
      totalVolume: parseFloat(row.total_volume || 0).toFixed(8)
    }));
    
    res.json({
      tradingPairs,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    Logger.logError('获取交易对信息', error);
    res.status(500).json({ error: '获取交易对信息失败' });
  }
});

// 获取指定交易对的用户刷量统计数据
app.get('/api/trading-pairs/:symbol/users', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: '交易对符号不能为空' });
    }
    
    // 验证分页参数
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // 限制最大100条
    const offset = (pageNum - 1) * limitNum;
    
    // 构建查询条件
    let whereClause = 'WHERE s.symbol = $1';
    let queryParams = [symbol];
    let paramIndex = 2;
    
    // 添加昵称模糊查询
    if (search && search.trim()) {
      whereClause += ` AND u.nickname ILIKE $${paramIndex}`;
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }
    
    // 获取总数的查询
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total_count
      FROM strategies s
      JOIN user_strategy_tracking ust ON s.id = ust.strategy_id
      JOIN users u ON ust.user_id = u.id AND u.status = 'active'
      ${whereClause}
    `;
    
    // 获取分页数据的查询
    const dataQuery = `
      SELECT 
        u.id as user_id,
        u.nickname,
        u.uuid,
        SUM(ust.achieved_trade_volume) as total_achieved_trade_volume,
        SUM(CASE WHEN DATE(ust.updated_at) = CURRENT_DATE THEN ust.achieved_trade_volume ELSE 0 END) as today_achieved_trade_volume,
        COUNT(*) as strategy_count
      FROM strategies s
      JOIN user_strategy_tracking ust ON s.id = ust.strategy_id
      JOIN users u ON ust.user_id = u.id AND u.status = 'active'
      ${whereClause}
      GROUP BY u.id, u.nickname, u.username, u.uuid
      ORDER BY total_achieved_trade_volume DESC, nickname ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    // 执行查询
    const [countResult, dataResult] = await Promise.all([
      client.query(countQuery, queryParams),
      client.query(dataQuery, [...queryParams, limitNum, offset])
    ]);
    
    // 验证查询结果
    if (!countResult || !Array.isArray(countResult.rows) || countResult.rows.length === 0) {
      return res.status(500).json({ error: '查询用户统计总数失败' });
    }
    if (!dataResult || !Array.isArray(dataResult.rows)) {
      return res.status(500).json({ error: '查询用户统计数据失败' });
    }
    
    const totalCount = parseInt(countResult.rows[0].total_count);
    const totalPages = Math.ceil(totalCount / limitNum);
    
    const userStats = dataResult.rows.map(row => ({
      id: parseInt(row.user_id),
      userId: parseInt(row.user_id),
      nickname: row.nickname,
      uuid: row.uuid,
      totalAchievedTradeVolume: parseFloat(row.total_achieved_trade_volume || 0).toFixed(8),
      todayAchievedTradeVolume: parseFloat(row.today_achieved_trade_volume || 0).toFixed(8),
      strategyCount: parseInt(row.strategy_count)
    }));
    
    // 计算当前页的统计数据
    const currentPageStats = {
      totalUsers: userStats.length,
      totalVolume: userStats.reduce((sum, user) => sum + parseFloat(user.totalAchievedTradeVolume), 0).toFixed(8),
      totalStrategies: userStats.reduce((sum, user) => sum + user.strategyCount, 0)
    };
    
    // 获取全部数据的统计（用于显示总计）
    const totalStatsQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COALESCE(SUM(ust.achieved_trade_volume), 0) as total_volume,
        COUNT(*) as total_strategies
      FROM strategies s
      JOIN user_strategy_tracking ust ON s.id = ust.strategy_id
      JOIN users u ON ust.user_id = u.id AND u.status = 'active'
      ${whereClause}
    `;
    
    const totalStatsResult = await client.query(totalStatsQuery, queryParams);
    const totalStatsRow = totalStatsResult.rows[0];
    
    const totalStats = {
      totalUsers: parseInt(totalStatsRow.total_users),
      totalVolume: parseFloat(totalStatsRow.total_volume || 0).toFixed(8),
      totalStrategies: parseInt(totalStatsRow.total_strategies)
    };
    
    res.json({
      symbol,
      userStats,
      totalStats,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      search: search || '',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    Logger.logError('获取交易对用户统计', error);
    res.status(500).json({ error: '获取交易对用户统计失败' });
  }
});

// 获取交易记录（支持分页和筛选）
app.get('/api/trades', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, userUuid, strategyId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    // 构建查询条件
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (userUuid && userUuid.trim()) {
      // 如果userUuid是纯数字，则按user_id精确匹配
      if (/^\d+$/.test(userUuid.trim())) {
        whereConditions.push(`user_id = $${paramIndex}`);
        queryParams.push(parseInt(userUuid.trim()));
      } else {
        // 否则转换user_id为字符串进行模糊匹配
        whereConditions.push(`user_id::text ILIKE $${paramIndex}`);
        queryParams.push(`%${userUuid.trim()}%`);
      }
      paramIndex++;
    }

    if (strategyId && strategyId.trim()) {
      whereConditions.push(`strategy_id = $${paramIndex}`);
      queryParams.push(parseInt(strategyId.trim()));
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 查询总数
    const countQuery = `SELECT COUNT(*) as total FROM trades ${whereClause}`;
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // 查询数据
    const dataQuery = `
      SELECT 
        id, user_id, strategy_id, symbol, status, 
        buy_price, buy_quantity, buy_quote_quantity,
        sell_price, sell_quantity, sell_target_price,
        pnl, buy_timestamp, sell_timestamp, created_at, updated_at
      FROM trades 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
     
    const dataParams = [...queryParams, limit, offset];
    const dataResult = await client.query(dataQuery, dataParams);

    res.json({
      data: dataResult.rows,
      total,
      page: parseInt(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    });

    Logger.logInfo(`获取交易记录: 页码${page}, 每页${pageSize}条, 总计${total}条`);
  } catch (error) {
    Logger.logError('获取交易记录', error);
    res.status(500).json({ error: '获取交易记录失败' });
  }
});

// 用户登录状态相关接口
// 获取用户登录状态
app.get('/api/user-login-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM user_login_status WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      // 如果没有记录，创建一个新的
      const insertResult = await pool.query(
        `INSERT INTO user_login_status (user_id, status, qr_code_status) 
         VALUES ($1, 'idle', 'not_generated') 
         RETURNING *`,
        [userId]
      );
      return res.json(insertResult.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    Logger.logError('获取用户登录状态', error);
    res.status(500).json({ error: '获取用户登录状态失败' });
  }
});

// 获取二维码（不修改状态）
app.post('/api/user-login-status/:userId/start', async (req, res) => {
  try {
    const { userId } = req.params;
    const { qr_code_status } = req.body;
    
    // 检查是否已有记录
    let result = await client.query(
      'SELECT * FROM user_login_status WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      // 如果没有记录，创建一个新的
      const insertResult = await client.query(
        `INSERT INTO user_login_status (user_id, status, qr_code_status) 
         VALUES ($1, 'offline', $2) 
         RETURNING *`,
        [userId, qr_code_status || 'Waitting']
      );
      return res.json(insertResult.rows[0]);
    }
    
    // 更新现有记录的qr_code_status
    const updateResult = await client.query(
      `UPDATE user_login_status 
       SET qr_code_status = $2 
       WHERE user_id = $1 
       RETURNING *`,
      [userId, qr_code_status || 'Waitting']
    );
    
    res.json(updateResult.rows[0]);
  } catch (error) {
    Logger.logError('获取二维码', error);
    res.status(500).json({ error: '获取二维码失败' });
  }
});

// 确认登录（修改状态）
app.post('/api/user-login-status/:userId/confirm', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 更新user_login_status表状态
    const updateResult = await client.query(
      `UPDATE user_login_status 
       SET status = 'online', 
           qr_code_status = 'scanned',
           last_login_time = NOW()
       WHERE user_id = $1 
       RETURNING *`,
      [userId]
    );
    
    res.json(updateResult.rows[0]);
  } catch (error) {
    Logger.logError('确认登录', error);
    res.status(500).json({ error: '确认登录失败' });
  }
});

// 更新二维码图片
app.post('/api/user-login-status/:userId/qrcode', async (req, res) => {
  try {
    const { userId } = req.params;
    const { qrCodeImage } = req.body;
    
    const result = await pool.query(
      `UPDATE user_login_status 
       SET qr_code_image = $2, 
           qr_code_status = 'generated'
       WHERE user_id = $1 
       RETURNING *`,
      [userId, qrCodeImage]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    Logger.logError('更新二维码图片', error);
    res.status(500).json({ error: '更新二维码图片失败' });
  }
});

// 检查登录状态
app.get('/api/user-login-status/:userId/check', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      'SELECT status, qr_code_status, qr_code_expires_at FROM user_login_status WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户登录状态不存在' });
    }
    
    const loginStatus = result.rows[0];
    
    // 检查二维码是否过期
    if (loginStatus.qr_code_expires_at && new Date() > new Date(loginStatus.qr_code_expires_at)) {
      // 二维码已过期，更新状态
      await pool.query(
        `UPDATE user_login_status 
         SET qr_code_status = 'expired'
         WHERE user_id = $1`,
        [userId]
      );
      loginStatus.qr_code_status = 'expired';
    }
    
    res.json(loginStatus);
  } catch (error) {
    Logger.logError('检查登录状态', error);
    res.status(500).json({ error: '检查登录状态失败' });
  }
});



// 检测数据不一致问题：检查活跃策略的用户是否在user_strategy_tracking表中有对应数据
app.get('/api/data-inconsistency-check', async (req, res) => {
  try {
    Logger.logInfo('开始检测数据不一致问题...');
    
    // 正确的检查逻辑：
    // 1. 从strategies表获取活跃策略ID
    // 2. 通过策略ID关联user_strategies表获取用户ID
    // 3. 结合策略ID和用户ID检查user_strategy_tracking表中是否存在对应数据
    // 4. 如果不存在则输出用户信息
    const inconsistencyQuery = `
      SELECT 
        us.user_id,
        us.strategy_id,
        us.is_active as user_strategy_active,
        us.created_at as user_strategy_created_at,
        u.id as user_id,
        u.username,
        u.nickname,
        u.uuid,
        u.mobile,
        u.email,
        u.status as user_status,
        s.id as strategy_id,
        s.name as strategy_name,
        s.symbol as strategy_symbol,
        s.status as strategy_status,
        s.start_time,
        s.end_time
      FROM strategies s
      INNER JOIN user_strategies us ON s.id = us.strategy_id
      INNER JOIN users u ON us.user_id = u.id AND u.status = 'active'
      LEFT JOIN user_strategy_tracking ust ON us.user_id = ust.user_id AND us.strategy_id = ust.strategy_id
      WHERE s.status = 'active'
        AND us.is_active = true
        AND ust.user_id IS NULL
        AND ust.strategy_id IS NULL
      ORDER BY s.id, u.id
    `;
    
    const result = await client.query(inconsistencyQuery);
    const inconsistentData = result && result.rows ? result.rows : [];
    
    Logger.logInfo(`发现 ${inconsistentData.length} 条数据不一致记录`);
    
    // 按用户分组统计
    const userStats = {};
    if (Array.isArray(inconsistentData)) {
      inconsistentData.forEach(row => {
      const userId = row.user_id;
      if (!userStats[userId]) {
        userStats[userId] = {
          user: {
            id: row.user_id,
            username: row.username,
            nickname: row.nickname,
            uuid: row.uuid,
            mobile: row.mobile,
            email: row.email,
            status: row.user_status
          },
          missingStrategies: []
        };
      }
      userStats[userId].missingStrategies.push({
        strategyId: row.strategy_id,
        strategyName: row.strategy_name,
        strategySymbol: row.strategy_symbol,
        strategyStatus: row.strategy_status,
        startTime: row.start_time,
        endTime: row.end_time
      });
    });
    }
    
    const userList = Object.values(userStats);
    
    res.json({
      success: true,
      count: inconsistentData.length,
      userCount: userList.length,
      data: inconsistentData,
      userStats: userList,
      message: inconsistentData.length > 0 
        ? `发现 ${inconsistentData.length} 条数据不一致：${userList.length} 个用户在活跃策略中缺少user_strategy_tracking表记录`
        : '数据一致性检查通过，未发现问题'
    });
    
  } catch (error) {
    Logger.logError('数据不一致检测', error);
    res.status(500).json({ 
      success: false,
      error: '数据不一致检测失败',
      message: error.message 
    });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  Logger.logError('服务器错误', error);
  
  // 检查响应是否已经发送，避免重复发送
  if (!res.headersSent) {
    res.status(500).json({ error: '内部服务器错误' });
  }
});

// 启动服务器
async function startServer() {
  await initDatabase();
 // 启动服务器
server.listen(port, () => {
  Logger.logInfo(`API服务器运行在 http://localhost:${port}`);
  Logger.logInfo(`WebSocket服务器运行在 ws://localhost:${port}`);
});
}

// 优雅关闭函数
async function gracefulShutdown(signal) {
  Logger.logInfo(`收到 ${signal} 信号，正在优雅关闭服务器...`);
  
  try {
    // 1. 停止接受新的连接
    server.close(() => {
      Logger.logInfo('HTTP服务器已停止接受新连接');
    });
    
    // 2. 关闭所有WebSocket连接
    wsManager.closeAll();
    
    // 停止定时器
    cacheManager.stopCleanupTimer();
    wsManager.stopHeartbeat();
    stopDataRefresh();
    
    // 清理缓存
    cacheManager.clear();
    
    // 5. 关闭数据库连接池
    if (pool) {
      await pool.end();
      Logger.logInfo('数据库连接池已关闭');
    }
    
    Logger.logInfo('服务器已优雅关闭');
    process.exit(0);
    
  } catch (error) {
    Logger.logError('优雅关闭过程', error);
    process.exit(1);
  }
}

// 监听进程信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  // 对于网络连接重置错误，记录但不关闭服务器
  if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ENOTFOUND') {
    Logger.logInfo(`网络连接错误 (${error.code}): ${error.message}`);
    return;
  }
  Logger.logError('未捕获的异常', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  // 检查是否是网络相关的错误
  const error = reason instanceof Error ? reason : new Error(reason);
  if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ENOTFOUND') {
    Logger.logInfo(`Promise拒绝 - 网络错误 (${error.code}): ${error.message}`);
    return;
  }
  Logger.logError('未处理的Promise拒绝', error);
  gracefulShutdown('unhandledRejection');
});

startServer().catch(error => Logger.logError('服务器启动', error));