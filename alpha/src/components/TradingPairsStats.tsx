import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Flex,
  SimpleGrid,
  useBreakpointValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Spinner,
  Alert,
  AlertIcon,
  Button,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Input,
  InputGroup,
  InputLeftElement,
  IconButton,
  Select,
  Divider,
  useToast
} from '@chakra-ui/react';
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon } from '@chakra-ui/icons';

interface TradingPair {
  symbol: string;
  strategyCount: number;
  userCount: number;
  totalVolume: string;
}

interface UserStat {
  id: number;
  userId: number;
  nickname: string;
  uuid: string;
  totalAchievedTradeVolume: string;
  todayAchievedTradeVolume: string;
  strategyCount: number;
}

interface TotalStats {
  totalUsers: number;
  totalVolume: string;
  totalStrategies: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface TradingPairDetails {
  symbol: string;
  userStats: UserStat[];
  totalStats: TotalStats;
  pagination: PaginationInfo;
  search: string;
  timestamp: string;
}

// 优化的表格行组件 - 使用React.memo避免不必要的重新渲染
const UserTableRow = React.memo(({ user, formatNumber, onCopyUserId }: { 
  user: UserStat; 
  formatNumber: (value: string | number) => string;
  onCopyUserId: (userId: number) => void;
}) => (
  <Tr>
    <Td py={3}>
      <HStack spacing={2}>
        <Text fontWeight="medium" color="gray.600" fontSize="sm">
          {user.id}
        </Text>
        <IconButton
          aria-label="复制用户ID"
          icon={<CopyIcon />}
          size="xs"
          variant="ghost"
          colorScheme="blue"
          onClick={() => onCopyUserId(user.userId)}
          _hover={{ bg: "blue.50" }}
        />
      </HStack>
    </Td>
    <Td py={3}>
      <Text fontWeight="medium" color="gray.800">
        {user.nickname}
      </Text>
    </Td>
    <Td py={3}>
      <Text color="gray.600" fontSize="sm">
        {user.uuid}
      </Text>
    </Td>
    <Td py={3}>
      <Badge colorScheme="purple" variant="subtle" fontSize="sm">
        {user.strategyCount} 个策略
      </Badge>
    </Td>
    <Td py={3} isNumeric>
      <Text fontWeight="bold" color="blue.600" fontSize="md">
        {parseFloat(user.todayAchievedTradeVolume).toFixed(2)}
      </Text>
    </Td>
    <Td py={3} isNumeric>
      <Text fontWeight="bold" color="orange.600" fontSize="md">
        {formatNumber(user.totalAchievedTradeVolume)}
      </Text>
    </Td>
  </Tr>
));

UserTableRow.displayName = 'UserTableRow';

const TradingPairsStats: React.FC = () => {
  const [tradingPairs, setTradingPairs] = useState<TradingPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<TradingPairDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const toast = useToast();
  
  // 分页和搜索状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // 获取所有交易对信息
  const fetchTradingPairs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/trading-pairs');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setTradingPairs(data.tradingPairs || []);
    } catch (error) {
      console.error('获取交易对信息失败:', error);
      setError('获取交易对信息失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 获取指定交易对的用户统计信息
  const fetchTradingPairDetails = useCallback(async (symbol: string, page = currentPage, limit = pageSize, search = searchTerm) => {
    try {
      setIsLoadingDetails(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search })
      });
      
      const response = await fetch(`/api/trading-pairs/${encodeURIComponent(symbol)}/users?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSelectedPair(data);
      if (!isOpen) {
        onOpen();
      }
    } catch (error) {
      console.error('获取交易对详情失败:', error);
      setError('获取交易对详情失败，请稍后重试');
    } finally {
      setIsLoadingDetails(false);
    }
  }, [currentPage, pageSize, searchTerm, isOpen, onOpen]);
  
  // 处理搜索
  const handleSearch = useCallback(() => {
    setSearchTerm(searchInput);
    setCurrentPage(1); // 搜索时重置到第一页
    if (selectedPair) {
      fetchTradingPairDetails(selectedPair.symbol, 1, pageSize, searchInput);
    }
  }, [searchInput, pageSize, selectedPair, fetchTradingPairDetails]);
  
  // 处理分页
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    if (selectedPair) {
      fetchTradingPairDetails(selectedPair.symbol, newPage, pageSize, searchTerm);
    }
  }, [selectedPair, pageSize, searchTerm, fetchTradingPairDetails]);
  
  // 处理页面大小变化
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 改变页面大小时重置到第一页
    if (selectedPair) {
      fetchTradingPairDetails(selectedPair.symbol, 1, newPageSize, searchTerm);
    }
  }, [selectedPair, searchTerm, fetchTradingPairDetails]);
  
  // 重置搜索和分页状态
  const resetSearchAndPagination = useCallback(() => {
    setCurrentPage(1);
    setSearchTerm('');
    setSearchInput('');
  }, []);

  // 处理交易对卡片点击
  const handlePairClick = useCallback((symbol: string) => {
    resetSearchAndPagination();
    fetchTradingPairDetails(symbol, 1, pageSize, '');
  }, [fetchTradingPairDetails, resetSearchAndPagination, pageSize]);

  // 处理复制用户ID
  const handleCopyUserId = useCallback(async (userId: number) => {
    try {
      await navigator.clipboard.writeText(userId.toString());
      toast({
        title: '复制成功',
        description: `用户ID ${userId} 已复制到剪贴板`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法复制到剪贴板，请手动复制',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast]);

  // 处理批量复制所有用户ID
  const handleCopyAllUserIds = useCallback(async () => {
    if (!selectedPair || selectedPair.userStats.length === 0) {
      toast({
        title: '复制失败',
        description: '当前页面没有用户数据',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    try {
      const userIds = selectedPair.userStats.map(user => user.userId).join('\n');
      await navigator.clipboard.writeText(userIds);
      toast({
        title: '批量复制成功',
        description: `已复制 ${selectedPair.userStats.length} 个用户ID到剪贴板（每行一个ID）`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法访问剪贴板，请检查浏览器权限或手动复制',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [selectedPair, toast]);

  // 组件挂载时获取数据
  useEffect(() => {
    fetchTradingPairs();
  }, [fetchTradingPairs]);

  // 格式化数字显示 - 使用useCallback优化性能
  const formatNumber = useCallback((value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num === 0) return '0';
    if (num < 0.01) return num.toFixed(8);
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
    return (num / 1000000).toFixed(1) + 'M';
  }, []);

  // 优化分页按钮渲染 - 使用useMemo缓存计算结果
  const paginationButtons = useMemo(() => {
    if (!selectedPair) return [];
    
    const { currentPage, totalPages } = selectedPair.pagination;
    const maxButtons = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    const endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    const buttons = [];
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(i);
    }
    return buttons;
  }, [selectedPair?.pagination.currentPage, selectedPair?.pagination.totalPages]);

  if (isLoading) {
    return (
      <Box p={6} display="flex" justifyContent="center" alignItems="center" minH="400px">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>加载交易对数据中...</Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={6}>
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
        <Button mt={4} onClick={fetchTradingPairs} colorScheme="blue">
          重新加载
        </Button>
      </Box>
    );
  }

  return (
    <Box p={6}>
      
      {tradingPairs.length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          暂无交易对数据
        </Alert>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {tradingPairs.map((pair) => (
            <Card 
              key={pair.symbol} 
              cursor="pointer" 
              onClick={() => handlePairClick(pair.symbol)}
              bg="white"
              boxShadow="xl"
              borderRadius="xl"
              border="1px solid"
              borderColor="gray.100"
              _hover={{ 
                transform: 'translateY(-2px)', 
                boxShadow: '2xl',
                borderColor: 'blue.300'
              }}
              transition="all 0.3s ease"
              overflow="hidden"
            >
              <CardHeader pb={3} bg="linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)">
                <VStack spacing={2}>
                  <Heading size="md" color="blue.600" textAlign="center" wordBreak="break-all">
                    {pair.symbol}
                  </Heading>
                  <Text fontSize="xs" color="gray.500" textAlign="center">
                    交易对详情
                  </Text>
                </VStack>
              </CardHeader>
              <CardBody pt={4}>
                <VStack align="stretch" spacing={4}>
                  <Flex justify="space-between" align="center" p={3} bg="purple.50" borderRadius="lg">
                    <HStack>
                      <Box w={3} h={3} bg="purple.500" borderRadius="full" />
                      <Text fontSize="sm" color="gray.700" fontWeight="medium">策略数量</Text>
                    </HStack>
                    <Badge colorScheme="purple" variant="solid" fontSize="sm" px={3} py={1}>
                      {pair.strategyCount}
                    </Badge>
                  </Flex>
                  
                  <Flex justify="space-between" align="center" p={3} bg="green.50" borderRadius="lg">
                    <HStack>
                      <Box w={3} h={3} bg="green.500" borderRadius="full" />
                      <Text fontSize="sm" color="gray.700" fontWeight="medium">用户数量</Text>
                    </HStack>
                    <Badge colorScheme="green" variant="solid" fontSize="sm" px={3} py={1}>
                      {pair.userCount}
                    </Badge>
                  </Flex>
                  
                  <Flex justify="space-between" align="center" p={3} bg="orange.50" borderRadius="lg">
                    <HStack>
                      <Box w={3} h={3} bg="orange.500" borderRadius="full" />
                      <Text fontSize="sm" color="gray.700" fontWeight="medium">总刷量</Text>
                    </HStack>
                    <Text fontSize="sm" fontWeight="bold" color="orange.600">
                      {formatNumber(pair.totalVolume)}
                    </Text>
                  </Flex>
                </VStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* 详情弹窗 */}
      <Modal isOpen={isOpen} onClose={onClose} size={isMobile ? "full" : "6xl"}>
        <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
        <ModalContent maxH="90vh" bg="white" borderRadius="2xl" boxShadow="2xl">
          <ModalHeader 
            bg="linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)"
            borderTopRadius="2xl"
            borderBottom="1px solid"
            borderColor="gray.100"
            py={6}
          >
            <VStack spacing={2} align="start">
              <HStack>
                <Text fontSize="lg" fontWeight="bold" color="gray.800">交易对详情</Text>
                <Badge colorScheme="blue" fontSize="md" px={3} py={1} borderRadius="full">
                  {selectedPair?.symbol}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="gray.600">查看该交易对的用户刷量统计信息</Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton 
            size="lg" 
            bg="white" 
            boxShadow="md" 
            borderRadius="full"
            _hover={{ bg: "gray.50" }}
          />
          <ModalBody overflowY="auto" p={6}>
            {isLoadingDetails ? (
              <Box display="flex" justifyContent="center" alignItems="center" minH="300px">
                <VStack spacing={4}>
                  <Spinner size="xl" color="blue.500" thickness="4px" />
                  <Text color="gray.600" fontSize="lg">加载详情数据中...</Text>
                </VStack>
              </Box>
            ) : selectedPair ? (
              <VStack spacing={8} align="stretch">

                {/* 用户详情表格 */}
                <Box>
                  <Flex justify="space-between" align="center" mb={6}>
                    <Heading size="md" color="gray.800">用户刷量详情</Heading>
                    <Badge colorScheme="gray" variant="subtle" fontSize="sm" px={3} py={1}>
                      共 {selectedPair.pagination.totalCount} 个用户
                    </Badge>
                  </Flex>
                  
                  {/* 搜索和分页控件 */}
                  <Card bg="white" boxShadow="md" borderRadius="lg" border="1px solid" borderColor="gray.100" mb={4}>
                    <CardBody p={4}>
                      <Flex direction={{ base: "column", md: "row" }} gap={4} align={{ base: "stretch", md: "center" }}>
                        {/* 搜索框 */}
                        <Box flex={1}>
                          <InputGroup>
                            <InputLeftElement pointerEvents="none">
                              <SearchIcon color="gray.400" />
                            </InputLeftElement>
                            <Input
                              placeholder="搜索用户昵称..."
                              value={searchInput}
                              onChange={(e) => setSearchInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSearch();
                                }
                              }}
                              bg="gray.50"
                              border="1px solid"
                              borderColor="gray.200"
                              _hover={{ borderColor: "gray.300" }}
                              _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #3182ce" }}
                            />
                          </InputGroup>
                        </Box>
                        
                        {/* 搜索按钮 */}
                        <IconButton
                          aria-label="搜索"
                          icon={<SearchIcon />}
                          onClick={handleSearch}
                          colorScheme="blue"
                          variant="solid"
                          size="md"
                        />
                        
                        {/* 批量复制按钮 */}
                        <Button
                          leftIcon={<CopyIcon />}
                          onClick={handleCopyAllUserIds}
                          colorScheme="green"
                          variant="outline"
                          size="md"
                          isDisabled={!selectedPair || selectedPair.userStats.length === 0}
                        >
                          复制所有ID
                        </Button>
                        
                        {/* 每页显示数量 */}
                        <Flex align="center" gap={2}>
                          <Text fontSize="sm" color="gray.600" whiteSpace="nowrap">每页显示:</Text>
                          <Select
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            size="sm"
                            width="80px"
                            bg="white"
                            border="1px solid"
                            borderColor="gray.200"
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </Select>
                        </Flex>
                      </Flex>
                    </CardBody>
                  </Card>
                  
                  <Card bg="white" boxShadow="lg" borderRadius="xl" border="1px solid" borderColor="gray.100">
                    <CardBody p={0}>
                      <TableContainer>
                        <Table size="md" variant="simple">
                          <Thead bg="gray.50">
                            <Tr>
                              <Th color="gray.700" fontWeight="bold" fontSize="sm" py={4}>ID</Th>
                              <Th color="gray.700" fontWeight="bold" fontSize="sm" py={4}>昵称</Th>
                              <Th color="gray.700" fontWeight="bold" fontSize="sm" py={4}>UUID</Th>
                              <Th color="gray.700" fontWeight="bold" fontSize="sm" py={4}>策略数量</Th>
                              <Th color="gray.700" fontWeight="bold" fontSize="sm" py={4} isNumeric>当日刷的总量</Th>
                              <Th color="gray.700" fontWeight="bold" fontSize="sm" py={4} isNumeric>总刷量</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {selectedPair.userStats.map((user) => (
                              <UserTableRow key={user.userId} user={user} formatNumber={formatNumber} onCopyUserId={handleCopyUserId} />
                            ))}
                          </Tbody>
                        </Table>
                      </TableContainer>
                      
                      {/* 分页导航 */}
                      <Box p={4} bg="gray.50" borderTop="1px solid" borderColor="gray.100">
                        <Flex justify="space-between" align="center" direction={{ base: "column", md: "row" }} gap={4}>
                          {/* 分页信息 */}
                          <Text fontSize="sm" color="gray.600">
                            显示第 {((selectedPair.pagination.currentPage - 1) * selectedPair.pagination.limit) + 1} - {Math.min(selectedPair.pagination.currentPage * selectedPair.pagination.limit, selectedPair.pagination.totalCount)} 条，
                            共 {selectedPair.pagination.totalCount} 条记录
                          </Text>
                          
                          {/* 分页按钮 */}
                          <Flex align="center" gap={2}>
                            <IconButton
                              aria-label="上一页"
                              icon={<ChevronLeftIcon />}
                              onClick={() => handlePageChange(selectedPair.pagination.currentPage - 1)}
                              isDisabled={!selectedPair.pagination.hasPrevPage}
                              size="sm"
                              variant="outline"
                              colorScheme="blue"
                            />
                            
                            <Flex align="center" gap={1}>
                              {/* 页码按钮 - 使用缓存的按钮列表 */}
                              {paginationButtons.map((pageNum) => (
                                <Button
                                  key={pageNum}
                                  size="sm"
                                  variant={pageNum === selectedPair.pagination.currentPage ? "solid" : "outline"}
                                  colorScheme="blue"
                                  onClick={() => handlePageChange(pageNum)}
                                  minW="32px"
                                >
                                  {pageNum}
                                </Button>
                              ))}
                            </Flex>
                            
                            <IconButton
                              aria-label="下一页"
                              icon={<ChevronRightIcon />}
                              onClick={() => handlePageChange(selectedPair.pagination.currentPage + 1)}
                              isDisabled={!selectedPair.pagination.hasNextPage}
                              size="sm"
                              variant="outline"
                              colorScheme="blue"
                            />
                          </Flex>
                        </Flex>
                      </Box>
                    </CardBody>
                  </Card>
                </Box>
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter bg="gray.50" borderBottomRadius="2xl" py={4}>
            <Button 
              onClick={onClose} 
              colorScheme="gray" 
              variant="solid"
              size="lg"
              px={8}
              borderRadius="xl"
              _hover={{ transform: "translateY(-1px)", boxShadow: "lg" }}
              transition="all 0.2s"
            >
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TradingPairsStats;