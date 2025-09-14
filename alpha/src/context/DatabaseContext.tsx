import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { DatabaseEvent, User, Order, UserAsset, AlphaAsset } from '../types/database';
import { databaseService } from '../services/database';

interface DatabaseContextType {
  // 连接状态
  isConnected: boolean;
  isLoading: boolean;
  
  // 数据状态
  users: User[];
  orders: Order[];
  userAssets: UserAsset[];
  alphaAssets: AlphaAsset[];
  strategies: any[];
  trades: any[];
  userStrategyTracking: any[];
  
  // 分页数据
  paginatedUsers: {
    data: User[];
    total: number;
    page: number;
    totalPages: number;
  } | null;
  
  // 统计数据
  stats: {
    totalUsers: number;
    totalOrders: number;
    totalAssets: number;
    totalStrategies: number;
    activeStrategies: number;
    recentActivity: any[];
  } | null;
  
  // 实时事件
  recentEvents: DatabaseEvent[];
  
  // 增量同步状态
  incrementalSyncEnabled: boolean;
  
  // 操作方法
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshData: () => Promise<void>;
  refreshStats: () => Promise<void>;
  loadUsersPaginated: (page: number, limit: number, filters?: any) => Promise<void>;
  getUserAlphaAssets: (userUuid: string) => Promise<AlphaAsset[]>;
  clearCache: (pattern?: string) => void;
  enableIncrementalSync: () => void;
  disableIncrementalSync: () => void;
  toggleIncrementalSync: () => void;
  getCacheStats: () => { size: number; keys: string[] };
  
  // 新增的过滤数据获取方法
  getFilteredUserStrategyTracking: (filters?: {
    userId?: number;
    strategyId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }) => Promise<any[]>;
  getFilteredStrategies: (filters?: {
    status?: string;
    userId?: number;
    limit?: number;
    offset?: number;
  }) => Promise<any[]>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

interface DatabaseProviderProps {
  children: ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [alphaAssets, setAlphaAssets] = useState<AlphaAsset[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [userStrategyTracking, setUserStrategyTracking] = useState<any[]>([]);
  const [paginatedUsers, setPaginatedUsers] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<DatabaseEvent[]>([]);
  const [incrementalSyncEnabled, setIncrementalSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState<NodeJS.Timeout | null>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);

  // 处理增量更新
  const handleIncrementalUpdate = useCallback((updates: any[]) => {
    updates.forEach(update => {
      const { type, action, data, timestamp } = update;
      
      // 检查必要字段是否存在
      if (!type || !action) {
        console.warn('增量更新数据格式错误:', update);
        return;
      }
      
      // 创建事件记录
      const dbEvent: DatabaseEvent = {
        table: type,
        action: action.toUpperCase(),
        data,
        timestamp
      };
      
      // 添加到最近事件列表
      setRecentEvents(prev => [dbEvent, ...prev].slice(0, 50));
      
      // 根据更新类型处理数据
      switch (type) {
        case 'users':
          if (action === 'insert') {
            setUsers(prev => [data, ...prev]);
          } else if (action === 'update') {
            setUsers(prev => prev.map(item => item.id === data.id ? data : item));
          } else if (action === 'delete') {
            setUsers(prev => prev.filter(item => item.id !== data.id));
          }
          break;
        case 'orders':
          if (action === 'insert') {
            setOrders(prev => [data, ...prev]);
          } else if (action === 'update') {
            setOrders(prev => prev.map(item => item.id === data.id ? data : item));
          } else if (action === 'delete') {
            setOrders(prev => prev.filter(item => item.id !== data.id));
          }
          break;
        case 'user_assets':
          if (action === 'insert') {
            setUserAssets(prev => [data, ...prev]);
          } else if (action === 'update') {
            setUserAssets(prev => prev.map(item => item.id === data.id ? data : item));
          } else if (action === 'delete') {
            setUserAssets(prev => prev.filter(item => item.id !== data.id));
          }
          break;
        case 'strategies':
          if (action === 'insert') {
            setStrategies(prev => [data, ...prev]);
          } else if (action === 'update') {
            setStrategies(prev => prev.map(item => item.id === data.id ? data : item));
          } else if (action === 'delete') {
            setStrategies(prev => prev.filter(item => item.id !== data.id));
          }
          break;
        case 'trades':
          if (action === 'insert') {
            setTrades(prev => [data, ...prev]);
          } else if (action === 'update') {
            setTrades(prev => prev.map(item => item.id === data.id ? data : item));
          } else if (action === 'delete') {
            setTrades(prev => prev.filter(item => item.id !== data.id));
          }
          break;
        case 'user_strategy_tracking':
          if (action === 'insert') {
            setUserStrategyTracking(prev => [data, ...prev]);
          } else if (action === 'update') {
            setUserStrategyTracking(prev => prev.map(item => item.id === data.id ? data : item));
          } else if (action === 'delete') {
            setUserStrategyTracking(prev => prev.filter(item => item.id !== data.id));
          }
          break;
      }
    });
  }, []);

  // 增量同步
  const performIncrementalSync = useCallback(async () => {
    try {
      const updates = await databaseService.getIncrementalUpdates();
      if (updates.length > 0) {
        handleIncrementalUpdate(updates);
        console.log(`处理了 ${updates.length} 个增量更新`);
      }
    } catch (error) {
      console.error('增量同步失败:', error);
    }
  }, [handleIncrementalUpdate]);

  // WebSocket连接管理
  const connectWebSocket = useCallback(() => {
    // 关闭现有连接
    setWebsocket(prev => {
      if (prev) {
        prev.close();
      }
      return null;
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      setWebsocket(ws);
    };
    
    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('收到WebSocket消息:', message);
        
        // 处理实时数据更新
        if (message.type && message.data) {
          const dbEvent: DatabaseEvent = {
            table: message.type,
            action: 'UPDATE',
            data: message.data,
            timestamp: message.timestamp || new Date().toISOString()
          };
          
          setRecentEvents(prev => [dbEvent, ...prev].slice(0, 50));
          
          // 刷新数据 - 直接调用服务
          try {
            const data = await databaseService.getAllData();
            setUsers(data.users);
            setOrders(data.orders);
            setUserAssets(data.userAssets);
            setStrategies(data.strategies);
            setTrades(data.trades);
            setUserStrategyTracking(data.userStrategyTracking);
            
            const statsData = await databaseService.getOptimizedStats();
            setStats(statsData);
            
            console.log('WebSocket触发数据刷新完成');
          } catch (error) {
            console.error('WebSocket数据刷新失败:', error);
          }
        }
      } catch (error) {
        console.error('处理WebSocket消息失败:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      setWebsocket(null);
      // 5秒后尝试重连
      setTimeout(() => {
        connectWebSocket();
      }, 5000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket连接错误:', error);
    };
  }, []);

  // 连接数据库
  const connect = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsConnected(true);
      
      // 预加载数据
      await databaseService.preloadData();
      
      // 加载初始数据
      await refreshData();
      await refreshStats();
      
      // 建立WebSocket连接
      connectWebSocket();
      
      console.log('优化数据库连接成功');
    } catch (error) {
      console.error('连接失败:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [connectWebSocket]);

  // 断开连接
  const disconnect = useCallback(() => {
    setIsConnected(false);
    disableIncrementalSync();
    
    // 关闭WebSocket连接
    setWebsocket(prev => {
      if (prev) {
        prev.close();
      }
      return null;
    });
    
    // 清空数据
    setUsers([]);
    setOrders([]);
    setUserAssets([]);
    setAlphaAssets([]);
    setStrategies([]);
    setTrades([]);
    setUserStrategyTracking([]);
    setPaginatedUsers(null);
    setStats(null);
    setRecentEvents([]);
    
    // 清除缓存
    databaseService.clearCache();
  }, []);

  // 刷新数据（批量获取）
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      // 清除缓存以确保获取数据库中的最新数据
      databaseService.clearCache();
      const data = await databaseService.getAllData();
      
      setUsers(data.users);
      setOrders(data.orders);
      setUserAssets(data.userAssets);
      setStrategies(data.strategies);
      setTrades(data.trades);
      setUserStrategyTracking(data.userStrategyTracking);
      
      console.log('批量数据刷新完成:', data.timestamp);
    } catch (error) {
      console.error('刷新数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 刷新统计数据
  const refreshStats = useCallback(async () => {
    try {
      const statsData = await databaseService.getOptimizedStats();
      setStats(statsData);
    } catch (error) {
      console.error('刷新统计数据失败:', error);
    }
  }, []);

  // 分页加载用户数据
  const loadUsersPaginated = useCallback(async (page: number, limit: number, filters?: any) => {
    try {
      setIsLoading(true);
      const paginationParams = { page, limit };
      const data = await databaseService.getUsersPaginated(paginationParams, filters);
      setPaginatedUsers(data);
    } catch (error) {
      console.error('分页加载用户数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 获取用户Alpha资产
  const getUserAlphaAssets = useCallback(async (userUuid: string): Promise<AlphaAsset[]> => {
    try {
      const assets = await databaseService.getUserAlphaAssets(userUuid);
      return assets;
    } catch (error) {
      console.error('获取用户Alpha资产失败:', error);
      return [];
    }
  }, []);

  // 获取过滤后的用户策略跟踪数据
  const getFilteredUserStrategyTracking = useCallback(async (filters?: {
    userId?: number;
    strategyId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> => {
    try {
      const data = await databaseService.getUserStrategyTracking(filters);
      return data;
    } catch (error) {
      console.error('获取过滤后的用户策略跟踪数据失败:', error);
      return [];
    }
  }, []);

  // 获取过滤后的策略数据
  const getFilteredStrategies = useCallback(async (filters?: {
    status?: string;
    userId?: number;
    limit?: number;
    offset?: number;
  }): Promise<any[]> => {
    try {
      const data = await databaseService.getStrategies(filters);
      return data;
    } catch (error) {
      console.error('获取用户Alpha资产失败:', error);
      return [];
    }
  }, []);

  // 清除缓存
  const clearCache = useCallback((pattern?: string) => {
    databaseService.clearCache(pattern);
  }, []);

  // 启用增量同步
  const enableIncrementalSync = useCallback(() => {
    if (!incrementalSyncEnabled) {
      setIncrementalSyncEnabled(true);
      const interval = setInterval(performIncrementalSync, 30000); // 每30秒同步一次（作为WebSocket的备用机制）
      setSyncInterval(interval);
      console.log('增量同步已启用（备用机制）');
    }
  }, [incrementalSyncEnabled, performIncrementalSync]);

  // 禁用增量同步
  const disableIncrementalSync = useCallback(() => {
    if (incrementalSyncEnabled && syncInterval) {
      setIncrementalSyncEnabled(false);
      clearInterval(syncInterval);
      setSyncInterval(null);
      console.log('增量同步已禁用');
    }
  }, [incrementalSyncEnabled, syncInterval]);

  // 切换增量同步
  const toggleIncrementalSync = useCallback(() => {
    if (incrementalSyncEnabled) {
      disableIncrementalSync();
    } else {
      enableIncrementalSync();
    }
  }, [incrementalSyncEnabled, enableIncrementalSync, disableIncrementalSync]);

  // 获取缓存统计
  const getCacheStats = useCallback(() => {
    // 这里返回模拟的缓存统计数据
    return {
      size: users.length + orders.length + userAssets.length,
      keys: ['users', 'orders', 'userAssets', 'strategies', 'trades', 'userStrategyTracking']
    };
  }, [users.length, orders.length, userAssets.length]);

  // 组件挂载时自动连接
  useEffect(() => {
    const autoConnect = async () => {
      try {
        await connect();
        // 启用增量同步
        enableIncrementalSync();
      } catch (error) {
        console.error('自动连接优化数据库失败:', error);
      }
    };
    
    autoConnect();
  }, [connect, enableIncrementalSync]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isConnected, disconnect]);

  const value: DatabaseContextType = {
    isConnected,
    isLoading,
    users,
    orders,
    userAssets,
    alphaAssets,
    strategies,
    trades,
    userStrategyTracking,
    paginatedUsers,
    stats,
    recentEvents,
    incrementalSyncEnabled,
    connect,
    disconnect,
    refreshData,
    refreshStats,
    loadUsersPaginated,
    getUserAlphaAssets,
    clearCache,
    enableIncrementalSync,
    disableIncrementalSync,
    toggleIncrementalSync,
    getCacheStats,
    getFilteredUserStrategyTracking,
    getFilteredStrategies
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

// 自定义Hook
export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

export default DatabaseContext;