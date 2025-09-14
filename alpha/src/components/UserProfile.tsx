import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardBody,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Badge,
  Button,
  Input,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  Spacer,
  Divider,
  Icon
} from '@chakra-ui/react';
import { FiUser, FiTarget, FiTrendingUp, FiLock, FiEdit3, FiMail, FiPhone, FiCalendar } from 'react-icons/fi';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';

interface UserProfileProps {
  onViewChange?: (view: 'overview' | 'strategies' | 'tracking' | 'users' | 'events' | 'trading-pairs' | 'profile') => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onViewChange }) => {
  const { user } = useAuth();
  const { strategies, userStrategyTracking } = useDatabase();
  const { isOpen: isPasswordModalOpen, onOpen: onPasswordModalOpen, onClose: onPasswordModalClose } = useDisclosure();
  const toast = useToast();
  
  // 密码修改相关状态
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<{[key: string]: string}>({});
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 格式化货币
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);

  // 获取用户的策略进度数据（只显示今天的）
  const userTrackingData = useMemo(() => {
    if (!user) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return userStrategyTracking.filter(tracking => {
      if (tracking.user_id !== user.id) return false;
      const updatedAt = new Date(tracking.updated_at);
      return updatedAt >= today && updatedAt < tomorrow;
    });
  }, [userStrategyTracking, user]);

  // 计算用户统计数据
  const userStats = useMemo(() => {
    if (!user || userTrackingData.length === 0) {
      return {
        totalStrategies: 0,
        activeStrategies: 0,
        completedStrategies: 0,
        totalVolume: 0,
        averageProgress: 0
      };
    }

    const totalStrategies = userTrackingData.length;
    const activeStrategies = userTrackingData.filter(t => t.status === 'active').length;
    const completedStrategies = userTrackingData.filter(t => t.status === 'completed').length;
    const totalVolume = userTrackingData.reduce((sum, t) => sum + parseFloat(t.achieved_trade_volume || '0'), 0);
    
    // 计算平均进度
    let totalProgress = 0;
    userTrackingData.forEach(tracking => {
      const strategy = strategies.find(s => s.id === tracking.strategy_id);
      if (strategy) {
        const maxVolume = parseFloat(strategy.max_total_volume_usdt || '0');
        const achievedVolume = parseFloat(tracking.achieved_trade_volume || '0');
        const progress = maxVolume > 0 ? Math.min((achievedVolume / maxVolume) * 100, 100) : 0;
        totalProgress += progress;
      }
    });
    const averageProgress = totalStrategies > 0 ? totalProgress / totalStrategies : 0;

    return {
      totalStrategies,
      activeStrategies,
      completedStrategies,
      totalVolume,
      averageProgress
    };
  }, [userTrackingData, strategies]);

  // 获取策略详细信息
  const getStrategyDetails = useCallback((strategyId: number) => {
    return strategies.find(s => s.id === strategyId);
  }, [strategies]);

  // 计算策略进度
  const calculateProgress = useCallback((tracking: any) => {
    const strategy = getStrategyDetails(tracking.strategy_id);
    if (!strategy) return 0;
    
    const maxVolume = parseFloat(strategy.max_total_volume_usdt || '0');
    const achievedVolume = parseFloat(tracking.achieved_trade_volume || '0');
    
    if (maxVolume === 0) return 0;
    return Math.min((achievedVolume / maxVolume) * 100, 100);
  }, [getStrategyDetails]);

  // 获取状态颜色
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'paused': return 'yellow';
      case 'completed': return 'blue';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  }, []);

  // 验证密码表单
  const validatePasswordForm = useCallback(() => {
    const errors: {[key: string]: string} = {};
    
    if (!passwordForm.currentPassword) {
      errors.currentPassword = '请输入当前密码';
    }
    
    if (!passwordForm.newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = '新密码长度至少6位';
    }
    
    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  }, [passwordForm]);

  // 处理密码修改
  const handlePasswordChange = useCallback(async () => {
    if (!validatePasswordForm()) return;
    
    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: '密码修改成功',
          description: '您的密码已成功修改',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // 重置表单并关闭模态框
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setPasswordErrors({});
        onPasswordModalClose();
      } else {
        toast({
          title: '密码修改失败',
          description: data.message || '修改密码时发生错误',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('修改密码时出错:', error);
      toast({
        title: '密码修改失败',
        description: '网络错误，请稍后重试',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsChangingPassword(false);
    }
  }, [passwordForm, validatePasswordForm, toast, onPasswordModalClose]);

  // 处理表单输入
  const handlePasswordInputChange = useCallback((field: string, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [passwordErrors]);

  if (!user) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>用户信息获取失败</AlertTitle>
        <AlertDescription>无法获取当前用户信息，请重新登录。</AlertDescription>
      </Alert>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* 页面标题 */}
      <Flex align="center" justify="space-between">
        <Heading size="lg" color="gray.800">
          个人中心
        </Heading>
        <Button
          leftIcon={<Icon as={FiLock as React.ComponentType} />}
          colorScheme="blue"
          variant="outline"
          onClick={onPasswordModalOpen}
        >
          修改密码
        </Button>
      </Flex>

      {/* 用户基本信息 */}
      <Card bg="white" boxShadow="xl" border="1px solid" borderColor="gray.200">
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Flex align="center" gap={3}>
              <Icon as={FiUser as React.ComponentType} boxSize={6} color="blue.500" />
              <Heading size="md" color="gray.800">基本信息</Heading>
            </Flex>
            
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>用户名</Text>
                <Text fontWeight="semibold" color="gray.800">{user.username}</Text>
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>昵称</Text>
                <Text fontWeight="semibold" color="gray.800">{user.nickname || '未设置'}</Text>
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>用户ID</Text>
                <Text fontWeight="semibold" color="gray.800" fontFamily="mono">{user.uuid}</Text>
              </Box>
              
              {user.email && (
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={1}>
                    <Icon as={FiMail as React.ComponentType} mr={1} />
                    邮箱
                  </Text>
                  <Text fontWeight="semibold" color="gray.800">{user.email}</Text>
                </Box>
              )}
              
              {user.mobile && (
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={1}>
                    <Icon as={FiPhone as React.ComponentType} mr={1} />
                    手机号
                  </Text>
                  <Text fontWeight="semibold" color="gray.800">{user.mobile}</Text>
                </Box>
              )}
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>状态</Text>
                <Badge colorScheme={user.status === 'active' ? 'green' : 'red'}>
                  {user.status === 'active' ? '活跃' : '非活跃'}
                </Badge>
              </Box>
            </SimpleGrid>
          </VStack>
        </CardBody>
      </Card>

      {/* 策略统计概览 */}
      <Card bg="white" boxShadow="xl" border="1px solid" borderColor="gray.200">
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Flex align="center" gap={3}>
              <Icon as={FiTarget as React.ComponentType} boxSize={6} color="green.500" />
              <Heading size="md" color="gray.800">策略统计</Heading>
            </Flex>
            
            <SimpleGrid columns={{ base: 2, md: 3, lg: 5 }} spacing={4}>
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">总策略数</StatLabel>
                <StatNumber color="blue.600">{userStats.totalStrategies}</StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">参与的策略总数</StatHelpText>
              </Stat>
              
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">活跃策略</StatLabel>
                <StatNumber color="green.600">{userStats.activeStrategies}</StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">正在执行的策略</StatHelpText>
              </Stat>
              
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">已完成</StatLabel>
                <StatNumber color="purple.600">{userStats.completedStrategies}</StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">已完成的策略</StatHelpText>
              </Stat>
              
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">总交易量</StatLabel>
                <StatNumber color="orange.600">{formatCurrency(userStats.totalVolume)}</StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">累计交易金额</StatHelpText>
              </Stat>
              
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">平均进度</StatLabel>
                <StatNumber color="teal.600">{userStats.averageProgress.toFixed(1)}%</StatNumber>
                <StatHelpText color="gray.500" fontSize="xs">所有策略平均完成度</StatHelpText>
              </Stat>
            </SimpleGrid>
          </VStack>
        </CardBody>
      </Card>

      {/* 策略进度详情 */}
      <Card bg="white" boxShadow="xl" border="1px solid" borderColor="gray.200">
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
              <Flex align="center" gap={3}>
                <Icon as={FiTrendingUp as React.ComponentType} boxSize={6} color="purple.500" />
                <Heading size="md" color="gray.800">今日策略进度</Heading>
              </Flex>
              <Text fontSize="sm" color="gray.500">
                {new Date().toLocaleDateString('zh-CN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
            </Flex>
            
            {userTrackingData.length === 0 ? (
              <Alert status="info">
                <AlertIcon />
                <AlertTitle>暂无今日策略数据</AlertTitle>
                <AlertDescription>今天还没有策略更新记录。</AlertDescription>
              </Alert>
            ) : (
              <>
                {/* 桌面端表格 */}
                <Box overflowX="auto" display={{ base: 'none', lg: 'block' }}>
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>策略ID</Th>
                        <Th>策略名称</Th>
                        <Th>状态</Th>
                        <Th>进度</Th>
                        <Th>已完成交易量</Th>
                        <Th>目标交易量</Th>
                        <Th>当前余额</Th>
                        <Th>更新时间</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {userTrackingData.map((tracking) => {
                        const strategy = getStrategyDetails(tracking.strategy_id);
                        const progress = calculateProgress(tracking);
                        
                        return (
                          <Tr key={`${tracking.user_id}-${tracking.strategy_id}`}>
                            <Td fontFamily="mono">{tracking.strategy_id}</Td>
                            <Td>
                              {strategy ? (
                                <VStack align="start" spacing={1}>
                                  <Text fontWeight="medium" fontSize="sm">
                                    {strategy.name || `策略 ${strategy.id}`}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500">
                                    {strategy.trading_pair}
                                  </Text>
                                </VStack>
                              ) : (
                                <Text color="gray.500">策略信息不可用</Text>
                              )}
                            </Td>
                            <Td>
                              <Badge colorScheme={getStatusColor(tracking.status)}>
                                {tracking.status === 'active' ? '活跃' :
                                 tracking.status === 'paused' ? '暂停' :
                                 tracking.status === 'completed' ? '完成' :
                                 tracking.status === 'cancelled' ? '取消' : tracking.status}
                              </Badge>
                            </Td>
                            <Td>
                              <VStack align="start" spacing={1}>
                                <Progress
                                  value={progress}
                                  size="sm"
                                  colorScheme={progress >= 100 ? 'green' : 'blue'}
                                  w="80px"
                                />
                                <Text fontSize="xs" color="gray.600">
                                  {progress.toFixed(1)}%
                                </Text>
                              </VStack>
                            </Td>
                            <Td>
                              <Text fontSize="sm" fontFamily="mono">
                                {formatCurrency(parseFloat(tracking.achieved_trade_volume || '0'))}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm" fontFamily="mono">
                                {strategy ? formatCurrency(parseFloat(strategy.max_total_volume_usdt || '0')) : 'N/A'}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="sm" fontFamily="mono">
                                {formatCurrency(parseFloat(tracking.current_balance || tracking.initial_balance || '0'))}
                              </Text>
                            </Td>
                            <Td>
                              <Text fontSize="xs" color="gray.600">
                                {new Date(tracking.updated_at).toLocaleString('zh-CN')}
                              </Text>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </Box>
                
                {/* 移动端卡片布局 */}
                <VStack spacing={4} display={{ base: 'flex', lg: 'none' }}>
                  {userTrackingData.map((tracking) => {
                    const strategy = getStrategyDetails(tracking.strategy_id);
                    const progress = calculateProgress(tracking);
                    
                    return (
                      <Card key={`${tracking.user_id}-${tracking.strategy_id}`} w="full" variant="outline">
                        <CardBody p={4}>
                          <VStack spacing={3} align="stretch">
                            {/* 策略信息 */}
                            <Flex justify="space-between" align="start">
                              <VStack align="start" spacing={1} flex={1}>
                                <Text fontWeight="bold" fontSize="md">
                                  {strategy ? (strategy.name || `策略 ${strategy.id}`) : '策略信息不可用'}
                                </Text>
                                <Text fontSize="sm" color="gray.500" fontFamily="mono">
                                  ID: {tracking.strategy_id}
                                </Text>
                                {strategy && (
                                  <Text fontSize="sm" color="gray.600">
                                    {strategy.trading_pair}
                                  </Text>
                                )}
                              </VStack>
                              <Badge colorScheme={getStatusColor(tracking.status)} ml={2}>
                                {tracking.status === 'active' ? '活跃' :
                                 tracking.status === 'paused' ? '暂停' :
                                 tracking.status === 'completed' ? '完成' :
                                 tracking.status === 'cancelled' ? '取消' : tracking.status}
                              </Badge>
                            </Flex>
                            
                            {/* 进度条 */}
                            <Box>
                              <Flex justify="space-between" mb={1}>
                                <Text fontSize="sm" color="gray.600">进度</Text>
                                <Text fontSize="sm" fontWeight="medium">{progress.toFixed(1)}%</Text>
                              </Flex>
                              <Progress
                                value={progress}
                                size="md"
                                colorScheme={progress >= 100 ? 'green' : 'blue'}
                                borderRadius="md"
                              />
                            </Box>
                            
                            {/* 交易数据 */}
                            <SimpleGrid columns={2} spacing={3}>
                              <Box>
                                <Text fontSize="xs" color="gray.500" mb={1}>已完成交易量</Text>
                                <Text fontSize="sm" fontWeight="medium" fontFamily="mono">
                                  {formatCurrency(parseFloat(tracking.achieved_trade_volume || '0'))}
                                </Text>
                              </Box>
                              <Box>
                                <Text fontSize="xs" color="gray.500" mb={1}>目标交易量</Text>
                                <Text fontSize="sm" fontWeight="medium" fontFamily="mono">
                                  {strategy ? formatCurrency(parseFloat(strategy.max_total_volume_usdt || '0')) : 'N/A'}
                                </Text>
                              </Box>
                              <Box>
                                <Text fontSize="xs" color="gray.500" mb={1}>当前余额</Text>
                                <Text fontSize="sm" fontWeight="medium" fontFamily="mono">
                                  {formatCurrency(parseFloat(tracking.current_balance || tracking.initial_balance || '0'))}
                                </Text>
                              </Box>
                              <Box>
                                <Text fontSize="xs" color="gray.500" mb={1}>更新时间</Text>
                                <Text fontSize="sm">
                                  {new Date(tracking.updated_at).toLocaleString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Text>
                              </Box>
                            </SimpleGrid>
                          </VStack>
                        </CardBody>
                      </Card>
                    );
                  })}
                </VStack>
              </>
            )}
          </VStack>
        </CardBody>
      </Card>

      {/* 修改密码模态框 */}
      <Modal isOpen={isPasswordModalOpen} onClose={onPasswordModalClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex align="center" gap={2}>
              <Icon as={FiLock as React.ComponentType} color="blue.500" />
              修改密码
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isInvalid={!!passwordErrors.currentPassword}>
                <FormLabel>当前密码</FormLabel>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                  placeholder="请输入当前密码"
                />
                <FormErrorMessage>{passwordErrors.currentPassword}</FormErrorMessage>
              </FormControl>
              
              <FormControl isInvalid={!!passwordErrors.newPassword}>
                <FormLabel>新密码</FormLabel>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                  placeholder="请输入新密码（至少6位）"
                />
                <FormErrorMessage>{passwordErrors.newPassword}</FormErrorMessage>
              </FormControl>
              
              <FormControl isInvalid={!!passwordErrors.confirmPassword}>
                <FormLabel>确认新密码</FormLabel>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                  placeholder="请再次输入新密码"
                />
                <FormErrorMessage>{passwordErrors.confirmPassword}</FormErrorMessage>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onPasswordModalClose}>
              取消
            </Button>
            <Button
              colorScheme="blue"
              onClick={handlePasswordChange}
              isLoading={isChangingPassword}
              loadingText="修改中..."
            >
              确认修改
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default UserProfile;