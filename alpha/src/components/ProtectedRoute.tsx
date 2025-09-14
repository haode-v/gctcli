import React from 'react';
import { Box, Alert, AlertIcon, VStack, Text, Button } from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  fallback?: React.ReactNode;
}

const ProtectedRoute = ({ children, requireAuth = true, requireAdmin = false, requireSuperAdmin = false, fallback }: ProtectedRouteProps): JSX.Element | null => {
  const { isAuthenticated, isAdmin, isSuperAdmin, logout } = useAuth();

  // 如果需要认证但用户未登录
  if (requireAuth && !isAuthenticated) {
    if (fallback !== undefined) {
      return fallback as JSX.Element | null;
    }
    return (
      <Box p={8} textAlign="center">
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          请先登录以访问此功能
        </Alert>
      </Box>
    );
  }

  // 如果需要超级管理员权限但用户不是超级管理员
  if (requireSuperAdmin && !isSuperAdmin) {
    if (fallback !== undefined) {
      return fallback as JSX.Element | null;
    }
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            您没有权限访问此功能，需要超级管理员权限
          </Alert>
          <Button size="sm" variant="outline" onClick={logout}>
            切换账号
          </Button>
        </VStack>
      </Box>
    );
  }

  // 如果需要管理员权限但用户不是管理员
  if (requireAdmin && !isAdmin && !isSuperAdmin) {
    if (fallback !== undefined) {
      return fallback as JSX.Element | null;
    }
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            您没有权限访问此功能，需要管理员权限
          </Alert>
          <Button size="sm" variant="outline" onClick={logout}>
            切换账号
          </Button>
        </VStack>
      </Box>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;