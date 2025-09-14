import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  uuid: string;
  admin_id: number | string | null;
  nickname: string;
  email: string;
  mobile: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  canManageUsers: () => boolean;
  canManageStrategies: () => boolean;
  canViewAllUsers: () => boolean;
  getManagedUserIds: () => number[];
  getManageableUserIds: () => number[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 写死的超级管理员账号
const SUPER_ADMIN = {
  username: 'superadmin',
  password: 'admin123456', // 在实际生产环境中应该使用更安全的密码
  id: 0,
  uuid: 'super-admin-uuid',
  admin_id: null,
  nickname: '超级管理员',
  email: 'superadmin@system.com',
  mobile: '',
  status: 'active'
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查本地存储中是否有用户信息
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // 检查是否是超级管理员
      if (username === SUPER_ADMIN.username && password === SUPER_ADMIN.password) {
        const superAdminUser: User = {
          id: SUPER_ADMIN.id,
          username: SUPER_ADMIN.username,
          uuid: SUPER_ADMIN.uuid,
          admin_id: SUPER_ADMIN.admin_id,
          nickname: SUPER_ADMIN.nickname,
          email: SUPER_ADMIN.email,
          mobile: SUPER_ADMIN.mobile,
          status: SUPER_ADMIN.status
        };
        setUser(superAdminUser);
        localStorage.setItem('auth_user', JSON.stringify(superAdminUser));
        return true;
      }

      // 调用后端API进行登录验证
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
        localStorage.setItem('auth_user', JSON.stringify(userData.user));
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  const isSuperAdmin = user?.id === 0; // 超级管理员ID为0
  const isAdmin = false; // 除了超级管理员外，所有用户都是普通用户
  const isAuthenticated = !!user;

  // 检查是否可以管理用户 - 只有超级管理员可以
  const canManageUsers = (): boolean => {
    return isSuperAdmin;
  };

  // 检查是否可以管理策略 - 只有超级管理员可以
  const canManageStrategies = (): boolean => {
    return isSuperAdmin;
  };

  // 检查是否可以查看所有用户 - 只有超级管理员可以
  const canViewAllUsers = (): boolean => {
    return isSuperAdmin;
  };

  // 获取可管理的用户ID列表
  const getManagedUserIds = (): number[] => {
    if (isSuperAdmin) {
      return []; // 超级管理员可以管理所有用户，返回空数组表示无限制
    }
    return user ? [user.id] : []; // 普通用户只能管理自己
  };

  // 获取可管理的用户ID列表（别名方法）
  const getManageableUserIds = (): number[] => {
    return getManagedUserIds();
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    login,
    logout,
    loading,
    canManageUsers,
    canManageStrategies,
    canViewAllUsers,
    getManagedUserIds,
    getManageableUserIds,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};