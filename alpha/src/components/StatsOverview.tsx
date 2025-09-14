import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  SimpleGrid,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Icon,
  Box,
  Flex,
  Text,
  VStack,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  NumberInput,
  NumberInputField,
  useDisclosure,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  HStack,
  ButtonGroup,
  Checkbox,
  Stack,
  Spinner
} from '@chakra-ui/react';
import { 
  FiUsers, 
  FiTarget
} from 'react-icons/fi';
import { 
  MdDashboard, 
  MdTrendingUp, 
  MdAttachMoney, 
  MdFlashOn, 
  MdRefresh, 
  MdClose, 
  MdCheck, 
  MdWarning, 
  MdList 
} from 'react-icons/md';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';

import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';

// 类型定义
interface Strategy {
  id: number;
  name: string;
  symbol: string;
  funding_type: string;
  funding_value: string;
  profit_margin_percent: string;
  stop_loss_percent: string;
  max_total_volume_usdt: string;
  start_time: string;
  end_time: string;
  status: string;
  avg_price?: string;
  speed?: string;
}

interface User {
  id: number;
  username: string;
  admin_id?: number;
  nickname?: string;
}

// 常量
const TOAST_CONFIG = {
  duration: 3000,
  isClosable: true,
};

const INITIAL_STRATEGY = {
  name: '',
  symbol: '',
  funding_type: 'PERCENTAGE_LOCAL_ASSET',
  funding_value: '',
  profit_margin_percent: '0.1', // 默认利润率0.1%
  stop_loss_percent: '0.1', // 默认止损率1%
  max_total_volume_usdt: '',
  start_time: new Date().toISOString().slice(0, 16), // 默认为当前UTC时间
  end_time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16), // 默认为24小时后的UTC时间
  status: 'active',
  avg_price: '',
  speed: '15' // 默认每次刷量时间60秒
};

// 工具函数

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC'
  }) + ' UTC';
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'active': return 'green';
    case 'paused': return 'yellow';
    default: return 'red';
  }
};

const getStatusText = (status: string): string => {
  switch (status) {
    case 'active': return '活跃';
    case 'paused': return '暂停';
    default: return '非活跃';
  }
};

// 自定义Hook：分页逻辑
const usePagination = (items: any[], itemsPerPage: number) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = items.slice(startIndex, endIndex);
  
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);
  
  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);
  
  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems,
    handlePageChange,
    resetPage
  };
};

// 优化的分页组件 - 支持移动端友好操作
const PaginationControls: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  startIndex: number;
  endIndex: number;
  totalItems: number;
}> = React.memo(({ currentPage, totalPages, onPageChange, startIndex, endIndex, totalItems }) => {
  // 移动端显示的页码范围
  const getVisiblePages = useMemo(() => {
    if (totalPages <= 1) return [];
    const delta = 1; // 移动端只显示当前页前后1页
    const range = [];
    const rangeWithDots = [];
    
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    
    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }
    
    rangeWithDots.push(...range);
    
    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }
    
    return rangeWithDots;
  }, [currentPage, totalPages]);
  
  return (
    <VStack spacing={3} mt={4}>
      {/* 统计信息 */}
      <Text 
        fontSize={{ base: "xs", md: "sm" }} 
        color="gray.600" 
        textAlign="center"
        fontWeight="medium"
      >
        显示第 {startIndex + 1}-{Math.min(endIndex, totalItems)} 条，共 {totalItems} 条
      </Text>
      
      {/* 分页控件 */}
      <Flex 
        justify="center" 
        align="center" 
        wrap="wrap" 
        gap={{ base: 1, md: 2 }}
        w="full"
      >
        {/* 上一页按钮 */}
        <IconButton
          aria-label="上一页"
          icon={<ChevronLeftIcon />}
          onClick={() => onPageChange(currentPage - 1)}
          isDisabled={currentPage === 1}
          size={{ base: "sm", md: "md" }}
          variant="outline"
          borderColor="gray.300"
          _hover={{ bg: "blue.50", borderColor: "blue.400" }}
          _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
          minW={{ base: "32px", md: "40px" }}
        />
        
        {/* 页码按钮 */}
        {getVisiblePages.map((page, index) => {
          if (page === '...') {
            return (
              <Button 
                key={`ellipsis-${index}`}
                size={{ base: "sm", md: "md" }}
                variant="ghost" 
                isDisabled
                minW={{ base: "32px", md: "40px" }}
                px={2}
              >
                ...
              </Button>
            );
          }
          
          const isActive = currentPage === page;
          return (
            <Button
              key={page}
              size={{ base: "sm", md: "md" }}
              onClick={() => onPageChange(page as number)}
              variant={isActive ? "solid" : "outline"}
              colorScheme={isActive ? "blue" : "gray"}
              borderColor={isActive ? "blue.500" : "gray.300"}
              bg={isActive ? "blue.500" : "white"}
              color={isActive ? "white" : "gray.700"}
              _hover={{ 
                bg: isActive ? "blue.600" : "blue.50", 
                borderColor: "blue.400",
                transform: "translateY(-1px)",
                boxShadow: "sm"
              }}
              _active={{
                transform: "translateY(0)",
                boxShadow: "none"
              }}
              transition="all 0.2s ease-in-out"
              minW={{ base: "32px", md: "40px" }}
              fontWeight={isActive ? "bold" : "medium"}
            >
              {page}
            </Button>
          );
        })}
        
        {/* 下一页按钮 */}
        <IconButton
          aria-label="下一页"
          icon={<ChevronRightIcon />}
          onClick={() => onPageChange(currentPage + 1)}
          isDisabled={currentPage === totalPages}
          size={{ base: "sm", md: "md" }}
          variant="outline"
          borderColor="gray.300"
          _hover={{ bg: "blue.50", borderColor: "blue.400" }}
          _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
          minW={{ base: "32px", md: "40px" }}
        />
      </Flex>
      
      {/* 移动端快速跳转 */}
      <Box display={{ base: "block", md: "none" }} w="full">
        <Flex justify="center" align="center" gap={2}>
          <Text fontSize="xs" color="gray.500">跳转到</Text>
          <Select
            size="xs"
            value={currentPage}
            onChange={(e) => onPageChange(parseInt(e.target.value))}
            w="60px"
            bg="white"
            borderColor="gray.300"
            _hover={{ borderColor: "blue.400" }}
            _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px blue.500" }}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <option key={page} value={page}>{page}</option>
            ))}
          </Select>
          <Text fontSize="xs" color="gray.500">页</Text>
        </Flex>
      </Box>
    </VStack>
  );
});

// 策略卡片组件
const StrategyCard: React.FC<{ strategy: Strategy }> = ({ strategy }) => {
  return (
    <Card 
      boxShadow="0 2px 4px rgba(0, 0, 0, 0.05)"
      border="none"
      bg="gray.50"
      _hover={{
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        transform: "translateY(-1px)",
        transition: "all 0.2s ease-in-out"
      }}
      transition="all 0.2s ease-in-out"
    >
      <CardBody>
        <Flex align="center" justify="space-between" mb={3}>
          <Flex align="center">
            <Text fontWeight="bold" color="gray.800">
              {strategy.name || `策略 ${strategy.id}`}
            </Text>
            <Badge ml={2} colorScheme="blue" variant="subtle">
              ID: {strategy.id}
            </Badge>
          </Flex>
          <Box
            px={2}
            py={1}
            borderRadius="md"
            bg="green.100"
            color="green.800"
            fontSize="xs"
            fontWeight="bold"
          >
            {strategy.status || 'ACTIVE'}
          </Box>
        </Flex>
        
        <StrategyInfo label="交易对" value={strategy.symbol || 'N/A'} />
        <StrategyInfo label="资金类型" value={strategy.funding_type || 'N/A'} />
        
        <SimpleGrid columns={{ base: 2, md: 5 }} spacing={{ base: 2, md: 3 }}>
          <StrategyMetric 
            label="单次交易量" 
            value={strategy.funding_value ? `${strategy.funding_value}%` : 'N/A'} 
          />
          <StrategyMetric 
            label="利润率" 
            value={strategy.profit_margin_percent ? `${strategy.profit_margin_percent}%` : 'N/A'}
            color="green.600"
          />
          <StrategyMetric 
            label="止损率" 
            value={strategy.stop_loss_percent ? `${strategy.stop_loss_percent}%` : 'N/A'}
            color="red.600"
          />
          <StrategyMetric 
            label="最大交易量" 
            value={strategy.max_total_volume_usdt ? `$${strategy.max_total_volume_usdt}` : 'N/A'}
          />
          <StrategyMetric 
            label="平均价格" 
            value={strategy.avg_price ? `$${strategy.avg_price}` : 'N/A'}
            color="blue.600"
          />
        </SimpleGrid>
        
        <Box 
          mt={3} 
          pt={3} 
          borderTop="1px" 
          borderColor="gray.200"
          boxShadow="inset 0 1px 0 rgba(0, 0, 0, 0.05)"
        >
          <Flex justify="space-between" fontSize={{ base: "2xs", md: "xs" }} color="gray.500" direction={{ base: "column", sm: "row" }} gap={{ base: 1, sm: 0 }}>
            <Text>开始: {strategy.start_time ? formatDateTime(strategy.start_time) : 'N/A'}</Text>
            <Text>结束: {strategy.end_time ? formatDateTime(strategy.end_time) : 'N/A'}</Text>
          </Flex>
        </Box>
      </CardBody>
    </Card>
  );
};

// 策略信息组件
const StrategyInfo: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box mb={3}>
    <Text fontSize="xs" color="gray.500" mb={1}>{label}</Text>
    <Text fontSize="sm" fontWeight="medium">{value}</Text>
  </Box>
);

// 策略指标组件
const StrategyMetric: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <Box>
    <Text fontSize="xs" color="gray.500" mb={1}>{label}</Text>
    <Text fontSize="sm" fontWeight="medium" color={color}>{value}</Text>
  </Box>
);

// 表单字段组件 - 简化版本
const FormField: React.FC<{
  label: string;
  isRequired?: boolean;
  type?: 'text' | 'number' | 'select' | 'datetime-local';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options?: { value: string; label: string }[];
  isDisabled?: boolean;
}> = React.memo(({ label, isRequired, type = 'text', value, onChange, placeholder, options, isDisabled }) => {
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);
  
  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);
  
  const handleNumberChange = useCallback((valueString: string) => {
    onChange(valueString);
  }, [onChange]);
  
  return (
    <FormControl isRequired={isRequired}>
      <FormLabel>{label}</FormLabel>
      {type === 'select' ? (
        <Select
          value={value}
          onChange={handleSelectChange}
          isDisabled={isDisabled}
        >
          {options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : type === 'number' ? (
        <NumberInput
          value={value}
          onChange={handleNumberChange}
        >
          <NumberInputField placeholder={placeholder} />
        </NumberInput>
      ) : (
        <Input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
        />
      )}
    </FormControl>
  );
});

// 用户选择项组件
const UserSelectItem: React.FC<{
  user: any;
  isSelected: boolean;
  onToggle: (userId: number) => void;
  isLast: boolean;
}> = React.memo(({ user, isSelected, onToggle, isLast }) => {
  const handleClick = useCallback(() => {
    onToggle(user.id);
  }, [onToggle, user.id]);
  return (
    <Box
      p={{ base: 3, md: 4 }}
      borderBottom={!isLast ? "1px" : "none"}
      borderColor="gray.100"
      cursor="pointer"
      bg={isSelected ? "blue.50" : "white"}
      borderLeft={isSelected ? "4px solid" : "4px solid transparent"}
      borderLeftColor={isSelected ? "blue.500" : "transparent"}
      _hover={{ 
        bg: isSelected ? "blue.100" : "gray.50",
        transform: "translateX(2px)"
      }}
      _active={{
        transform: "scale(0.98)"
      }}
      transition="all 0.2s ease"
      onClick={handleClick}
    >
      <Flex align="center" justify="space-between">
        <VStack align="start" spacing={{ base: 0.5, md: 1 }} flex={1}>
          <Text 
            fontSize={{ base: "sm", md: "md" }} 
            fontWeight="medium" 
            color={isSelected ? "blue.700" : "gray.800"}
            lineHeight="1.2"
          >
            UUID:{user.id} - {user.username}
          </Text>
          <Text 
            fontSize={{ base: "2xs", md: "xs" }} 
            color={isSelected ? "blue.600" : "gray.600"}
          >
            管理员ID: {user.admin_id || '无'}
          </Text>
          {user.nickname && (
            <Text 
              fontSize={{ base: "2xs", md: "xs" }} 
              color={isSelected ? "blue.500" : "gray.500"}
            >
              昵称: {user.nickname}
            </Text>
          )}
        </VStack>
        {isSelected && (
          <Box
            w={{ base: 5, md: 6 }}
            h={{ base: 5, md: 6 }}
            borderRadius="full"
            bg="blue.500"
            display="flex"
            alignItems="center"
            justifyContent="center"
            boxShadow="sm"
          >
            <Text color="white" fontSize={{ base: "2xs", md: "xs" }} fontWeight="bold">
              ✓
            </Text>
          </Box>
        )}
      </Flex>
    </Box>
  );
});

// 空状态组件
const EmptyState: React.FC<{ 
  icon: React.ElementType; 
  title: string; 
  description: string; 
}> = ({ icon, title, description }) => (
  <Box textAlign="center" py={8}>
    <Icon as={icon as any} boxSize={16} color="gray.400" mb={4} />
    <Text color="gray.500" fontSize="lg">{title}</Text>
    <Text color="gray.400" fontSize="sm">{description}</Text>
  </Box>
);



const StatsOverview: React.FC = () => {
  const { users, orders, userAssets, strategies, trades, recentEvents, isConnected, refreshData } = useDatabase();
  const { canManageStrategies } = useAuth();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isStrategiesOpen, onOpen: onStrategiesOpen, onClose: onStrategiesClose } = useDisclosure();
  const { isOpen: isUserSelectOpen, onOpen: onUserSelectOpen, onClose: onUserSelectClose } = useDisclosure();
  const { isOpen: isTradesOpen, onOpen: onTradesOpen, onClose: onTradesClose } = useDisclosure();
  const toast = useToast();
  
  // 状态管理 - 简化表单性能
  const [loading, setLoading] = useState(false);
  const [strategyStatuses, setStrategyStatuses] = useState<{[key: number]: string}>({});
  const [newStrategy, setNewStrategy] = useState(INITIAL_STRATEGY);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedUserNames, setSelectedUserNames] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 简化的输入处理函数，参考UserForm模式
  const handleInputChange = (field: keyof typeof INITIAL_STRATEGY, value: string) => {
    setNewStrategy(prev => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // 交易记录相关状态
  const [tradesData, setTradesData] = useState<any[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesFilter, setTradesFilter] = useState({
    userUuid: '',
    strategyId: '',
    page: 1,
    pageSize: 10
  });
  const [tradesTotal, setTradesTotal] = useState(0);
  
  // 分页Hook
  const strategiesPagination = usePagination(strategies, 10);
  const usersPagination = usePagination(
    users.filter(user => {
      if (!userSearchQuery) return true;
      return user.admin_id?.toString() === userSearchQuery;
    }),
    8
  );
  
  // 重置表单
  const resetForm = useCallback(() => {
    setNewStrategy(INITIAL_STRATEGY);
    setSelectedUsers([]);
    setSelectedUserNames([]);
    setUserSearchQuery('');
    usersPagination.resetPage();
  }, [usersPagination]);
  
  // 增强的用户搜索逻辑 - 支持多种搜索方式
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    
    const searchTerms = userSearchQuery.split(/[\n,]/).map(term => term.trim()).filter(term => term);
    
    if (searchTerms.length === 0) return users;
    
    return users.filter(user => {
      return searchTerms.some(term => {
        // 支持UUID搜索
        if (/^\d+$/.test(term) && String(user.id) === term) {
          return true;
        }
        // 支持admin_id搜索
        if (/^\d+$/.test(term) && user.admin_id && String(user.admin_id) === term) {
          return true;
        }
        // 支持用户名搜索（部分匹配，不区分大小写）
        if (user.username && user.username.toLowerCase().includes(term.toLowerCase())) {
          return true;
        }
        // 支持昵称搜索（部分匹配，不区分大小写）
        if (user.nickname && user.nickname.toLowerCase().includes(term.toLowerCase())) {
          return true;
        }
        return false;
      });
    });
  }, [users, userSearchQuery]);
  
  // 优化分页计算
  const filteredUsersPagination = usePagination(filteredUsers, 8);
  

  
  // 全选逻辑（优化性能）
  const handleSelectAll = useCallback((checked: boolean) => {
    const currentFilteredUserIds = filteredUsers.map(user => user.id);
    
    if (checked) {
      const newSelections = currentFilteredUserIds.filter(id => !selectedUsers.includes(id));
      setSelectedUsers(prev => [...prev, ...newSelections]);
    } else {
      setSelectedUsers(prev => prev.filter(id => !currentFilteredUserIds.includes(id)));
    }
  }, [filteredUsers, selectedUsers]);
  
  // 计算全选状态和当前页状态
  const { isAllSelected, isIndeterminate, currentPageUserIds, isCurrentPageAllSelected, currentPageToggleText } = useMemo(() => {
    const currentFilteredUserIds = filteredUsers.map(user => user.id);
    const selectedInCurrentFilter = currentFilteredUserIds.filter(id => selectedUsers.includes(id));
    
    const currentPageIds = filteredUsersPagination.paginatedItems.map(user => user.id);
    const selectedInCurrentPage = currentPageIds.filter(id => selectedUsers.includes(id));
    const isCurrentPageSelected = currentPageIds.length > 0 && selectedInCurrentPage.length === currentPageIds.length;
    
    return {
      isAllSelected: currentFilteredUserIds.length > 0 && selectedInCurrentFilter.length === currentFilteredUserIds.length,
      isIndeterminate: selectedInCurrentFilter.length > 0 && selectedInCurrentFilter.length < currentFilteredUserIds.length,
      currentPageUserIds: currentPageIds,
      isCurrentPageAllSelected: isCurrentPageSelected,
      currentPageToggleText: isCurrentPageSelected ? '取消当前页' : '选择当前页'
    };
  }, [filteredUsers, selectedUsers, filteredUsersPagination.paginatedItems]);
  
  // 确认用户选择
  const handleConfirmUserSelection = () => {
    const selectedUserData = users.filter(user => selectedUsers.includes(user.id));
    const userNames = selectedUserData.map(user => 
      `UUID:${user.id} - ${user.username} (管理员ID:${user.admin_id || '无'})${user.nickname ? ` - ${user.nickname}` : ''}`
    );
    setSelectedUserNames(userNames);
    onUserSelectClose();
  };
  
  // 清空用户选择
  const handleClearUserSelection = () => {
    setSelectedUsers([]);
    setSelectedUserNames([]);
  };

  // 表单验证
  const validateForm = useCallback(() => {
    const newErrors: { [key: string]: string } = {};

    if (!newStrategy.name) newErrors.name = '策略名称不能为空';
    if (!newStrategy.symbol) newErrors.symbol = '交易对不能为空';
    if (!newStrategy.funding_value) newErrors.funding_value = '资金数量不能为空';
    if (!newStrategy.profit_margin_percent) newErrors.profit_margin_percent = '利润率不能为空';
    if (!newStrategy.stop_loss_percent) newErrors.stop_loss_percent = '止损率不能为空';
    if (!newStrategy.max_total_volume_usdt) newErrors.max_total_volume_usdt = '最大交易量不能为空';
    if (!newStrategy.start_time) newErrors.start_time = '开始时间不能为空';
    if (!newStrategy.end_time) newErrors.end_time = '结束时间不能为空';
    
    if (selectedUsers.length === 0) {
      newErrors.users = '请至少选择一个用户';
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      toast({
        title: '表单验证失败',
        description: Object.values(newErrors)[0],
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }
    
    return true;
  }, [newStrategy, selectedUsers, toast, setErrors]);

  // 用户选择切换（优化性能）
  const handleUserToggle = useCallback((userId: number) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  }, []);
  
  // 当前页切换处理函数
  const handleToggleCurrentPage = useCallback(() => {
    if (isCurrentPageAllSelected) {
      // 取消当前页面全选
      setSelectedUsers(prev => prev.filter(id => !currentPageUserIds.includes(id)));
    } else {
      // 当前页面全选
      const newSelections = currentPageUserIds.filter(id => !selectedUsers.includes(id));
      setSelectedUsers(prev => [...prev, ...newSelections]);
    }
  }, [isCurrentPageAllSelected, currentPageUserIds, selectedUsers]);
  
  // 获取交易记录
  const fetchTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      const params = new URLSearchParams({
        page: tradesFilter.page.toString(),
        pageSize: tradesFilter.pageSize.toString(),
      });
      
      if (tradesFilter.userUuid) {
        params.append('userUuid', tradesFilter.userUuid);
      }
      
      if (tradesFilter.strategyId) {
        params.append('strategyId', tradesFilter.strategyId);
      }
      
      const response = await fetch(`/api/trades?${params}`);
      const result = await response.json();
      
      if (response.ok) {
        setTradesData(result.data || []);
        setTradesTotal(result.total || 0);
      } else {
        console.error('获取交易记录失败:', result.error);
        setTradesData([]);
        setTradesTotal(0);
      }
    } catch (error) {
      console.error('获取交易记录错误:', error);
      setTradesData([]);
      setTradesTotal(0);
    } finally {
      setTradesLoading(false);
    }
  }, [tradesFilter]);
  
  // 处理交易记录筛选
  const handleTradesFilter = useCallback((newFilter: Partial<typeof tradesFilter>) => {
    const updatedFilter = { ...tradesFilter, ...newFilter, page: 1 };
    setTradesFilter(updatedFilter);
  }, [tradesFilter]);
  
  // 处理交易记录分页
  const handleTradesPageChange = useCallback((page: number) => {
    const updatedFilter = { ...tradesFilter, page };
    setTradesFilter(updatedFilter);
  }, [tradesFilter]);
  
  // 当筛选条件改变时重新获取数据
  React.useEffect(() => {
    fetchTrades();
  }, [tradesFilter, fetchTrades]);
  
  // 打开交易记录弹窗时获取数据
  const handleOpenTrades = useCallback(() => {
    onTradesOpen();
    fetchTrades();
  }, [onTradesOpen, fetchTrades]);
  
  // 初始化策略状态 - 只在首次加载时初始化，避免覆盖用户修改的状态
  React.useEffect(() => {
    const initialStatuses: {[key: number]: string} = {};
    strategies.forEach(strategy => {
      // 只有当本地状态中不存在该策略时才初始化
      if (!(strategy.id in strategyStatuses)) {
        initialStatuses[strategy.id] = strategy.status;
      }
    });
    // 只有当有新策略需要初始化时才更新状态
    if (Object.keys(initialStatuses).length > 0) {
      setStrategyStatuses(prev => ({ ...prev, ...initialStatuses }));
    }
  }, [strategies, strategyStatuses]);
  
  // 处理策略状态更新
  const handleUpdateStrategyStatus = useCallback(async (strategyId: number, newStatus: string) => {
    try {
      // 立即更新本地状态
      setStrategyStatuses(prev => ({
        ...prev,
        [strategyId]: newStatus
      }));
      
      const response = await fetch('/api/strategies/update-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: strategyId,
          status: newStatus
        })
      });
      
      if (response.ok) {
        toast({
          title: '策略状态更新成功',
          status: 'success',
          ...TOAST_CONFIG,
        });
        // 重新加载数据
        await refreshData();
      } else {
        // 如果更新失败，恢复原状态
        const originalStrategy = strategies.find(s => s.id === strategyId);
        if (originalStrategy) {
          setStrategyStatuses(prev => ({
            ...prev,
            [strategyId]: originalStrategy.status
          }));
        }
        throw new Error('更新失败');
      }
    } catch (error) {
      toast({
        title: '更新策略状态失败',
        description: '请稍后重试',
        status: 'error',
        ...TOAST_CONFIG,
      });
    }
  }, [strategies, toast, refreshData]);
  
  // 处理表单提交
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // 调用API创建新策略
      const response = await fetch('/api/strategies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStrategy)
      });
      
      if (response.ok) {
        const createdStrategy = await response.json();
        
        // 创建用户策略绑定关系
        const userStrategyPromises = selectedUsers.map(userId => 
          fetch('/api/user-strategies', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
              strategy_id: createdStrategy.id
            })
          })
        );
        
        await Promise.all(userStrategyPromises);
        
        toast({
          title: '策略创建成功',
          description: `策略 "${newStrategy.name}" 已成功创建并绑定到 ${selectedUsers.length} 个用户`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // 不调用refreshData，避免触发页面重新渲染导致回到首页
        // await refreshData();
        
        resetForm();
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建策略失败');
      }
    } catch (error) {
      console.error('创建策略失败:', error);
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建策略时发生错误，请重试',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 计算统计数据
  const { totalStrategies, activeStrategies, activeStrategiesData } = useMemo(() => {
    const now = new Date();
    const activeData = strategies.filter(strategy => {
      const startTime = new Date(strategy.start_time);
      const endTime = new Date(strategy.end_time);
      return now >= startTime && now <= endTime && strategy.status === 'active';
    });
    
    return {
      totalStrategies: strategies.length,
      activeStrategies: activeData.length,
      activeStrategiesData: activeData
    };
  }, [strategies]);

  return (
    <Box>
      {/* 活跃策略概览 */}
      <Card 
        mb={{ base: 4, md: 6 }}
        boxShadow="0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
        border="none"
        bg="white"
      >
        <CardBody p={{ base: 4, md: 6 }}>
          <Flex 
            direction={{ base: "column", lg: "row" }} 
            align={{ base: "flex-start", lg: "center" }} 
            justify="space-between" 
            mb={{ base: 4, md: 6 }}
            gap={{ base: 3, lg: 0 }}
          >
            <Box>
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="gray.800">
                活跃策略概览
              </Text>
              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">
                当前生命周期内的策略详情
              </Text>
            </Box>
            <Flex 
              align="center" 
              gap={{ base: 2, md: 3 }}
              direction={{ base: "row", sm: "row" }}
              width={{ base: "full", lg: "auto" }}
              justify={{ base: "space-between", lg: "flex-end" }}
            >
              {canManageStrategies() && (
                <Button
                  colorScheme="blue"
                  size={{ base: "sm", md: "md" }}
                  onClick={onOpen}
                  flex={{ base: 1, lg: "none" }}
                  _hover={{
                    transform: "translateY(-1px)",
                    boxShadow: "lg"
                  }}
                >
                  新增策略
                </Button>
              )}
              <Box
                p={{ base: 2, md: 3 }}
                borderRadius="lg"
                bg="teal.50"
                display={{ base: "none", sm: "block" }}
              >
                <Icon 
                   as={FiTarget as any} 
                   boxSize={{ base: 5, md: 6 }} 
                   color="teal.500"
                 />
              </Box>
            </Flex>
          </Flex>
          
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 3, md: 6 }}>
            <Stat>
              <StatLabel color="gray.600" fontSize={{ base: "xs", md: "sm" }}>活跃策略数量</StatLabel>
              <StatNumber color="teal.600" fontSize={{ base: "lg", md: "2xl" }}>{activeStrategies}</StatNumber>
              <StatHelpText>
                <HStack spacing={{ base: 1, md: 2 }} align="center" flexWrap="wrap">
                  <Text fontSize={{ base: "xs", md: "sm" }}>总策略: {totalStrategies}</Text>
                  {canManageStrategies() && (
                    <Button
                      size={{ base: "2xs", md: "xs" }}
                      colorScheme="blue"
                      variant="outline"
                      onClick={onStrategiesOpen}
                      fontSize={{ base: "2xs", md: "xs" }}
                    >
                      查看全部
                    </Button>
                  )}
                </HStack>
              </StatHelpText>
            </Stat>
            <Stat>
              <StatLabel color="gray.600" fontSize={{ base: "xs", md: "sm" }}>交易记录</StatLabel>
              <StatNumber color="blue.600" fontSize={{ base: "lg", md: "2xl" }}>-</StatNumber>
              <StatHelpText>
                <Button
                   size={{ base: "2xs", md: "xs" }}
                   colorScheme="blue"
                   variant="outline"
                   onClick={handleOpenTrades}
                   fontSize={{ base: "2xs", md: "xs" }}
                 >
                   查看交易记录
                 </Button>
              </StatHelpText>
            </Stat>
            <Stat>
              <StatLabel color="gray.600" fontSize={{ base: "xs", md: "sm" }}>连接状态</StatLabel>
              <StatNumber color={isConnected ? "green.600" : "red.600"} fontSize={{ base: "lg", md: "2xl" }}>
                {isConnected ? "已连接" : "未连接"}
              </StatNumber>
              <StatHelpText fontSize={{ base: "xs", md: "sm" }}>数据库连接</StatHelpText>
            </Stat>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* 活跃策略详细列表 */}
      <Card
        boxShadow="0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
        border="none"
        bg="white"
      >
        <CardBody p={{ base: 4, md: 6 }}>
          <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color="gray.800" mb={{ base: 3, md: 4 }}>
            活跃策略详情
          </Text>
          
          {activeStrategiesData.length === 0 ? (
              <EmptyState 
                icon={MdDashboard as any} 
                title="暂无活跃策略" 
                description="当前没有在生命周期内的策略" 
              />
            ) : (
              <VStack spacing={4} align="stretch">
                {activeStrategiesData.map((strategy, index) => (
                  <StrategyCard key={strategy.id || index} strategy={strategy} />
                ))}
              </VStack>
            )}
        </CardBody>
      </Card>
      
      {/* 新增策略模态框 */}
      <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "xl" }}>
        <ModalOverlay />
        <ModalContent mx={{ base: 0, md: 4 }} my={{ base: 0, md: 16 }}>
          <ModalHeader fontSize={{ base: "lg", md: "xl" }} px={{ base: 4, md: 6 }}>
            新增交易策略
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody px={{ base: 4, md: 6 }} pb={{ base: 4, md: 6 }}>
            <VStack spacing={{ base: 4, md: 6 }}>
              <FormField
                label="策略名称"
                isRequired
                value={newStrategy.name}
                onChange={(value) => handleInputChange('name', value)}
                placeholder="请输入策略名称"
              />
              
              <FormField
                label="交易对"
                isRequired
                value={newStrategy.symbol}
                onChange={(value) => handleInputChange('symbol', value)}
                placeholder="例如: BTCUSDT"
              />
              
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 4, md: 4 }} w="full">
                <FormField
                  label="资金类型"
                  type="select"
                  value={newStrategy.funding_type}
                  onChange={(value) => handleInputChange('funding_type', value)}
                  options={[
                    { value: 'PERCENTAGE_LOCAL_ASSET', label: '本地资产百分比' }
                  ]}
                  isDisabled
                />
                
                <FormField
                  label="单次交易量 (%)"
                  isRequired
                  type="number"
                  value={newStrategy.funding_value}
                  onChange={(value) => handleInputChange('funding_value', value)}
                  placeholder="例如: 5"
                />
              </SimpleGrid>
              
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 4, md: 4 }} w="full">
                <FormField
                  label="利润率 (%)"
                  isRequired
                  type="number"
                  value={newStrategy.profit_margin_percent}
                  onChange={(value) => handleInputChange('profit_margin_percent', value)}
                  placeholder="例如: 0.1"
                />
                
                <FormField
                  label="止损率 (%)"
                  isRequired
                  type="number"
                  value={newStrategy.stop_loss_percent}
                  onChange={(value) => handleInputChange('stop_loss_percent', value)}
                  placeholder="例如: 1"
                />
              </SimpleGrid>
              
              <FormField
                label="最大交易量 (USDT)"
                isRequired
                type="number"
                value={newStrategy.max_total_volume_usdt}
                onChange={(value) => handleInputChange('max_total_volume_usdt', value)}
                placeholder="例如: 10000"
              />
              
              <FormField
                label="平均价格 (USDT)"
                type="number"
                value={newStrategy.avg_price}
                onChange={(value) => handleInputChange('avg_price', value)}
              />
              
              <FormField
                label="每次刷量时间 (秒)"
                type="number"
                value={newStrategy.speed}
                onChange={(value) => handleInputChange('speed', value)}
                placeholder="例如: 60"
              />
              
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 4, md: 4 }} w="full">
                <FormField
                  label="开始时间(UTC)"
                  isRequired
                  type="datetime-local"
                  value={newStrategy.start_time}
                  onChange={(value) => handleInputChange('start_time', value)}
                />
                
                <FormField
                  label="结束时间(UTC)"
                  isRequired
                  type="datetime-local"
                  value={newStrategy.end_time}
                  onChange={(value) => handleInputChange('end_time', value)}
                />
              </SimpleGrid>
              
              <FormField
                label="状态"
                type="select"
                value={newStrategy.status}
                onChange={(value) => handleInputChange('status', value)}
                options={[
                  { value: 'active', label: '活跃' },
                  { value: 'inactive', label: '非活跃' },
                  { value: 'paused', label: '暂停' }
                ]}
              />
              
              <FormControl isRequired>
                <FormLabel>绑定用户</FormLabel>
                <VStack spacing={3} align="stretch">
                  <Button
                    variant="outline"
                    onClick={onUserSelectOpen}
                    leftIcon={<Icon as={FiUsers as any} />}
                    size="md"
                  >
                    选择用户
                  </Button>
                  
                  {selectedUserNames.length > 0 && (
                    <Box
                      border="1px"
                      borderColor="gray.200"
                      borderRadius="md"
                      p={3}
                      bg="gray.50"
                    >
                      <Flex justify="space-between" align="center" mb={2}>
                        <Text fontSize="sm" fontWeight="medium" color="gray.700">
                          已选择用户 ({selectedUserNames.length})
                        </Text>
                        <Button
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={handleClearUserSelection}
                        >
                          清空
                        </Button>
                      </Flex>
                      <Box maxH="100px" overflowY="auto">
                        <Stack spacing={1}>
                          {selectedUserNames.map((userName, index) => (
                            <Text key={index} fontSize="sm" color="gray.600">
                              • {userName}
                            </Text>
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  )}
                  
                  {selectedUserNames.length === 0 && (
                    <Text fontSize="sm" color="gray.500" textAlign="center" py={2}>
                      请选择要绑定的用户
                    </Text>
                  )}
                </VStack>
              </FormControl>
            </VStack>
          </ModalBody>
          
          <ModalFooter px={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }}>
            <Flex 
              direction={{ base: "column", sm: "row" }} 
              gap={{ base: 3, sm: 0 }}
              width="full"
              justify={{ base: "stretch", sm: "flex-end" }}
            >
              <Button 
                variant="ghost" 
                mr={{ base: 0, sm: 3 }} 
                onClick={() => { resetForm(); onClose(); }}
                width={{ base: "full", sm: "auto" }}
                order={{ base: 2, sm: 1 }}
              >
                取消
              </Button>
              <Button 
                colorScheme="blue" 
                onClick={handleSubmit}
                width={{ base: "full", sm: "auto" }}
                order={{ base: 1, sm: 2 }}
              >
                创建策略
              </Button>
            </Flex>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* 查看所有策略模态框 - 仅管理员可见 */}
      {canManageStrategies() && (
        <Modal isOpen={isStrategiesOpen} onClose={onStrategiesClose} size={{ base: "full", lg: "6xl" }}>
        <ModalOverlay />
        <ModalContent maxH={{ base: "100vh", lg: "90vh" }} mx={{ base: 0, lg: 4 }} my={{ base: 0, lg: 8 }}>
          <ModalHeader px={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }}>
            <Flex 
              direction={{ base: "column", sm: "row" }} 
              justify="space-between" 
              align={{ base: "flex-start", sm: "center" }}
              gap={{ base: 2, sm: 0 }}
            >
              <Text fontSize={{ base: "lg", md: "xl" }}>所有策略管理</Text>
              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.500">
                共 {strategies.length} 条策略
              </Text>
            </Flex>
          </ModalHeader>
     
          <ModalBody overflowY="auto" px={{ base: 4, md: 6 }} pb={{ base: 4, md: 6 }}>
            <VStack spacing={{ base: 4, md: 6 }} align="stretch">
              {/* 策略表格 */}
              <Box 
                overflowX="auto" 
                bg="white" 
                borderRadius="lg" 
                border="1px" 
                borderColor="gray.200"
                sx={{
                  '&::-webkit-scrollbar': {
                    height: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    bg: 'gray.100',
                    borderRadius: 'full',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    bg: 'gray.300',
                    borderRadius: 'full',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    bg: 'gray.400',
                  },
                }}
              >
                <Table variant="simple" size="sm">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th fontSize="xs" color="gray.600">ID</Th>
                      <Th fontSize="xs" color="gray.600">策略名称</Th>
                      <Th fontSize="xs" color="gray.600">状态</Th>
                      <Th fontSize="xs" color="gray.600">单次交易量(%)</Th>
                      <Th fontSize="xs" color="gray.600">最大交易量(USDT)</Th>
                      <Th fontSize="xs" color="gray.600">平均价格(USDT)</Th>
                      <Th fontSize="xs" color="gray.600">开始时间</Th>
                      <Th fontSize="xs" color="gray.600">结束时间</Th>
                      <Th fontSize="xs" color="gray.600">操作</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {strategiesPagination.paginatedItems.map((strategy, index) => (
                      <Tr key={strategy.id} _hover={{ bg: "gray.50" }}>
                        <Td fontSize="sm" fontWeight="medium">{strategy.id}</Td>
                        <Td fontSize="sm" fontWeight="medium" maxW="200px" isTruncated>
                          {strategy.name || `策略 ${strategy.id}`}
                        </Td>
                        <Td>
                          <Badge
                            size="sm"
                            colorScheme={getStatusColor(strategyStatuses[strategy.id] || strategy.status)}
                            borderRadius="full"
                            px={2}
                            py={1}
                          >
                            {getStatusText(strategyStatuses[strategy.id] || strategy.status)}
                          </Badge>
                        </Td>
                        <Td fontSize="sm">
                          <Text fontWeight="medium" color="blue.600">
                            {strategy.funding_value}%
                          </Text>
                        </Td>
                        <Td fontSize="sm">
                          <Text fontWeight="medium" color="green.600">
                            ${strategy.max_total_volume_usdt}
                          </Text>
                        </Td>
                        <Td fontSize="sm">
                          <Text fontWeight="medium" color="purple.600">
                            {strategy.avg_price ? `$${strategy.avg_price}` : '-'}
                          </Text>
                        </Td>
                        <Td fontSize="xs" color="gray.600">
                          {formatDateTime(strategy.start_time)}
                        </Td>
                        <Td fontSize="xs" color="gray.600">
                          {formatDateTime(strategy.end_time)}
                        </Td>
                        <Td>
                          <Select
                            size="sm"
                            value={strategyStatuses[strategy.id] || strategy.status}
                            onChange={(e) => handleUpdateStrategyStatus(strategy.id, e.target.value)}
                            width="100px"
                            fontSize="xs"
                            borderRadius="md"
                            _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px blue.400" }}
                          >
                            <option value="active">活跃</option>
                            <option value="paused">暂停</option>
                            <option value="inactive">非活跃</option>
                          </Select>
                        </Td>
                      </Tr>
                    ))}
                   </Tbody>
                 </Table>
                {strategies.length === 0 && (
                  <EmptyState 
                    icon={MdDashboard as any} 
                    title="暂无策略数据" 
                    description="请先创建一些策略" 
                  />
                )}
              </Box>
              
              {/* 分页控件 */}
              <PaginationControls
                currentPage={strategiesPagination.currentPage}
                totalPages={strategiesPagination.totalPages}
                onPageChange={strategiesPagination.handlePageChange}
                startIndex={strategiesPagination.startIndex}
                endIndex={strategiesPagination.endIndex}
                totalItems={strategies.length}
              />
            </VStack>
          </ModalBody>
          
          <ModalFooter borderTop="1px" borderColor="gray.200">
            <Button onClick={onStrategiesClose} colorScheme="gray" variant="outline">
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      )}
      
      {/* 用户选择弹出框 - 优化性能和移动端显示 */}
      <Modal 
        isOpen={isUserSelectOpen} 
        onClose={onUserSelectClose} 
        size={{ base: "full", md: "xl" }}
        scrollBehavior="inside"
        motionPreset="slideInBottom"
      >
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />

        <ModalContent 
          bg="white" 
          borderRadius={{ base: "none", md: "xl" }} 
          boxShadow="xl"
          mx={{ base: 0, md: 4 }}
          my={{ base: 0, md: 4 }}
          display="flex"
          flexDirection="column"
        >
          
          <ModalBody 
             p={{ base: 4, md: 6 }} 
            flex="1"
            minH="0"
            overflowY="auto"
            onWheel={(e) => {
              console.log('Wheel event on ModalBody', e);
              e.currentTarget.scrollTop += e.deltaY; // 手动控制滚动
            }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              e.currentTarget.dataset.touchStartY = touch.clientY.toString();
            }}
            onTouchMove={(e) => {
              e.preventDefault(); // 防止页面滚动
              const touch = e.touches[0];
              const startY = parseFloat(e.currentTarget.dataset.touchStartY || '0');
              const deltaY = startY - touch.clientY;
              e.currentTarget.scrollTop += deltaY;
              e.currentTarget.dataset.touchStartY = touch.clientY.toString();
            }}
            onTouchEnd={(e) => {
              delete e.currentTarget.dataset.touchStartY;
            }}
          >
            <VStack spacing={{ base: 4, md: 6 }} align="stretch">
              {/* 搜索框和全选 */}
              <VStack spacing={{ base: 3, md: 4 }} align="stretch">
                <FormControl>
                  <FormLabel fontSize={{ base: "sm", md: "md" }} color="gray.700">
                    搜索用户 (支持UUID、用户名、管理员ID、昵称，多个用换行或逗号分隔)
                  </FormLabel>
                  <Input
                    as="textarea"
                    placeholder="支持多种搜索方式，例如：\nUUID: 1112688940\n用户名: alice\n管理员ID: 123\n昵称: 小明"
                    value={userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      filteredUsersPagination.resetPage(); // 重置到第一页
                    }}
                    size={{ base: "md", md: "lg" }}
                    bg="white"
                    borderColor="gray.300"
                    _hover={{ borderColor: "blue.400" }}
                    _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px blue.500" }}
                    fontSize={{ base: "sm", md: "md" }}
                    minH="80px"
                    resize="vertical"

                  />
                </FormControl>
                
                {/* 全选控制 */}
                <Box 
                  p={{ base: 3, md: 4 }} 
                  bg="gray.50" 
                  borderRadius="lg" 
                  border="1px" 
                  borderColor="gray.200"
                >
                  <VStack spacing={3} align="stretch">
                    <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                      <HStack spacing={{ base: 2, md: 4 }} wrap="wrap">
                        <Checkbox
                          isChecked={isAllSelected}
                          isIndeterminate={isIndeterminate}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          size={{ base: "sm", md: "md" }}
                          colorScheme="blue"
                        >
                          <Text fontSize={{ base: "xs", md: "sm" }}>全选当前筛选结果</Text>
                        </Checkbox>
                      <Button
                          size={{ base: "xs", md: "sm" }}
                          variant="outline"
                          colorScheme="blue"
                          onClick={handleToggleCurrentPage}
                          _hover={{ bg: "blue.50", borderColor: "blue.400" }}
                        >
                          <Text fontSize={{ base: "2xs", md: "xs" }}>
                            {currentPageToggleText}
                          </Text>
                        </Button>
                      </HStack>
                      <Text fontSize={{ base: "2xs", md: "sm" }} color="gray.500" textAlign={{ base: "center", md: "right" }}>
                        已选择 {selectedUsers.length} 个用户 (当前筛选: {filteredUsers.length})
                      </Text>
                    </Flex>
                  </VStack>
                </Box>
              </VStack>
              
              {/* 用户列表 */}
              <Box
                border="1px"
                borderColor="gray.200"
                borderRadius="md"
                bg="white"
              >
                {filteredUsersPagination.paginatedItems.length > 0 ? (
                  <Stack spacing={0}>
                    {filteredUsersPagination.paginatedItems.map((user, index) => (
                      <UserSelectItem
                        key={user.id}
                        user={user}
                        isSelected={selectedUsers.includes(user.id)}
                        onToggle={handleUserToggle}
                        isLast={index === filteredUsersPagination.paginatedItems.length - 1}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Box p={{ base: 6, md: 8 }} textAlign="center">
                    <Icon as={FiUsers as any} boxSize={{ base: 12, md: 16 }} color="gray.400" mb={4} />
                    <Text color="gray.500" fontSize={{ base: "md", md: "lg" }} mb={2}>
                      {userSearchQuery ? '未找到匹配的UUID用户' : '暂无用户数据'}
                    </Text>
                    <Text color="gray.400" fontSize={{ base: "sm", md: "md" }}>
                      {userSearchQuery ? '请检查UUID是否正确' : '请先添加用户'}
                    </Text>
                  </Box>
                )}
              </Box>
              
              {/* 分页控件 */}
              <PaginationControls
                currentPage={filteredUsersPagination.currentPage}
                totalPages={filteredUsersPagination.totalPages}
                onPageChange={filteredUsersPagination.handlePageChange}
                startIndex={filteredUsersPagination.startIndex}
                endIndex={filteredUsersPagination.endIndex}
                totalItems={filteredUsers.length}
              />
            </VStack>
          </ModalBody>
          
          <ModalFooter flexShrink={0}>
            <Button variant="ghost" mr={3} onClick={onUserSelectClose}>
              取消
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleConfirmUserSelection}
              isDisabled={selectedUsers.length === 0}
            >
              确认选择 ({selectedUsers.length})
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 交易记录弹窗 */}
      <Modal isOpen={isTradesOpen} onClose={onTradesClose} size={{ base: "full", md: "6xl" }}>
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent 
          bg="white" 
          borderRadius={{ base: "none", md: "xl" }} 
          boxShadow="xl"
          mx={{ base: 0, md: 4 }}
          my={{ base: 0, md: 4 }}
          maxH={{ base: "100vh", md: "90vh" }}
        >
          <ModalHeader 
            bg="gradient(linear, to-r, blue.500, purple.600)" 
            color="white" 
            borderTopRadius={{ base: "none", md: "xl" }}
            py={{ base: 4, md: 6 }}
            px={{ base: 4, md: 6 }}
            fontSize={{ base: "lg", md: "xl" }}
          >
            <Flex align="center" gap={2}>
              <Icon as={MdList as any} />
              交易记录
            </Flex>
          </ModalHeader>
          <ModalCloseButton color="white" size="lg" />
          <ModalBody p={{ base: 4, md: 6 }} overflowY="auto">
            {/* 筛选条件 */}
            <Box 
              mb={{ base: 4, md: 6 }} 
              p={{ base: 3, md: 4 }} 
              bg="gray.50" 
              borderRadius="lg" 
              border="1px" 
              borderColor="gray.200"
            >
              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="semibold" color="gray.600" mb={3}>
                🔍 筛选条件
              </Text>
              <Stack spacing={{ base: 3, md: 4 }} direction={{ base: "column", md: "row" }} flexWrap="wrap">
                <FormControl maxW="200px">
                  <FormLabel fontSize="sm" color="gray.600">用户ID</FormLabel>
                  <Input
                    size="sm"
                    placeholder="输入用户ID"
                    value={tradesFilter.userUuid}
                    onChange={(e) => handleTradesFilter({ userUuid: e.target.value })}
                    bg="white"
                    borderColor="gray.300"
                    _hover={{ borderColor: "blue.400" }}
                    _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px blue.500" }}
                  />
                </FormControl>
                <FormControl maxW="200px">
                  <FormLabel fontSize="sm" color="gray.600">策略ID</FormLabel>
                  <Input
                    size="sm"
                    placeholder="输入策略ID"
                    value={tradesFilter.strategyId}
                    onChange={(e) => handleTradesFilter({ strategyId: e.target.value })}
                    bg="white"
                    borderColor="gray.300"
                    _hover={{ borderColor: "blue.400" }}
                    _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px blue.500" }}
                  />
                </FormControl>
                <FormControl maxW="120px">
                  <FormLabel fontSize="sm" color="gray.600">每页条数</FormLabel>
                  <Select
                    size="sm"
                    value={tradesFilter.pageSize}
                    onChange={(e) => handleTradesFilter({ pageSize: parseInt(e.target.value) })}
                    bg="white"
                    borderColor="gray.300"
                    _hover={{ borderColor: "blue.400" }}
                    _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px blue.500" }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            {/* 交易记录表格 */}
            {tradesLoading ? (
              <Box textAlign="center" py={12}>
                <VStack spacing={3}>
                  <Spinner size="lg" color="blue.500" thickness="4px" />
                  <Text color="gray.500" fontSize="sm">加载中...</Text>
                </VStack>
              </Box>
            ) : tradesData.length > 0 ? (
              <>
                <Box 
                  borderRadius="lg" 
                  overflow="auto" 
                  border="1px" 
                  borderColor="gray.200"
                  bg="white"
                  sx={{
                    '&::-webkit-scrollbar': {
                      height: '8px',
                      background: '#f1f1f1',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: '#c1c1c1',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                      background: '#a8a8a8',
                    },
                  }}
                >
                  <Table variant="simple" size={{ base: "xs", md: "sm" }} minW="800px">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th color="gray.700" fontWeight="semibold" fontSize={{ base: "2xs", md: "xs" }} py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>交易ID</Th>
                        <Th color="gray.700" fontWeight="semibold" fontSize={{ base: "2xs", md: "xs" }} py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>用户ID</Th>
                        <Th color="gray.700" fontWeight="semibold" fontSize={{ base: "2xs", md: "xs" }} py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>策略ID</Th>
                        <Th color="gray.700" fontWeight="semibold" fontSize={{ base: "2xs", md: "xs" }} py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>买入价格</Th>
                        <Th color="gray.700" fontWeight="semibold" fontSize={{ base: "2xs", md: "xs" }} py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>买入数量</Th>
                        <Th color="gray.700" fontWeight="semibold" fontSize={{ base: "2xs", md: "xs" }} py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>卖出价格</Th>
                        <Th color="gray.700" fontWeight="semibold" fontSize={{ base: "2xs", md: "xs" }} py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>卖出数量</Th>
                        <Th color="gray.700" fontWeight="semibold" fontSize={{ base: "2xs", md: "xs" }} py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }}>创建时间</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {tradesData.map((trade: any, index: number) => {
                        console.log('Trade data:', trade);
                        return (
                        <Tr 
                          key={trade.id} 
                          bg={index % 2 === 0 ? "white" : "gray.25"}
                          _hover={{ bg: "blue.50" }}
                          transition="background-color 0.2s"
                        >
                          <Td py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }} fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="blue.600">#{trade.id}</Td>
                          <Td py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }} fontSize={{ base: "xs", md: "sm" }} color="gray.700">{trade.user_id}</Td>
                          <Td py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }} fontSize={{ base: "xs", md: "sm" }} color="gray.700">{trade.strategy_id}</Td>
                          <Td py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }} fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color={trade.buy_price ? "green.600" : "gray.400"}>
                            {trade.buy_price ? `$${Number(trade.buy_price).toFixed(4)}` : '-'}
                          </Td>
                          <Td py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }} fontSize={{ base: "xs", md: "sm" }} color="gray.700">
                            {trade.buy_quantity ? Number(trade.buy_quantity).toFixed(4) : '-'}
                          </Td>
                          <Td py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }} fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color={trade.sell_price ? "red.600" : "gray.400"}>
                            {trade.sell_price ? `$${Number(trade.sell_price).toFixed(4)}` : '-'}
                          </Td>
                          <Td py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }} fontSize={{ base: "xs", md: "sm" }} color="gray.700">
                            {trade.sell_quantity ? Number(trade.sell_quantity).toFixed(4) : '-'}
                          </Td>
                          <Td py={{ base: 2, md: 4 }} px={{ base: 2, md: 4 }} fontSize={{ base: "2xs", md: "xs" }} color="gray.500">{formatDateTime(trade.created_at)}</Td>
                        </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </Box>

                {/* 分页控件 */}
                <Box 
                  mt={{ base: 4, md: 6 }} 
                  p={{ base: 3, md: 4 }} 
                  bg="gray.50" 
                  borderRadius="lg" 
                  border="1px" 
                  borderColor="gray.200"
                >
                  <VStack spacing={{ base: 3, md: 4 }}>
                    <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600" fontWeight="medium" textAlign="center">
                      显示第 {(tradesFilter.page - 1) * tradesFilter.pageSize + 1} - {Math.min(tradesFilter.page * tradesFilter.pageSize, tradesTotal)} 条，共 {tradesTotal} 条记录
                    </Text>
                    
                    {/* 移动端友好的分页控件 */}
                    <Flex 
                      justify="center" 
                      align="center" 
                      direction={{ base: "column", md: "row" }}
                      gap={{ base: 3, md: 4 }}
                      w="full"
                    >
                      {/* 页码导航 */}
                      <ButtonGroup size={{ base: "sm", md: "md" }} spacing={2} variant="outline">
                        <IconButton
                          aria-label="上一页"
                          icon={<ChevronLeftIcon />}
                          isDisabled={tradesFilter.page === 1}
                          onClick={() => handleTradesPageChange(tradesFilter.page - 1)}
                          borderColor="gray.300"
                          _hover={{ bg: "blue.50", borderColor: "blue.400" }}
                          _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
                          size={{ base: "sm", md: "md" }}
                        />
                        
                        {/* 当前页码显示 */}
                        <Button 
                          variant="solid" 
                          bg="blue.500" 
                          color="white"
                          _hover={{ bg: "blue.600" }}
                          minW={{ base: "100px", md: "120px" }}
                          size={{ base: "sm", md: "md" }}
                          fontSize={{ base: "sm", md: "md" }}
                        >
                          {tradesFilter.page} / {Math.ceil(tradesTotal / tradesFilter.pageSize)}
                        </Button>
                        
                        <IconButton
                          aria-label="下一页"
                          icon={<ChevronRightIcon />}
                          isDisabled={tradesFilter.page >= Math.ceil(tradesTotal / tradesFilter.pageSize)}
                          onClick={() => handleTradesPageChange(tradesFilter.page + 1)}
                          borderColor="gray.300"
                          _hover={{ bg: "blue.50", borderColor: "blue.400" }}
                          _disabled={{ opacity: 0.4, cursor: "not-allowed" }}
                          size={{ base: "sm", md: "md" }}
                        />
                      </ButtonGroup>
                      
                      移动端快速跳转
                      <Box display={{ base: "block", md: "none" }} w="full" maxW="200px">
                        <FormControl>
                          <FormLabel fontSize="xs" color="gray.600" mb={1}>快速跳转到页</FormLabel>
                          <Select
                            size="sm"
                            value={tradesFilter.page}
                            onChange={(e) => handleTradesPageChange(Number(e.target.value))}
                            bg="white"
                            borderColor="gray.300"
                            _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #3182ce" }}
                          >
                            {Array.from({ length: Math.ceil(tradesTotal / tradesFilter.pageSize) }, (_, i) => (
                              <option key={i + 1} value={i + 1}>
                                第 {i + 1} 页
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    </Flex>
                  </VStack>
                </Box>
              </>
            ) : (
              <Box 
                textAlign="center" 
                py={16}
                bg="gray.50"
                borderRadius="lg"
                border="2px dashed"
                borderColor="gray.300"
              >
                <VStack spacing={4}>
                  <Icon as={MdDashboard as any} boxSize={16} color="gray.400" />
                  <VStack spacing={2}>
                    <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                      暂无交易记录
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      当前筛选条件下没有找到交易记录
                    </Text>
                  </VStack>
                </VStack>
              </Box>
            )}
          </ModalBody>
          <ModalFooter 
            bg="gray.50" 
            borderBottomRadius={{ base: "none", md: "xl" }} 
            py={{ base: 3, md: 4 }}
            px={{ base: 4, md: 6 }}
          >
            <Button 
              onClick={onTradesClose}
              colorScheme="gray"
              variant="solid"
              size={{ base: "sm", md: "md" }}
              px={{ base: 6, md: 8 }}
              w={{ base: "full", md: "auto" }}
              _hover={{ bg: "gray.600" }}
            >
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default React.memo(StatsOverview);