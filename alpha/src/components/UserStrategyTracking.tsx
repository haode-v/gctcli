import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardBody,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  VStack,
  HStack,
  Icon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Progress,
  Input,
  InputGroup,
  InputLeftElement,
  Button,
  Flex,
  Select,
  Spacer,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { FiUser, FiTarget, FiTrendingUp, FiAlertTriangle, FiSearch, FiChevronLeft, FiChevronRight, FiFilter, FiCopy } from 'react-icons/fi';
import { MdWarning } from 'react-icons/md';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';

interface UserStrategyTrackingProps {
  onViewChange?: (view: 'overview' | 'strategies' | 'tracking' | 'users' | 'events' | 'trading-pairs') => void;
}

const UserStrategyTracking: React.FC<UserStrategyTrackingProps> = ({ onViewChange }) => {
  const { users, orders, userAssets, strategies, trades, userStrategyTracking, getUserAlphaAssets, getFilteredUserStrategyTracking, getFilteredStrategies } = useDatabase();
  const { user, canViewAllUsers, getManageableUserIds } = useAuth();
  const [searchStrategyId, setSearchStrategyId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // 新增功能状态
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  
  // 过滤后的数据状态
  const [filteredTrackingData, setFilteredTrackingData] = useState<any[]>([]);
  const [filteredStrategiesData, setFilteredStrategiesData] = useState<any[]>([]);
  const [isLoadingFiltered, setIsLoadingFiltered] = useState(false);
  
  // 数据不一致检测相关状态
  const [inconsistentData, setInconsistentData] = useState<any[]>([]);
  const [isCheckingInconsistency, setIsCheckingInconsistency] = useState(false);
  const { isOpen: isInconsistencyModalOpen, onOpen: onInconsistencyModalOpen, onClose: onInconsistencyModalClose } = useDisclosure();
  const toast = useToast();
  
  // 状态切换相关状态
  const [updatingStatus, setUpdatingStatus] = useState<{[key: string]: boolean}>({});

  // 从后端获取过滤后的数据
  const loadFilteredData = useCallback(async () => {
    try {
      setIsLoadingFiltered(true);
      
      // 构建过滤条件
      const trackingFilters: any = {
        limit: 1000 // 设置合理的限制
      };
      
      const strategyFilters: any = {
        limit: 1000,
        status: 'active' // 只查询活跃状态的策略
      };
      
      // 根据showOnlyIncomplete状态决定是否过滤active状态
      if (showOnlyIncomplete) {
        trackingFilters.status = 'active';
      }
      
      // 如果有策略ID搜索条件
      if (searchStrategyId.trim()) {
        trackingFilters.strategyId = parseInt(searchStrategyId.trim());
      }
      
      // 权限控制：只获取用户有权限查看的数据
      if (!canViewAllUsers()) {
        const manageableUserIds = getManageableUserIds();
        // 注意：后端API需要支持多个用户ID的过滤
        if (manageableUserIds.length > 0) {
          trackingFilters.userId = manageableUserIds[0]; // 简化处理，实际可能需要支持多个ID
        }
      }
      
      // 并行获取数据
      const [trackingData, strategiesData] = await Promise.all([
        getFilteredUserStrategyTracking(trackingFilters),
        getFilteredStrategies(strategyFilters)
      ]);
      
      // 只保留与活跃策略相关的用户进度数据
      const activeStrategyIds = new Set(strategiesData.map(s => s.id));
      const filteredTrackingData = trackingData.filter(tracking => 
        activeStrategyIds.has(tracking.strategy_id)
      );
      
      setFilteredTrackingData(filteredTrackingData);
      setFilteredStrategiesData(strategiesData);
      
    } catch (error) {
      console.error('加载过滤数据失败:', error);
      toast({
        title: '数据加载失败',
        description: '无法获取过滤后的数据，请稍后重试',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoadingFiltered(false);
    }
  }, [searchStrategyId, showOnlyIncomplete, canViewAllUsers, getManageableUserIds, getFilteredUserStrategyTracking, getFilteredStrategies, toast]);
  
  // 重置页码当搜索条件改变时，并重新加载数据
  useEffect(() => {
    setCurrentPage(1);
    loadFilteredData();
  }, [searchStrategyId, showOnlyIncomplete, loadFilteredData]);

  // 切换显示模式
  const toggleShowMode = useCallback(() => {
    setShowOnlyIncomplete(!showOnlyIncomplete);
  }, [showOnlyIncomplete]);

  // 使用useCallback优化函数，避免不必要的重新创建
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);
  
  // 处理状态切换
  const handleToggleStatus = useCallback(async (userId: number, strategyId: number, currentStatus: string) => {
    const key = `${userId}-${strategyId}`;
    
    // 防止重复点击
    if (updatingStatus[key]) {
      return;
    }
    
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    
    try {
      setUpdatingStatus(prev => ({ ...prev, [key]: true }));
      
      const response = await fetch('/api/user-strategy-tracking/update-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          strategyId: strategyId,
          status: newStatus
        })
      });
      
      if (response.ok) {
        toast({
          title: '状态更新成功',
          description: `用户策略状态已${newStatus === 'active' ? '启动' : '暂停'}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // 重新加载数据
        await loadFilteredData();
      } else {
        let errorMessage = '更新失败';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // 如果响应不是JSON格式，使用HTTP状态码信息
          errorMessage = `HTTP ${response.status}: ${response.statusText || '服务器错误'}`;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('状态更新失败:', error);
      toast({
        title: '状态更新失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [key]: false }));
    }
  }, [updatingStatus, toast, loadFilteredData]);

  // 获取用户USDT余额（从tracking数据中直接获取）
  const getUserUsdtBalance = useCallback((tracking: any) => {
    return tracking.current_balance || tracking.initial_balance || '0.00';
  }, []);

  // 预计算策略映射关系（使用过滤后的数据）
  const strategyMap = useMemo(() => {
    const map = new Map();
    // 优先使用过滤后的策略数据，如果为空则使用原始数据
    const strategiesToUse = filteredStrategiesData.length > 0 ? filteredStrategiesData : strategies;
    strategiesToUse.forEach(strategy => {
      map.set(strategy.id, strategy);
    });
    return map;
  }, [filteredStrategiesData, strategies]);

  // 计算进度
  const calculateProgress = useCallback((tracking: any) => {
    const strategy = strategyMap.get(tracking.strategy_id);
    const maxVolume = parseFloat(strategy?.max_total_volume_usdt || '0');
    const achievedVolume = parseFloat(tracking.achieved_trade_volume || '0');
    
    if (maxVolume === 0) return 0;
    return Math.min((achievedVolume / maxVolume) * 100, 100);
  }, [strategyMap]);

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

  // 检查数据是否超过10分钟未更新
  const isDataStale = (tracking: any) => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const updatedAt = new Date(tracking.updated_at);
    return updatedAt < tenMinutesAgo && tracking.status === 'active';
  };

  // 检测数据不一致
  const checkDataInconsistency = async () => {
    setIsCheckingInconsistency(true);
    try {
      const response = await fetch('/api/data-inconsistency-check');
      if (!response.ok) {
        throw new Error('检查数据不一致失败');
      }
      const data = await response.json();
      setInconsistentData(data.userStats || []);
      
      if (data.userStats && data.userStats.length > 0) {
        onInconsistencyModalOpen();
        toast({
          title: '发现数据不一致',
          description: `发现 ${data.userCount} 个用户在活跃策略中缺少user_strategy_tracking表记录`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: '数据检查完成',
          description: '未发现数据不一致问题',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('检查数据不一致时出错:', error);
      toast({
        title: '检查失败',
        description: '检查数据不一致时发生错误',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
       setIsCheckingInconsistency(false);
     }
    };

  // 获取进度条颜色方案
  const getProgressColorScheme = (tracking: any, progress: number) => {
    // 检查策略是否已结束
    const strategy = strategyMap.get(tracking.strategy_id);
    if (strategy) {
      const now = new Date();
      const endTime = new Date(strategy.end_time);
      const isStrategyEnded = now > endTime;
      
      if (isStrategyEnded) {
        return 'blue'; // 策略已结束时显示蓝色，优先级最高
      }
    }
    
    // 策略仍活跃时，检查数据是否过期
    if (isDataStale(tracking)) {
      return 'red'; // 策略活跃但数据过期时显示红色报警
    }
    
    return progress >= 100 ? 'green' : 'gray';
  };

  // 获取进度条背景颜色
  const getProgressBackgroundColor = (tracking: any, progress: number) => {
    // 检查策略是否已结束
    const strategy = strategyMap.get(tracking.strategy_id);
    if (strategy) {
      const now = new Date();
      const endTime = new Date(strategy.end_time);
      const isStrategyEnded = now > endTime;
      
      if (isStrategyEnded) {
        return '#3182CE'; // 策略已结束时显示蓝色，优先级最高
      }
    }
    
    // 策略仍活跃时，检查数据是否过期
    if (isDataStale(tracking)) {
      return '#E53E3E'; // 策略活跃但数据过期时显示红色报警
    }
    
    return progress >= 100 ? '#38A169' : '#CBD5E0';
  };

  // 使用后端过滤的数据（替代前端大量数据筛选）
  const todayTracking = useMemo(() => {
    // 优先使用后端过滤的数据，如果为空或正在加载则使用原始数据作为后备
    if (isLoadingFiltered) {
      return []; // 加载中时返回空数组
    }
    
    if (filteredTrackingData.length > 0) {
      return filteredTrackingData; // 使用后端过滤的数据
    }
    
    // 后备方案：使用原始的前端过滤逻辑（仅在后端数据不可用时）
    return userStrategyTracking.filter(tracking => {
      // 检查对应的策略是否存在
      const strategy = strategies.find(s => s.id === tracking.strategy_id);
      if (!strategy) return false;
      
      return true;
    });
  }, [filteredTrackingData, isLoadingFiltered, userStrategyTracking, strategies]);

  // 过滤数据（简化版，主要处理完成状态过滤，其他过滤已在后端完成）
  const filteredTracking = useMemo(() => {
    let filtered = todayTracking;
    
    // 如果使用的是原始数据（后备方案），需要进行权限控制和策略ID搜索
    if (filteredTrackingData.length === 0 && !isLoadingFiltered) {
      // 权限控制：只显示用户有权限查看的用户数据
      if (!canViewAllUsers()) {
        const manageableUserIds = getManageableUserIds();
        filtered = filtered.filter(tracking => 
          manageableUserIds.includes(tracking.user_id)
        );
      }
      
      // 策略ID搜索（后端已处理，这里是后备）
      if (searchStrategyId.trim()) {
        filtered = filtered.filter(tracking => 
          tracking.strategy_id.toString().includes(searchStrategyId.trim())
        );
      }
    }
    
    // 根据显示模式过滤：只显示未完成的用户进度（这个需要在前端处理，因为涉及复杂计算）
    if (showOnlyIncomplete) {
      filtered = filtered.filter(tracking => {
        const progress = calculateProgress(tracking);
        return progress < 100;
      });
    }
    
    return filtered;
  }, [todayTracking, filteredTrackingData, isLoadingFiltered, searchStrategyId, showOnlyIncomplete, canViewAllUsers, getManageableUserIds, calculateProgress]);

  // 分页逻辑
  const totalPages = Math.ceil(filteredTracking.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTracking.slice(startIndex, endIndex);
  }, [filteredTracking, currentPage, itemsPerPage]);

  // 计算统计数据
  const statsData = useMemo(() => {
    const totalUsers = new Set(todayTracking.map(t => t.user_id)).size;
    
    // 计算活跃策略数量（在生命周期内的策略，与StatsOverview保持一致）
    const now = new Date();
    const activeStrategies = strategies.filter(strategy => {
      const startTime = new Date(strategy.start_time);
      const endTime = new Date(strategy.end_time);
      return now >= startTime && now <= endTime && strategy.status === 'active';
    }).length;
    
    const averageProgress = todayTracking.length > 0 
      ? todayTracking.reduce((sum, tracking) => sum + calculateProgress(tracking), 0) / todayTracking.length 
      : 0;
    
    // 计算问题策略数量（参考EventsMonitor的逻辑）
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const problematicCount = userStrategyTracking.filter(tracking => {
      // 状态为active
      if (tracking.status !== 'active') return false;

      // updated_at小于当前时间十分钟
      const updatedAt = new Date(tracking.updated_at);
      if (updatedAt >= tenMinutesAgo) return false;
      
      // 检查对应的策略是否为活跃状态
      const strategy = strategies.find(s => s.id === tracking.strategy_id);
      if (!strategy || strategy.status !== 'active') return false;

      // 检查策略是否在启动时间范围内
      if (strategy.start_time) {
        const strategyStartTime = new Date(strategy.start_time);
        if (now < strategyStartTime) return false; // 策略还未启动
      }
      
      // 检查策略是否已结束
      if (strategy.end_time) {
        const strategyEndTime = new Date(strategy.end_time);
        if (now > strategyEndTime) return false; // 策略已结束
      }
      return true;
    }).length;
    
    return {
      totalUsers,
      activeStrategies,
      averageProgress,
      problematicCount
    };
  }, [todayTracking, strategies, userStrategyTracking]);
  
  const { totalUsers, activeStrategies, averageProgress, problematicCount } = statsData;
  
  // 预计算用户映射关系
  const userMap = useMemo(() => {
    const map = new Map();
    users.forEach(user => {
      map.set(user.id, user);
    });
    return map;
  }, [users]);

  // 复制当前表格显示的所有用户UUID
  const copyUserUuids = useCallback(() => {
    const uuids = paginatedData.map(tracking => {
      const user = userMap.get(tracking.user_id);
      return user?.uuid || '';
    }).filter(uuid => uuid !== '');
    
    const uuidText = uuids.join('\n');
    
    if (uuidText) {
      // 检查 navigator.clipboard 是否可用
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(uuidText).then(() => {
          toast({
            title: '复制成功',
            description: `已复制 ${uuids.length} 个用户UUID`,
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        }).catch(() => {
          toast({
            title: '复制失败',
            description: '无法复制到剪贴板',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        });
      } else {
        // 降级处理：创建临时文本区域进行复制
        try {
          const textArea = document.createElement('textarea');
          textArea.value = uuidText;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            toast({
              title: '复制成功',
              description: `已复制 ${uuids.length} 个用户UUID`,
              status: 'success',
              duration: 2000,
              isClosable: true,
            });
          } else {
            throw new Error('execCommand failed');
          }
        } catch (err) {
          toast({
            title: '复制失败',
            description: '您的浏览器不支持自动复制，请手动复制以下内容：' + uuidText.substring(0, 50) + '...',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      }
    } else {
      toast({
        title: '无数据可复制',
        description: '当前表格中没有有效的用户UUID',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [paginatedData, userMap, toast]);

  return (
    <VStack spacing={6} align="stretch">
      {/* 统计概览 */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
        {/* 移动端只显示平均进度 */}
        <Card 
          bg="white"
          color="gray.800"
          boxShadow="xl"
          border="1px solid"
          borderColor="gray.200"
          _hover={{ transform: 'translateY(-2px)', boxShadow: '2xl' }}
          transition="all 0.3s ease"
        >
          <CardBody>
            <Stat>
              <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">
                <HStack>
                  <Icon as={FiTrendingUp as React.ComponentType} boxSize={4} color="purple.500" />
                  <Text>平均进度</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="3xl" fontWeight="bold" color="purple.600">{averageProgress.toFixed(1)}%</StatNumber>
              <StatHelpText color="gray.500" fontSize="xs">所有策略的平均完成度</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        {/* 桌面端显示其他统计 */}
        <Card 
          bg="white"
          color="gray.800"
          boxShadow="xl"
          border="1px solid"
          borderColor="gray.200"
          _hover={{ transform: 'translateY(-2px)', boxShadow: '2xl' }}
          transition="all 0.3s ease"
          display={{ base: 'none', md: 'block' }}
        >
          <CardBody>
            <Stat>
              <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">
                <HStack>
                  <Icon as={FiUser as React.ComponentType} boxSize={4} color="blue.500" />
                  <Text>活跃用户数</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="3xl" fontWeight="bold" color="blue.600">{totalUsers}</StatNumber>
              <StatHelpText color="gray.500" fontSize="xs">今日参与策略的用户</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card 
          bg="white"
          color="gray.800"
          boxShadow="xl"
          border="1px solid"
          borderColor="gray.200"
          _hover={{ transform: 'translateY(-2px)', boxShadow: '2xl' }}
          transition="all 0.3s ease"
          display={{ base: 'none', md: 'block' }}
        >
          <CardBody>
            <Stat>
              <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">
                <HStack>
                  <Icon as={FiTarget as React.ComponentType} boxSize={4} color="green.500" />
                  <Text>活跃策略数</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="3xl" fontWeight="bold" color="green.600">{activeStrategies}</StatNumber>
              <StatHelpText color="gray.500" fontSize="xs">今日执行的策略数量</StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card
          bg="white"
          boxShadow="xl"
          borderRadius="xl"
          border="none"
          cursor="pointer"
          _hover={{ transform: 'translateY(-2px)', boxShadow: '2xl' }}
          transition="all 0.3s ease"
          display={{ base: 'none', md: 'block' }}
          onClick={() => onViewChange?.('events')}
        >
          <CardBody>
            <Stat>
              <StatLabel color="gray.600" fontSize="sm" fontWeight="medium">
                <HStack>
                  <Icon as={FiAlertTriangle as React.ComponentType} boxSize={4} color={problematicCount > 0 ? "red.500" : "green.500"} />
                  <Text>问题策略数量</Text>
                </HStack>
              </StatLabel>
              <StatNumber fontSize="2xl" fontWeight="bold" color={problematicCount > 0 ? "red.600" : "green.600"}>{problematicCount}</StatNumber>
              <StatHelpText color="gray.500" fontSize="xs">点击查看详情</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* 用户策略跟踪详情表 */}
      <Card 
        bg="white" 
        boxShadow="xl" 
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.100"
        _hover={{ boxShadow: '2xl' }}
        transition="all 0.3s ease"
      >
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Flex 
              justify="space-between" 
              align="center" 
              wrap={{ base: "wrap", lg: "nowrap" }} 
              gap={{ base: 3, md: 4 }}
              direction={{ base: "column", lg: "row" }}
            >
              <HStack spacing={3}>
                <Heading 
                  size="md" 
                  color="gray.800"
                  mb={{ base: 2, lg: 0 }}
                  textAlign={{ base: "center", lg: "left" }}
                >
                  用户策略跟踪详情
                </Heading>
                {isLoadingFiltered && (
                  <Badge colorScheme="blue" variant="subtle" fontSize="xs">
                    智能过滤中...
                  </Badge>
                )}
                {filteredTrackingData.length > 0 && !isLoadingFiltered && (
                  <Badge colorScheme="green" variant="subtle" fontSize="xs">
                    已优化过滤
                  </Badge>
                )}
              </HStack>
              <Flex 
                align="center" 
                gap={{ base: 2, md: 3 }}
                wrap="wrap"
                justify={{ base: "center", lg: "flex-end" }}
                w={{ base: "full", lg: "auto" }}
              >
                <InputGroup 
                  maxW={{ base: "180px", md: "220px", lg: "280px" }}
                  minW={{ base: "150px", md: "180px" }}
                >
                  <InputLeftElement>
                    <Icon as={FiSearch as React.ComponentType} color="gray.400" />
                  </InputLeftElement>
                  <Input
                    placeholder="搜索策略ID..."
                    value={searchStrategyId}
                    onChange={(e) => setSearchStrategyId(e.target.value)}
                    bg="white"
                    border="2px solid"
                    borderColor="gray.200"
                    _hover={{ borderColor: "blue.300" }}
                    _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                    size={{ base: "sm", md: "md" }}
                  />
                </InputGroup>
                <Button
                  leftIcon={<Icon as={FiFilter as React.ComponentType} />}
                  colorScheme={showOnlyIncomplete ? "blue" : "gray"}
                  variant={showOnlyIncomplete ? "solid" : "outline"}
                  size={{ base: "sm", md: "md" }}
                  onClick={toggleShowMode}
                  minW={{ base: "120px", md: "140px" }}
                  boxShadow="md"
                  _hover={{
                    transform: "translateY(-1px)",
                    boxShadow: "lg"
                  }}
                  _active={{
                    transform: "translateY(0)",
                    boxShadow: "md"
                  }}
                  transition="all 0.2s ease-in-out"
                  flexShrink={0}
                >
                  {showOnlyIncomplete ? "显示全部" : "仅未完成"}
                </Button>
                <Button
                  leftIcon={<Icon as={FiCopy as React.ComponentType} />}
                  colorScheme="purple"
                  variant="outline"
                  size={{ base: "sm", md: "md" }}
                  onClick={copyUserUuids}
                  minW={{ base: "100px", md: "120px" }}
                  boxShadow="md"
                  _hover={{
                    bg: "purple.50",
                    transform: "translateY(-1px)",
                    boxShadow: "lg"
                  }}
                  _active={{
                    transform: "translateY(0)",
                    boxShadow: "md"
                  }}
                  transition="all 0.2s ease-in-out"
                  flexShrink={0}
                >
                  复制UUID
                </Button>
                <Button
                  leftIcon={<Icon as={FiAlertTriangle as React.ComponentType} />}
                  colorScheme="orange"
                  variant="solid"
                  size={{ base: "sm", md: "md" }}
                  onClick={checkDataInconsistency}
                  isLoading={isCheckingInconsistency}
                  loadingText="检查中"
                  minW={{ base: "100px", md: "120px" }}
                  boxShadow="md"
                  _hover={{
                    bg: "orange.600",
                    transform: "translateY(-1px)",
                    boxShadow: "lg"
                  }}
                  _active={{
                    transform: "translateY(0)",
                    boxShadow: "md"
                  }}
                  transition="all 0.2s ease-in-out"
                  flexShrink={0}
                >
                  数据检查
                </Button>
                <Select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  maxW={{ base: "100px", md: "120px" }}
                  minW={{ base: "90px", md: "100px" }}
                  bg="white"
                  border="2px solid"
                  borderColor="gray.200"
                  _hover={{ borderColor: "blue.300" }}
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                  size={{ base: "sm", md: "md" }}
                  flexShrink={0}
                >
                  <option value={5}>5条/页</option>
                  <option value={10}>10条/页</option>
                  <option value={20}>20条/页</option>
                  <option value={50}>50条/页</option>
                </Select>
              </Flex>
            </Flex>
            
            {filteredTracking.length === 0 ? (
              <Box textAlign="center" py={12}>
                <Box
                  p={6}
                  borderRadius="full"
                  bg="gray.50"
                  display="inline-block"
                  mb={4}
                  boxShadow="inset 0 2px 4px rgba(0, 0, 0, 0.05)"
                >
                  <Icon as={FiTarget as React.ComponentType} boxSize={12} color="gray.300" />
                </Box>
                <Text color="gray.500" fontSize="lg" fontWeight="medium">
                  暂无用户策略跟踪数据
                </Text>
                <Text color="gray.400" fontSize="sm" mt={1}>
                   今日的跟踪记录将在此显示
                 </Text>
              </Box>
            ) : (
              <>
                <Box 
                  overflowX="auto" 
                  borderRadius="lg" 
                  boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
                  bg="white"
                >
                  <Table variant="simple" size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200">用户名</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200" display={{ base: 'none', md: 'table-cell' }}>UUID</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200">策略</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200">状态</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200">操作</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200">进度</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200" display={{ base: 'none', lg: 'table-cell' }}>当前交易量</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200" display={{ base: 'none', lg: 'table-cell' }}>目标交易量</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200" display={{ base: 'none', lg: 'table-cell' }}>初始资金</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200" display={{ base: 'none', lg: 'table-cell' }}>USDT余额</Th>
                        <Th color="gray.700" fontWeight="semibold" borderColor="gray.200" display={{ base: 'none', lg: 'table-cell' }}>最后更新时间(UTC)</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {paginatedData.map((tracking, index) => {
                        const progress = calculateProgress(tracking);
                        const strategy = strategyMap.get(tracking.strategy_id);
                        const user = userMap.get(tracking.user_id);
                        const maxVolume = parseFloat(strategy?.max_total_volume_usdt || '0');
                        
                        return (
                          <Tr 
                            key={`${tracking.user_id}-${tracking.strategy_id}`}
                            _hover={{ 
                              bg: 'blue.50'
                            }}
                            transition="background-color 0.2s ease-in-out"
                            borderColor="gray.100"
                          >
                            <Td borderColor="gray.100">
                              <Text fontWeight="bold" fontSize="sm" color="gray.700">
                                {user?.nickname || 'N/A'}
                              </Text>
                            </Td>
                            <Td borderColor="gray.100" display={{ base: 'none', md: 'table-cell' }}>
                              <Text fontWeight="bold" fontSize="sm" color="gray.600" fontFamily="mono">
                                {user?.uuid || 'N/A'}
                              </Text>
                            </Td>
                            <Td borderColor="gray.100">
                              <Text fontWeight="bold" fontSize="sm" color="gray.700">
                                {tracking.strategy_id}
                              </Text>
                            </Td>
                            <Td borderColor="gray.100">
                              <Badge colorScheme={getStatusColor(tracking.status)} variant="subtle">
                                {tracking.status}
                              </Badge>
                            </Td>
                            <Td borderColor="gray.100">
                              <Button
                                size="xs"
                                colorScheme={tracking.status === 'active' ? 'orange' : 'green'}
                                variant="solid"
                                onClick={() => handleToggleStatus(tracking.user_id, tracking.strategy_id, tracking.status)}
                                isLoading={updatingStatus[`${tracking.user_id}-${tracking.strategy_id}`]}
                                loadingText={tracking.status === 'active' ? '暂停中' : '启动中'}
                                minW="60px"
                                fontSize="xs"
                                _hover={{
                                  transform: 'translateY(-1px)',
                                  boxShadow: 'md'
                                }}
                                _active={{
                                  transform: 'translateY(0)'
                                }}
                                transition="all 0.2s ease-in-out"
                                disabled={updatingStatus[`${tracking.user_id}-${tracking.strategy_id}`]}
                              >
                                {tracking.status === 'active' ? '暂停' : '启动'}
                              </Button>
                            </Td>
                            <Td borderColor="gray.100">
                              <VStack align="start" spacing={1}>
                                <Progress 
                                  value={progress} 
                                  size="sm" 
                                  colorScheme={getProgressColorScheme(tracking, progress)} 
                                  width="80px"
                                  borderRadius="full"
                                  bg="gray.100"
                                  sx={{
                                    '& > div': {
                                      backgroundColor: getProgressBackgroundColor(tracking, progress)
                                    }
                                  }}
                                />
                                <Text 
                                  fontSize="xs" 
                                  color={isDataStale(tracking) ? "red.500" : "gray.500"} 
                                  fontWeight="semibold"
                                >
                                  {progress.toFixed(1)}%
                                  {isDataStale(tracking) && <Icon as={MdWarning as any} color="orange.500" ml={1} />}
                                </Text>
                              </VStack>
                            </Td>
                            <Td borderColor="gray.100" display={{ base: 'none', lg: 'table-cell' }}>
                              <Text fontSize="sm" fontFamily="mono" color="gray.600" fontWeight="semibold">
                                {formatCurrency(parseFloat(tracking.achieved_trade_volume || '0'))}
                              </Text>
                            </Td>
                            <Td borderColor="gray.100" display={{ base: 'none', lg: 'table-cell' }}>
                              <Text fontSize="sm" fontFamily="mono" color="gray.600" fontWeight="semibold">
                                {formatCurrency(maxVolume)}
                              </Text>
                            </Td>
                            <Td borderColor="gray.100" display={{ base: 'none', lg: 'table-cell' }}>
                              <Text fontSize="sm" fontFamily="mono" color="gray.600" fontWeight="semibold">
                                {formatCurrency(parseFloat(tracking.initial_balance || '0'))}
                              </Text>
                            </Td>
                            <Td borderColor="gray.100" display={{ base: 'none', lg: 'table-cell' }}>
                              <Text fontSize="sm" fontFamily="mono" color="gray.600" fontWeight="semibold">
                                ${getUserUsdtBalance(tracking)}
                              </Text>
                            </Td>
                            <Td borderColor="gray.100" display={{ base: 'none', lg: 'table-cell' }}>
                              <Text fontSize="xs" color="gray.500">
                                {new Date(tracking.updated_at || tracking.created_at).toLocaleString('zh-CN', {
                                  timeZone: 'UTC'
                                })} UTC
                              </Text>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </Box>
                
                {/* 分页控件 */}
                {totalPages > 1 && (
                  <Flex justify="space-between" align="center" mt={4} px={2}>
                    <Text fontSize="sm" color="gray.600">
                      显示第 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredTracking.length)} 条，
                      共 {filteredTracking.length} 条记录
                    </Text>
                    <HStack spacing={2}>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Icon as={FiChevronLeft as React.ComponentType} />}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        isDisabled={currentPage === 1}
                        colorScheme="blue"
                      >
                        上一页
                      </Button>
                      <Text fontSize="sm" color="gray.600" px={3}>
                        第 {currentPage} / {totalPages} 页
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        rightIcon={<Icon as={FiChevronRight as React.ComponentType} />}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        isDisabled={currentPage === totalPages}
                        colorScheme="blue"
                      >
                        下一页
                      </Button>
                    </HStack>
                  </Flex>
                )}
                </>
              )}
          </VStack>
        </CardBody>
      </Card>

      {/* 数据不一致检测结果模态框 */}
      <Modal 
        isOpen={isInconsistencyModalOpen} 
        onClose={onInconsistencyModalClose} 
        size="xl"
        scrollBehavior="inside"
        motionPreset="slideInBottom"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Icon as={FiAlertTriangle as React.ComponentType} color="orange.500" />
              <Text>数据不一致检测结果</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {inconsistentData.length === 0 ? (
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>数据一致性良好！</AlertTitle>
                  <AlertDescription>
                    未发现活跃策略中用户缺少user_strategy_tracking表记录的问题。
                  </AlertDescription>
                </Box>
              </Alert>
            ) : (
              <VStack spacing={4} align="stretch">
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>发现数据不一致！</AlertTitle>
                    <AlertDescription>
                      发现 {inconsistentData.length} 个用户在活跃策略中缺少user_strategy_tracking表记录。
                    </AlertDescription>
                  </Box>
                </Alert>
                
                {inconsistentData.map((userStat, userIndex) => (
                  <Box key={userIndex} borderRadius="md" border="1px solid" borderColor="gray.200" p={4}>
                    <VStack spacing={3} align="stretch">
                      <Box bg="blue.50" p={3} borderRadius="md">
                        <Text fontWeight="bold" fontSize="md" color="blue.800">
                          用户信息
                        </Text>
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2} mt={2}>
                          <Text fontSize="sm"><strong>ID:</strong> {userStat.user.id}</Text>
                          <Text fontSize="sm"><strong>用户名:</strong> {userStat.user.username || 'N/A'}</Text>
                          <Text fontSize="sm"><strong>昵称:</strong> {userStat.user.nickname || 'N/A'}</Text>
                          <Text fontSize="sm"><strong>UUID:</strong> {userStat.user.uuid || 'N/A'}</Text>
                          <Text fontSize="sm"><strong>手机:</strong> {userStat.user.mobile || 'N/A'}</Text>
                          <Text fontSize="sm"><strong>邮箱:</strong> {userStat.user.email || 'N/A'}</Text>
                        </SimpleGrid>
                      </Box>
                      
                      <Box>
                        <Text fontWeight="bold" fontSize="md" color="red.600" mb={2}>
                          缺失的策略记录 ({userStat.missingStrategies.length} 个)
                        </Text>
                        <Box overflowX="auto" borderRadius="md" border="1px solid" borderColor="gray.200">
                          <Table variant="simple" size="sm">
                            <Thead bg="gray.50">
                              <Tr>
                                <Th>策略ID</Th>
                                <Th>策略名称</Th>
                                <Th>交易对</Th>
                                <Th>状态</Th>
                                <Th>开始时间</Th>
                                <Th>结束时间</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {userStat.missingStrategies.map((strategy: any, strategyIndex: number) => (
                                <Tr key={strategyIndex}>
                                  <Td>{strategy.strategyId}</Td>
                                  <Td>{strategy.strategyName || 'N/A'}</Td>
                                  <Td>{strategy.strategySymbol || 'N/A'}</Td>
                                  <Td>
                                    <Badge colorScheme={getStatusColor(strategy.strategyStatus)} variant="subtle">
                                      {strategy.strategyStatus}
                                    </Badge>
                                  </Td>
                                  <Td fontSize="xs">{new Date(strategy.startTime).toLocaleString('zh-CN')}</Td>
                                  <Td fontSize="xs">{new Date(strategy.endTime).toLocaleString('zh-CN')}</Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </Box>
                      </Box>
                    </VStack>
                  </Box>
                ))}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onInconsistencyModalClose}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default React.memo(UserStrategyTracking);