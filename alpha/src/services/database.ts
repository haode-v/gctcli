import { User, Order, UserAsset, AlphaAsset } from '../types/database';

// 批量数据获取接口
interface BatchDataResponse {
  users: User[];
  orders: Order[];
  userAssets: UserAsset[];
  alphaAssets: AlphaAsset[];
  strategies: any[];
  trades: any[];
  userStrategyTracking: any[];
  timestamp: string;
}

// 增量更新数据
interface IncrementalUpdate {
  type: 'users' | 'orders' | 'userAssets' | 'alphaAssets' | 'strategies' | 'trades' | 'userStrategyTracking';
  action: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

// 分页参数
interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 过滤参数
interface FilterParams {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

class OptimizedDatabaseService {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private lastSyncTimestamp: string = '';
  
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  // 批量获取所有数据（优化版，支持过滤条件）
  async getAllData(filters?: any): Promise<BatchDataResponse> {
    const cacheKey = `all_data_${JSON.stringify(filters || {})}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams(filters || {}).toString();
      const url = `${this.baseUrl}/api/batch/all${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 30000); // 缓存30秒
      return data;
    } catch (error) {
      console.error('批量获取数据失败:', error);
      throw error;
    }
  }

  // 获取过滤后的用户策略跟踪数据
  async getUserStrategyTracking(filters?: {
    userId?: number;
    strategyId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const cacheKey = `user_strategy_tracking_${JSON.stringify(filters || {})}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString());
          }
        });
      }
      
      const url = `${this.baseUrl}/api/user-strategy-tracking-filtered${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 60000); // 缓存1分钟
      return data;
    } catch (error) {
      console.error('获取用户策略跟踪数据失败:', error);
      throw error;
    }
  }

  // 获取过滤后的策略数据
  async getStrategies(filters?: {
    status?: string;
    userId?: number;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const cacheKey = `strategies_${JSON.stringify(filters || {})}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString());
          }
        });
      }
      
      const url = `${this.baseUrl}/api/strategies-filtered${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 60000); // 缓存1分钟
      return data;
    } catch (error) {
      console.error('获取策略数据失败:', error);
      throw error;
    }
  }

  // 获取过滤后的用户数据
  async getUsers(filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<User[]> {
    const cacheKey = `users_${JSON.stringify(filters || {})}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString());
          }
        });
      }
      
      const url = `${this.baseUrl}/api/users-filtered${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 60000); // 缓存1分钟
      return data;
    } catch (error) {
      console.error('获取用户数据失败:', error);
      throw error;
    }
  }

  // 增量数据同步
  async getIncrementalUpdates(since?: string): Promise<IncrementalUpdate[]> {
    try {
      const timestamp = since || this.lastSyncTimestamp;
      const response = await fetch(`${this.baseUrl}/api/incremental?since=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      const updates = result.updates || [];
      
      // 更新最后同步时间戳
      if (result.lastUpdateTime) {
        this.lastSyncTimestamp = result.lastUpdateTime.toString();
      }
      
      // 如果有更新，清除相关缓存
      if (updates.length > 0) {
        this.clearCache();
        console.log(`收到 ${updates.length} 个增量更新`);
      }
      
      return updates;
    } catch (error) {
      console.error('获取增量更新失败:', error);
      throw error;
    }
  }

  // 分页获取用户数据
  async getUsersPaginated(pagination: PaginationParams, filters?: FilterParams): Promise<{
    data: User[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const cacheKey = `users_${JSON.stringify({ pagination, filters })}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(pagination.sortBy && { sortBy: pagination.sortBy }),
        ...(pagination.sortOrder && { sortOrder: pagination.sortOrder }),
        ...(filters?.search && { search: filters.search }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters?.dateTo && { dateTo: filters.dateTo })
      });

      const response = await fetch(`${this.baseUrl}/api/users/paginated?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 60000); // 缓存1分钟
      return data;
    } catch (error) {
      console.error('分页获取用户数据失败:', error);
      throw error;
    }
  }

  // 获取统计数据（优化版）
  async getOptimizedStats(): Promise<{
    totalUsers: number;
    totalOrders: number;
    totalAssets: number;
    totalStrategies: number;
    activeStrategies: number;
    recentActivity: any[];
  }> {
    const cacheKey = 'stats';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/stats/optimized`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 60000); // 缓存1分钟
      return data;
    } catch (error) {
      console.error('获取优化统计数据失败:', error);
      throw error;
    }
  }

  // 缓存管理
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // 获取用户的Alpha资产数据
  async getUserAlphaAssets(userUuid: string): Promise<AlphaAsset[]> {
    const cacheKey = `alpha_assets_${userUuid}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/alpha-assets/${userUuid}`);
      if (!response.ok) {
        // 如果是404错误，说明用户没有Alpha资产数据，返回空数组
        if (response.status === 404) {
          const emptyData: AlphaAsset[] = [];
          this.setCache(cacheKey, emptyData, 30000); // 缓存空结果30秒
          return emptyData;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 30000); // 缓存30秒
      return data;
    } catch (error) {
      // 如果是网络错误或其他错误，也返回空数组，避免影响页面显示
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn(`无法获取用户${userUuid}的Alpha资产数据，可能是网络问题:`, error.message);
        return [];
      }
      console.error('获取用户Alpha资产失败:', error);
      return []; // 返回空数组而不是抛出异常
    }
  }

  // 清除缓存
  clearCache(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  // 预加载数据
  async preloadData(): Promise<void> {
    try {
      // 预加载常用数据到缓存
      await this.getAllData();
      await this.getOptimizedStats();
    } catch (error) {
      console.error('预加载数据失败:', error);
    }
  }

  // 兼容性方法 - 创建用户
  async createUser(userData: Partial<User>): Promise<User> {
    try {
      const response = await fetch(`${this.baseUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `创建用户失败: ${response.status}`);
      }
      
      // 清除相关缓存
      this.clearCache('users');
      this.clearCache('all_data');
      
      return await response.json();
    } catch (error) {
      console.error('创建用户失败:', error);
      throw error;
    }
  }

  // 兼容性方法 - 更新用户
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    try {
      const response = await fetch(`${this.baseUrl}/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `更新用户失败: ${response.status}`);
      }
      
      // 清除相关缓存
      this.clearCache('users');
      this.clearCache('all_data');
      
      return await response.json();
    } catch (error) {
      console.error('更新用户失败:', error);
      throw error;
    }
  }

  // 兼容性方法 - 删除用户
  async deleteUser(id: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/users/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `删除用户失败: ${response.status}`);
      }
      
      // 清除相关缓存
      this.clearCache('users');
      this.clearCache('all_data');
      
    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  }

  // 更新用户登录状态
  async updateUserLoginStatus(userId: number, statusData: { qr_code_status: string }): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user-login-status/${userId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(statusData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `更新用户登录状态失败: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('更新用户登录状态失败:', error);
      throw error;
    }
  }
}

export const databaseService = new OptimizedDatabaseService();
export default OptimizedDatabaseService;