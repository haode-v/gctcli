import React, { useState, useMemo, useCallback } from 'react';
import {
  ChakraProvider,
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Flex,
  Button,
  Stack,
  HStack,
  IconButton,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Divider,
  Badge,
  useColorModeValue
} from '@chakra-ui/react';
import { Icon } from '@chakra-ui/react';
import { MdDashboard, MdPeople, MdTrendingUp, MdWarning, MdMenu, MdQrCode } from 'react-icons/md';
import { FiUser } from 'react-icons/fi';
import type { IconType } from 'react-icons';

import theme from './theme';
import { DatabaseProvider } from './context/DatabaseContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ConnectionStatus from './components/ConnectionStatus';
import StatsOverview from './components/StatsOverview';
import UserStrategyTracking from './components/UserStrategyTracking';
import UsersTable from './components/UsersTable';
import EventsMonitor from './components/EventsMonitor';
import TradingPairsStats from './components/TradingPairsStats';
import QRCodeLogin from './components/QRCodeLogin';
import LoginForm from './components/LoginForm';
import UserInfo from './components/UserInfo';
import ProtectedRoute from './components/ProtectedRoute';
import UserProfile from './components/UserProfile';

// 移动端导航组件
const MobileNavigation: React.FC<{
  currentView: 'overview' | 'strategies' | 'tracking' | 'users' | 'events' | 'trading-pairs' | 'qrcode' | 'profile';
  onViewChange: (view: 'overview' | 'strategies' | 'tracking' | 'users' | 'events' | 'trading-pairs' | 'qrcode' | 'profile') => void;
}> = ({ currentView, onViewChange }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isSuperAdmin, isAdmin } = useAuth();
  
  // 将所有useColorModeValue移到组件顶层
  const bgGradient = useColorModeValue(
    'linear(to-b, blue.50, white)',
    'linear(to-b, gray.800, gray.900)'
  );
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const closeBtnHoverBg = useColorModeValue('gray.100', 'gray.700');
  const headingColor = useColorModeValue('gray.800', 'white');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const sectionColor = useColorModeValue('gray.500', 'gray.400');
  const iconButtonBg = useColorModeValue('white', 'gray.700');
  const iconButtonHoverBg = useColorModeValue('gray.50', 'gray.600');
  const buttonBg = useColorModeValue('white', 'gray.700');
  const buttonBorderColor = useColorModeValue('gray.200', 'gray.600');
  const buttonHoverBg = useColorModeValue('gray.50', 'gray.600');

  // 根据用户权限显示不同的菜单项
  const menuItems = isSuperAdmin ? [
    {
      key: 'overview',
      label: '数据概览',
      icon: MdDashboard as IconType,
      description: '查看系统概览',
      color: 'blue'
    },
    {
      key: 'tracking',
      label: '用户进度',
      icon: MdTrendingUp as IconType,
      description: '跟踪用户策略表现',
      color: 'green'
    },
    {
      key: 'events',
      label: '事件监控',
      icon: MdWarning as IconType,
      description: '监控系统事件',
      color: 'orange'
    },
    {
      key: 'trading-pairs',
      label: '交易对统计',
      icon: MdTrendingUp as IconType,
      description: '查看交易对刷量统计',
      color: 'teal'
    }
  ] : [
    {
      key: 'profile',
      label: '今日策略进度',
      icon: FiUser as IconType,
      description: '查看今日策略更新和个人信息',
      color: 'blue'
    },
    {
      key: 'qrcode',
      label: '登录二维码',
      icon: MdQrCode as IconType,
      description: '生成登录二维码',
      color: 'green'
    }
  ];

  const adminItems = [
    {
      key: 'users',
      label: '用户管理',
      icon: MdPeople as IconType,
      description: '管理系统用户',
      color: 'purple'
    }
  ];

  return (
    <>
      <IconButton
        aria-label="打开菜单"
        icon={<Icon as={MdMenu as any} />}
        variant="ghost"
        size="md"
        onClick={onOpen}
        bg={iconButtonBg}
        border="1px"
        borderColor={borderColor}
        _hover={{
          bg: iconButtonHoverBg,
          transform: 'scale(1.05)',
          boxShadow: 'md'
        }}
        _active={{
          transform: 'scale(0.95)'
        }}
        transition="all 0.2s"
        borderRadius="lg"
      />
      
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="sm">
        <DrawerOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <DrawerContent
          bg={bgGradient}
          borderLeft="1px"
          borderColor={borderColor}
          boxShadow="2xl"
        >
          <DrawerCloseButton
            size="lg"
            _hover={{
              bg: closeBtnHoverBg,
              transform: 'rotate(90deg)'
            }}
            transition="all 0.2s"
          />
          <DrawerHeader
            bg={headerBg}
            borderBottom="1px"
            borderColor={borderColor}
            py={6}
          >
            <Flex align="center" gap={3}>
              <Icon as={MdDashboard as any} boxSize={6} color="blue.500" />
              <VStack align="start" spacing={0}>
                <Heading size="md" color={headingColor}>
                  导航菜单
                </Heading>
                <Text fontSize="sm" color={textColor}>
                  Alpha Monitor
                </Text>
              </VStack>
            </Flex>
          </DrawerHeader>
          
          <DrawerBody py={6}>
            <VStack spacing={6} align="stretch">
              {/* 主要功能区 */}
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color={sectionColor}
                  textTransform="uppercase"
                  letterSpacing="wider"
                  mb={3}
                >
                  主要功能
                </Text>
                <Stack spacing={2}>
                  {menuItems.map((item) => (
                    <Button
                      key={item.key}
                      size="lg"
                      variant={currentView === item.key ? 'solid' : 'outline'}
                      colorScheme={currentView === item.key ? item.color : 'gray'}
                      bg={currentView === item.key ? undefined : buttonBg}
                      borderColor={currentView === item.key ? undefined : buttonBorderColor}
                      onClick={() => {
                        onViewChange(item.key as any);
                        onClose();
                      }}
                      justifyContent="flex-start"
                      w="full"
                      h="auto"
                      py={4}
                      px={4}
                      leftIcon={
                        <Icon
                          as={item.icon as any}
                          boxSize={5}
                          color={currentView === item.key ? 'white' : `${item.color}.500`}
                        />
                      }
                      rightIcon={
                        currentView === item.key ? (
                          <Badge
                            colorScheme={item.color}
                            variant="solid"
                            borderRadius="full"
                            px={2}
                            py={1}
                            fontSize="xs"
                          >
                            当前
                          </Badge>
                        ) : undefined
                      }
                      _hover={{
                        transform: 'translateX(4px)',
                        boxShadow: 'lg',
                        bg: currentView === item.key ? undefined : buttonHoverBg
                      }}
                      _active={{
                        transform: 'translateX(2px)'
                      }}
                      transition="all 0.2s"
                      borderRadius="xl"
                      boxShadow={currentView === item.key ? 'lg' : 'sm'}
                    >
                      <VStack align="start" spacing={1} flex={1}>
                        <Text fontWeight="semibold" fontSize="md">
                          {item.label}
                        </Text>
                        <Text
                          fontSize="xs"
                          color={currentView === item.key ? 'whiteAlpha.800' : 'gray.500'}
                          noOfLines={1}
                        >
                          {item.description}
                        </Text>
                      </VStack>
                    </Button>
                  ))}
                </Stack>
              </Box>

              {/* 管理功能区 */}
              {isSuperAdmin && (
                <Box>
                  <Divider mb={4} />
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color={sectionColor}
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mb={3}
                  >
                    管理功能
                  </Text>
                  <Stack spacing={2}>
                    {adminItems.map((item) => (
                      <Button
                        key={item.key}
                        size="lg"
                        variant={currentView === item.key ? 'solid' : 'outline'}
                        colorScheme={currentView === item.key ? item.color : 'gray'}
                        bg={currentView === item.key ? undefined : buttonBg}
                        borderColor={currentView === item.key ? undefined : buttonBorderColor}
                        onClick={() => {
                          onViewChange(item.key as any);
                          onClose();
                        }}
                        justifyContent="flex-start"
                        w="full"
                        h="auto"
                        py={4}
                        px={4}
                        leftIcon={
                          <Icon
                            as={item.icon as any}
                            boxSize={5}
                            color={currentView === item.key ? 'white' : `${item.color}.500`}
                          />
                        }
                        rightIcon={
                          currentView === item.key ? (
                            <Badge
                              colorScheme={item.color}
                              variant="solid"
                              borderRadius="full"
                              px={2}
                              py={1}
                              fontSize="xs"
                            >
                              当前
                            </Badge>
                          ) : (
                            <Badge
                              colorScheme="gray"
                              variant="subtle"
                              borderRadius="full"
                              px={2}
                              py={1}
                              fontSize="xs"
                            >
                              管理员
                            </Badge>
                          )
                        }
                        _hover={{
                          transform: 'translateX(4px)',
                          boxShadow: 'lg',
                          bg: currentView === item.key ? undefined : buttonHoverBg
                        }}
                        _active={{
                          transform: 'translateX(2px)'
                        }}
                        transition="all 0.2s"
                        borderRadius="xl"
                        boxShadow={currentView === item.key ? 'lg' : 'sm'}
                      >
                        <VStack align="start" spacing={1} flex={1}>
                          <Text fontWeight="semibold" fontSize="md">
                            {item.label}
                          </Text>
                          <Text
                            fontSize="xs"
                            color={currentView === item.key ? 'whiteAlpha.800' : 'gray.500'}
                            noOfLines={1}
                          >
                            {item.description}
                          </Text>
                        </VStack>
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

// 主应用内容组件
const AppContent: React.FC = () => {
  const { isAuthenticated, loading, isSuperAdmin, isAdmin } = useAuth();
  // 普通用户默认显示个人中心，超级管理员默认显示数据概览
  const [currentView, setCurrentView] = useState<'overview' | 'strategies' | 'tracking' | 'users' | 'events' | 'trading-pairs' | 'qrcode' | 'profile'>(isSuperAdmin ? 'overview' : 'profile');

  // 优化页面切换函数，避免重复创建，并添加权限控制
  const handleViewChange = useCallback((view: 'overview' | 'strategies' | 'tracking' | 'users' | 'events' | 'trading-pairs' | 'qrcode' | 'profile') => {
    // 普通用户只能访问个人中心和二维码登录页面
    if (!isSuperAdmin && view !== 'profile' && view !== 'qrcode') {
      return;
    }
    // 超级管理员不能访问二维码登录页面
    if (isSuperAdmin && view === 'qrcode') {
      return;
    }
    setCurrentView(view);
  }, [isSuperAdmin]);

  // 优化页面内容渲染，避免重复创建组件，并添加权限控制
  const currentViewContent = useMemo(() => {
    // 普通用户只能访问个人中心和二维码登录页面
    if (!isSuperAdmin && currentView !== 'profile' && currentView !== 'qrcode') {
      return <UserProfile />;
    }
    // 超级管理员不能访问二维码登录页面
    if (isSuperAdmin && currentView === 'qrcode') {
      return <UserStrategyTracking onViewChange={handleViewChange} />;
    }

    switch (currentView) {
      case 'overview':
        return isSuperAdmin ? (
          <Box>
            <Heading size="md" color="gray.800" mb={4}>
              数据概览
            </Heading>
            <StatsOverview />
          </Box>
        ) : <UserStrategyTracking onViewChange={handleViewChange} />;
      case 'strategies':
        return isSuperAdmin ? (
          <Box>
            <Heading size="lg" mb={6} color="gray.800">
              活跃策略详情
            </Heading>
            <Text color="gray.600" mb={4}>
              此功能正在开发中，将显示当前活跃的交易策略详细信息。
            </Text>
          </Box>
        ) : <UserProfile />;
      case 'tracking':
        return <UserStrategyTracking onViewChange={handleViewChange} />;
      case 'profile':
        return <UserProfile />;
      case 'users':
        return isSuperAdmin ? (
          <ProtectedRoute requireSuperAdmin={true} fallback={null}>
            <Box>
              <UsersTable />
            </Box>
          </ProtectedRoute>
        ) : <UserProfile />;
      case 'events':
        return isSuperAdmin ? (
          <Box>
            <Heading size="md" color="gray.800" mb={4}>
              事件监控
            </Heading>
            <EventsMonitor />
          </Box>
        ) : <UserProfile />;
      case 'trading-pairs':
        return isSuperAdmin ? (
          <Box>
            <Heading size="md" color="gray.800" mb={4}>
              交易对统计
            </Heading>
            <TradingPairsStats />
          </Box>
        ) : <UserProfile />;
      case 'qrcode':
        return <QRCodeLogin />;
      default:
        return <UserProfile />;
    }
  }, [currentView, isSuperAdmin, handleViewChange]);

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="gray.50">
        <VStack spacing={4}>
          <Icon as={MdDashboard as any} boxSize={12} color="blue.500" />
          <Text color="gray.600">加载中...</Text>
        </VStack>
      </Flex>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
        <Box minH="100vh" bg="gray.50">
          {/* 头部 */}
          <Box bg="white" borderBottom="1px" borderColor="gray.200" py={4}>
            <Container maxW="7xl">
              <Flex align="center" justify="space-between">
                <Flex align="center" gap={3} display={{ base: "none", md: "flex" }}>
                    <Icon as={MdDashboard as any} boxSize={{ base: 8, md: 10 }} color="blue.500" />
                    <VStack align="start" spacing={0}>
                      <Heading size={{ base: "md", md: "lg" }} color="gray.800">
                        Alpha Monitor
                      </Heading>
                      <Text color="gray.600" fontSize={{ base: "xs", md: "sm" }} display={{ base: "none", sm: "block" }}>
                        PostgreSQL 数据库实时监控面板
                      </Text>
                    </VStack>
                  </Flex>
                
                {/* 桌面端导航 */}
                <Flex align="center" gap={6} display={{ base: "none", lg: "flex" }}>
                  <Flex gap={1} bg="gray.100" p={1} borderRadius="lg">
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        bg={currentView === 'overview' ? 'white' : 'transparent'}
                        color={currentView === 'overview' ? 'gray.700' : 'gray.600'}
                        fontWeight={currentView === 'overview' ? 'semibold' : 'medium'}
                        boxShadow={currentView === 'overview' ? 'sm' : 'none'}
                        _hover={{
                          bg: currentView === 'overview' ? 'white' : 'gray.200',
                          color: 'gray.700'
                        }}
                        onClick={() => handleViewChange('overview')}
                        borderRadius="md"
                        px={4}
                      >
                        数据概览
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        bg={currentView === 'users' ? 'white' : 'transparent'}
                        color={currentView === 'users' ? 'gray.700' : 'gray.600'}
                        fontWeight={currentView === 'users' ? 'semibold' : 'medium'}
                        boxShadow={currentView === 'users' ? 'sm' : 'none'}
                        _hover={{
                          bg: currentView === 'users' ? 'white' : 'gray.200',
                          color: 'gray.700'
                        }}
                        onClick={() => handleViewChange('users')}
                        borderRadius="md"
                        px={4}
                      >
                        用户管理
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        bg={currentView === 'tracking' ? 'white' : 'transparent'}
                        color={currentView === 'tracking' ? 'gray.700' : 'gray.600'}
                        fontWeight={currentView === 'tracking' ? 'semibold' : 'medium'}
                        boxShadow={currentView === 'tracking' ? 'sm' : 'none'}
                        _hover={{
                          bg: currentView === 'tracking' ? 'white' : 'gray.200',
                          color: 'gray.700'
                        }}
                        onClick={() => handleViewChange('tracking')}
                        borderRadius="md"
                        px={4}
                      >
                        用户进度
                      </Button>
                    )}
                    {!isSuperAdmin && (
                      <Button
                        size="sm"
                        bg={currentView === 'profile' ? 'white' : 'transparent'}
                        color={currentView === 'profile' ? 'gray.700' : 'gray.600'}
                        fontWeight={currentView === 'profile' ? 'semibold' : 'medium'}
                        boxShadow={currentView === 'profile' ? 'sm' : 'none'}
                        _hover={{
                          bg: currentView === 'profile' ? 'white' : 'gray.200',
                          color: 'gray.700'
                        }}
                        onClick={() => handleViewChange('profile')}
                        borderRadius="md"
                        px={4}
                      >
                        今日策略进度
                      </Button>
                    )}
                    {!isSuperAdmin && (
                      <Button
                        size="sm"
                        bg={currentView === 'qrcode' ? 'white' : 'transparent'}
                        color={currentView === 'qrcode' ? 'gray.700' : 'gray.600'}
                        fontWeight={currentView === 'qrcode' ? 'semibold' : 'medium'}
                        boxShadow={currentView === 'qrcode' ? 'sm' : 'none'}
                        _hover={{
                          bg: currentView === 'qrcode' ? 'white' : 'gray.200',
                          color: 'gray.700'
                        }}
                        onClick={() => handleViewChange('qrcode')}
                        borderRadius="md"
                        px={4}
                      >
                        登录二维码
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        bg={currentView === 'events' ? 'white' : 'transparent'}
                        color={currentView === 'events' ? 'gray.700' : 'gray.600'}
                        fontWeight={currentView === 'events' ? 'semibold' : 'medium'}
                        boxShadow={currentView === 'events' ? 'sm' : 'none'}
                        _hover={{
                          bg: currentView === 'events' ? 'white' : 'gray.200',
                          color: 'gray.700'
                        }}
                        onClick={() => handleViewChange('events')}
                        borderRadius="md"
                        px={4}
                      >
                        事件监控
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        bg={currentView === 'trading-pairs' ? 'white' : 'transparent'}
                        color={currentView === 'trading-pairs' ? 'gray.700' : 'gray.600'}
                        fontWeight={currentView === 'trading-pairs' ? 'semibold' : 'medium'}
                        boxShadow={currentView === 'trading-pairs' ? 'sm' : 'none'}
                        _hover={{
                          bg: currentView === 'trading-pairs' ? 'white' : 'gray.200',
                          color: 'gray.700'
                        }}
                        onClick={() => handleViewChange('trading-pairs')}
                        borderRadius="md"
                        px={4}
                      >
                        交易对统计
                      </Button>
                    )}
                  </Flex>
                  
                  {/* 连接状态和用户信息 */}
                  <HStack spacing={3}>
                    <ConnectionStatus />
                    <UserInfo />
                  </HStack>
                </Flex>

                {/* 移动端导航 */}
                <Flex align="center" gap={2} display={{ base: "flex", lg: "none" }}>
                  <ConnectionStatus />
                  <UserInfo />
                  <MobileNavigation currentView={currentView} onViewChange={handleViewChange} />
                </Flex>
              </Flex>
            </Container>
          </Box>

          {/* 主要内容 */}
          <Container maxW="7xl" py={{ base: 4, md: 8 }} px={{ base: 4, md: 6 }}>
            <VStack spacing={{ base: 4, md: 8 }} align="stretch">
              {currentViewContent}
            </VStack>
          </Container>
        </Box>
    );
};

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <DatabaseProvider>
          <AppContent />
        </DatabaseProvider>
      </AuthProvider>
    </ChakraProvider>
  );
}

export default App;