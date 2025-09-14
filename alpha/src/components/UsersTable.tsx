import React, { useState, useMemo, useRef } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  Card,
  CardHeader,
  CardBody,
  Flex,
  Icon,
  Tooltip,
  Button,
  HStack,
  Select,
  VStack,
  SimpleGrid,
  useBreakpointValue,
  IconButton,
  useToast,

  useDisclosure,
  Input
} from '@chakra-ui/react';
import { FiUser, FiUserCheck, FiChevronLeft, FiChevronRight, FiPlus, FiEdit2, FiSearch } from 'react-icons/fi';

import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';

import { User } from '../types/database';
// 导入用户表单组件
import UserForm from '../components/UserForm';
import { databaseService } from '../services/database';

const UsersTable: React.FC = () => {
  const { users, refreshData } = useDatabase();
  const { user, isSuperAdmin, canViewAllUsers, getManageableUserIds } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const toast = useToast();
  
  // 查询状态
  const [searchFilters, setSearchFilters] = useState({
    adminId: '',
    uuid: '',
    nickname: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({
    adminId: '',
    uuid: '',
    nickname: ''
  });
  
  // 用户表单状态
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  


  // 过滤和排序用户数据
  const filteredUsers = useMemo(() => {
    const filtered = users.filter(userItem => {
      // 权限控制：只显示用户有权限管理的用户
      if (!canViewAllUsers()) {
        if (!user) {
          return false; // 未登录用户不能查看任何数据
        }
        // 管理员可以管理自己和admin_id为自己UUID的用户
        if (user.admin_id === 1 || user.admin_id === '1') {
          // 管理员可以看到：1. 自己 2. admin_id等于自己uuid的用户
          if (userItem.id === user.id || userItem.admin_id?.toString() === user.uuid) {
            // 允许查看
          } else {
            return false;
          }
        }
        // 普通用户只能看到自己
        else {
          if (userItem.id !== user.id) {
            return false;
          }
        }
      }
      
      // 管理员ID精确匹配
      if (appliedFilters.adminId && userItem.admin_id?.toString() !== appliedFilters.adminId) {
        return false;
      }
      
      // UUID精确匹配
      if (appliedFilters.uuid && userItem.uuid !== appliedFilters.uuid) {
        return false;
      }
      
      // 昵称模糊匹配
      if (appliedFilters.nickname && (!userItem.nickname || !userItem.nickname.toLowerCase().includes(appliedFilters.nickname.toLowerCase()))) {
        return false;
      }
      
      return true;
    });

    // 排序：unauthenticated 用户排在最前面
    return filtered.sort((a, b) => {
      // 判断是否为 unauthenticated 用户
      const aIsUnauthenticated = a.status === 'unauthenticated';
      const bIsUnauthenticated = b.status === 'unauthenticated';
      
      if (aIsUnauthenticated && !bIsUnauthenticated) {
        return -1;
      }
      if (!aIsUnauthenticated && bIsUnauthenticated) {
        return 1;
      }
      
      // 最后按创建时间排序
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [users, appliedFilters, canViewAllUsers, getManageableUserIds]);
  
  // 分页计算
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentUsers = useMemo(() => {
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, startIndex, endIndex]);

  // 分页控制函数
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // 重置到第一页
  };
  
  // 处理查询
  const handleSearch = () => {
    setAppliedFilters({ ...searchFilters });
    setCurrentPage(1); // 重置到第一页
  };
  
  // 清空查询
  const handleClearSearch = () => {
    setSearchFilters({ adminId: '', uuid: '', nickname: '' });
    setAppliedFilters({ adminId: '', uuid: '', nickname: '' });
    setCurrentPage(1);
  };
  
  // 处理查询输入变化
  const handleFilterChange = (field: keyof typeof searchFilters, value: string) => {
    setSearchFilters(prev => ({ ...prev, [field]: value }));
  };

  // 处理添加用户
  const handleAddUser = () => {
    setSelectedUser(null);
    setFormMode('create');
    onFormOpen();
  };

  // 处理编辑用户
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormMode('edit');
    onFormOpen();
  };

  // 处理验证登录
  const handleVerifyLogin = async (user: User) => {
    try {
      await databaseService.updateUserLoginStatus(user.id, { qr_code_status: 'Waitting' });
      toast({
        title: '验证请求已发送',
        description: `用户 ${user.username} 的登录状态已设置为等待验证`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // 刷新数据以获取最新的用户登录状态
      await refreshData();
    } catch (error: any) {
      toast({
        title: '验证失败',
        description: error.message || '设置验证状态失败',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getUserTypeIcon = (user: User) => {
    if (user.admin_id === null) {
      return <Icon as={FiUserCheck as any} color="brand.500" />;
    }
    return <Icon as={FiUser as any} color="gray.500" />;
  };

  const getUserTypeBadge = (user: User) => {
    if (user.admin_id === null) {
      return (
        <Badge colorScheme="green" variant="subtle">
          管理员
        </Badge>
      );
    }
    return (
      <Badge colorScheme="gray" variant="subtle">
        普通用户
      </Badge>
    );
  };

  // 移动端用户卡片组件
  const UserCard: React.FC<{ user: User }> = ({ user }) => {
    return (
      <Card
        boxShadow="0 2px 4px rgba(0, 0, 0, 0.1)"
        border={
          user.status === 'unauthenticated'
            ? '2px solid'
            : 'none'
        }
        borderColor={
          user.status === 'unauthenticated'
            ? 'orange.400'
            : 'transparent'
        }
        bg={
          user.status === 'unauthenticated'
            ? 'orange.50'
            : 'white'
        }
        _hover={{
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
          transform: "translateY(-2px)",
          bg: user.status === 'unauthenticated'
            ? 'orange.100'
            : 'gray.50'
        }}
        transition="all 0.2s ease-in-out"
      >
      <CardBody p={4}>
        <VStack align="stretch" spacing={3}>
          {/* 用户头部信息 */}
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={3}>
              <Box
                p={2}
                borderRadius="md"
                bg={user.admin_id === null ? 'green.50' : 'gray.50'}
              >
                {getUserTypeIcon(user)}
              </Box>
              <VStack align="start" spacing={0}>
                <Text fontWeight="bold" color="gray.800" fontSize="md">
                  {user.username}
                </Text>
                <Text color="gray.600" fontSize="sm">
                  {user.nickname || '未设置昵称'}
                </Text>
              </VStack>
            </Flex>
            {getUserTypeBadge(user)}
          </Flex>

          {/* 联系信息 */}
          <SimpleGrid columns={1} spacing={2}>
            <Box>
              <Text fontSize="xs" color="gray.500" mb={1}>邮箱</Text>
              <Text fontSize="sm" color="gray.700">
                {user.email || '未设置'}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500" mb={1}>手机号</Text>
              <Text fontSize="sm" color="gray.700">
                {user.mobile || '未设置'}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="gray.500" mb={1}>UUID</Text>
              <Text fontSize="xs" color="gray.700" fontFamily="mono">
                {user.uuid || '未设置'}
              </Text>
            </Box>
          </SimpleGrid>

          {/* 底部信息 */}
          <Box pt={2} borderTop="1px" borderColor="gray.100">
            <Flex justify="space-between" align="center" mb={2}>
              <Text fontSize="xs" color="gray.500">
                管理员ID: {user.admin_id || 'N/A'}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {formatDate(user.created_at)}
              </Text>
            </Flex>
            
            {/* 操作按钮 */}
            <HStack spacing={2} justify="flex-end">
              <IconButton
                aria-label="编辑用户"
                icon={<Icon as={FiEdit2 as React.ComponentType} />}
                size="sm"
                variant="outline"
                colorScheme="blue"
                onClick={() => handleEditUser(user)}
              />
              {user.status === 'unauthenticated' && (
                <IconButton
                  aria-label="验证登录"
                  icon={<Icon as={FiUserCheck as React.ComponentType} />}
                  size="sm"
                  variant="outline"
                  colorScheme="green"
                  onClick={() => handleVerifyLogin(user)}
                />
              )}
            </HStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
    );
  };

  return (
    <Card
      boxShadow="0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
      border="none"
      bg="white"
    >
      <CardHeader>
        <Flex align="center" justify="space-between">
          <Text fontSize="lg" fontWeight="semibold" color="gray.800">
            用户管理
          </Text>
          <HStack spacing={3}>
            <Badge 
              colorScheme="brand" 
              variant="subtle" 
              px={3} 
              py={1} 
              borderRadius="full"
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
            >
              {appliedFilters.adminId || appliedFilters.uuid || appliedFilters.nickname 
                ? `筛选出 ${filteredUsers.length} / ${users.length} 个用户`
                : `总计 ${users.length} 个用户`
              }
            </Badge>
            <Button
              leftIcon={<Icon as={FiPlus as React.ComponentType} />}
              colorScheme="blue"
              size="sm"
              onClick={handleAddUser}
              boxShadow="0 2px 4px rgba(0, 0, 0, 0.1)"
              _hover={{
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
                transform: "translateY(-1px)"
              }}
              transition="all 0.2s ease-in-out"
            >
              添加用户
            </Button>
          </HStack>
        </Flex>
      </CardHeader>
      
      <CardBody>
        {/* 查询区域 */}
        <Box 
          mb={6} 
          p={6} 
          bg="linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)"
          borderRadius="xl"
          boxShadow="0 4px 12px rgba(0, 0, 0, 0.05)"
          border="1px solid"
          borderColor="gray.200"
          position="relative"
          overflow="hidden"
        >
          <Box position="relative" zIndex={1}>
            <Flex align="center" mb={4}>
              <Icon 
                as={FiSearch as React.ComponentType} 
                color="gray.600" 
                boxSize={5} 
                mr={3}
              />
              <Text fontSize="lg" fontWeight="semibold" color="gray.700">
                查询筛选
              </Text>
            </Flex>
            
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              <Box>
                <Text fontSize="sm" color="gray.600" mb={2} fontWeight="medium">
                  管理员ID
                </Text>
                <Input
                  placeholder="请输入管理员ID"
                  value={searchFilters.adminId}
                  onChange={(e) => handleFilterChange('adminId', e.target.value)}
                  bg="white"
                  border="1px solid"
                  borderColor="gray.300"
                  borderRadius="lg"
                  size="md"
                  _placeholder={{ color: 'gray.400' }}
                  _focus={{
                    borderColor: 'blue.400',
                    boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.1)',
                    transform: 'translateY(-1px)'
                  }}
                  _hover={{
                    borderColor: 'gray.400'
                  }}
                  transition="all 0.2s ease-in-out"
                  boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
                />
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={2} fontWeight="medium">
                  UUID
                </Text>
                <Input
                  placeholder="请输入UUID"
                  value={searchFilters.uuid}
                  onChange={(e) => handleFilterChange('uuid', e.target.value)}
                  bg="white"
                  border="1px solid"
                  borderColor="gray.300"
                  borderRadius="lg"
                  size="md"
                  _placeholder={{ color: 'gray.400' }}
                  _focus={{
                    borderColor: 'blue.400',
                    boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.1)',
                    transform: 'translateY(-1px)'
                  }}
                  _hover={{
                    borderColor: 'gray.400'
                  }}
                  transition="all 0.2s ease-in-out"
                  boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
                />
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={2} fontWeight="medium">
                  昵称
                </Text>
                <Input
                  placeholder="请输入昵称（模糊匹配）"
                  value={searchFilters.nickname}
                  onChange={(e) => handleFilterChange('nickname', e.target.value)}
                  bg="white"
                  border="1px solid"
                  borderColor="gray.300"
                  borderRadius="lg"
                  size="md"
                  _placeholder={{ color: 'gray.400' }}
                  _focus={{
                    borderColor: 'blue.400',
                    boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.1)',
                    transform: 'translateY(-1px)'
                  }}
                  _hover={{
                    borderColor: 'gray.400'
                  }}
                  transition="all 0.2s ease-in-out"
                  boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
                />
              </Box>
              
              <Box>
                <Text fontSize="sm" color="transparent" mb={2} fontWeight="medium">
                  操作
                </Text>
                <HStack spacing={3}>
                  <Button
                    leftIcon={<Icon as={FiSearch as any} />}
                    colorScheme="blue"
                    variant="solid"
                    size="md"
                    onClick={handleSearch}
                    borderRadius="lg"
                    fontWeight="semibold"
                    _hover={{
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)'
                    }}
                    _active={{
                      transform: 'translateY(0px)'
                    }}
                    transition="all 0.2s ease-in-out"
                    boxShadow="0 2px 4px rgba(0, 0, 0, 0.1)"
                  >
                    查询
                  </Button>
                  <Button
                    variant="outline"
                    colorScheme="gray"
                    size="md"
                    onClick={handleClearSearch}
                    isDisabled={!appliedFilters.adminId && !appliedFilters.uuid && !appliedFilters.nickname}
                    borderRadius="lg"
                    fontWeight="semibold"
                    _hover={{
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)'
                    }}
                    _active={{
                      transform: 'translateY(0px)'
                    }}
                    _disabled={{
                      opacity: 0.4,
                      cursor: 'not-allowed',
                      _hover: {
                        transform: 'none',
                        boxShadow: 'none'
                      }
                    }}
                    transition="all 0.2s ease-in-out"
                  >
                    清空
                  </Button>
                </HStack>
              </Box>
            </SimpleGrid>
          </Box>
        </Box>
        
        {users.length === 0 ? (
          <Box textAlign="center" py={12}>
            <Box
              p={6}
              borderRadius="full"
              bg="gray.50"
              display="inline-block"
              mb={4}
              boxShadow="inset 0 2px 4px rgba(0, 0, 0, 0.05)"
            >
              <Icon as={FiUser as any} boxSize={12} color="gray.300" />
            </Box>
            <Text color="gray.500" fontSize="lg" fontWeight="medium">
              暂无用户数据
            </Text>
            <Text color="gray.400" fontSize="sm" mt={1}>
              系统中还没有注册用户
            </Text>
          </Box>
        ) : (
          <>
            {/* 分页控制栏 */}
            <Flex 
              align="center" 
              justify="space-between" 
              mb={4} 
              p={3} 
              bg="gray.50" 
              borderRadius="lg"
              direction={{ base: "column", sm: "row" }}
              gap={{ base: 3, sm: 0 }}
            >
              <Flex align="center" gap={2}>
                <Text fontSize="sm" color="gray.600">每页显示:</Text>
                <Select 
                  size="sm" 
                  value={pageSize} 
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  w="80px"
                  bg="white"
                  border="none"
                  boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </Select>
                <Text fontSize="sm" color="gray.600">条</Text>
              </Flex>
              <Text fontSize="sm" color="gray.600">
                显示 {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} 条，共 {filteredUsers.length} 条
              </Text>
            </Flex>

            {/* 移动端卡片视图 */}
            {isMobile ? (
              <SimpleGrid columns={1} spacing={4}>
                {currentUsers.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </SimpleGrid>
            ) : (
              /* 桌面端表格视图 */
              <Box 
                overflowX="auto" 
                borderRadius="lg" 
                boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
                bg="white"
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
                    _hover: {
                      bg: 'gray.400',
                    },
                  },
                }}
              >
                <Table 
                  variant="simple" 
                  size={{ base: "sm", md: "md" }}
                  minW="800px"
                >
                  <Thead bg="gray.50">
                    <Tr>
                      <Th 
                        color="gray.700" 
                        fontWeight="semibold" 
                        borderColor="gray.200"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                      >
                        用户名
                      </Th>
                      <Th 
                        color="gray.700" 
                        fontWeight="semibold" 
                        borderColor="gray.200"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                      >
                        昵称
                      </Th>
                      <Th 
                        color="gray.700" 
                        fontWeight="semibold" 
                        borderColor="gray.200"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                      >
                        邮箱
                      </Th>
                      <Th 
                        color="gray.700" 
                        fontWeight="semibold" 
                        borderColor="gray.200"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                      >
                        手机号
                      </Th>
                      <Th 
                        color="gray.700" 
                        fontWeight="semibold" 
                        borderColor="gray.200"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                      >
                        UUID
                      </Th>
                      <Th 
                        color="gray.700" 
                        fontWeight="semibold" 
                        borderColor="gray.200"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                      >
                        管理员ID
                      </Th>
                      <Th 
                        color="gray.700" 
                        fontWeight="semibold" 
                        borderColor="gray.200"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                      >
                        创建时间(UTC)
                      </Th>
                      <Th 
                        color="gray.700" 
                        fontWeight="semibold" 
                        borderColor="gray.200" 
                        width="120px"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                      >
                        操作
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {currentUsers.map((user, index) => (
                      <Tr 
                        key={user.id} 
                        bg={
                          user.status === 'unauthenticated' &&
                          user.login_status === 'online' &&
                          user.qr_code_status === 'scanned'
                            ? 'blue.50'
                            : user.status === 'unauthenticated'
                            ? 'orange.50'
                            : 'transparent'
                        }
                        _hover={{ 
                          bg:
                            user.status === 'unauthenticated' &&
                            user.login_status === 'online' &&
                            user.qr_code_status === 'scanned'
                              ? 'blue.100'
                              : user.status === 'unauthenticated'
                              ? 'orange.100'
                              : 'blue.50',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        transition="all 0.2s ease-in-out"
                        borderColor="gray.100"
                        borderLeft={
                          user.status === 'unauthenticated' &&
                          user.login_status === 'online' &&
                          user.qr_code_status === 'scanned'
                            ? '4px solid'
                            : user.status === 'unauthenticated'
                            ? '4px solid'
                            : 'none'
                        }
                        borderLeftColor={
                          user.status === 'unauthenticated' &&
                          user.login_status === 'online' &&
                          user.qr_code_status === 'scanned'
                            ? 'blue.400'
                            : user.status === 'unauthenticated'
                            ? 'orange.400'
                            : 'transparent'
                        }
                      >
                        <Td 
                          borderColor="gray.100"
                          py={{ base: 2, md: 3 }}
                          px={{ base: 2, md: 4 }}
                          fontSize={{ base: "xs", md: "sm" }}
                        >
                          <Flex align="center" gap={3}>
                            <Box
                              p={1}
                              borderRadius="md"
                              bg={user.admin_id === null ? 'green.50' : 'gray.50'}
                            >
                              {getUserTypeIcon(user)}
                            </Box>
                            <Text fontWeight="medium" color="gray.700">
                              {user.username}
                            </Text>
                          </Flex>
                        </Td>
                      <Td 
                        borderColor="gray.100"
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                        fontSize={{ base: "xs", md: "sm" }}
                      >
                        {user.nickname ? (
                          <Text fontSize={{ base: "xs", md: "sm" }} color="gray.700" fontWeight="medium">
                            {user.nickname}
                          </Text>
                        ) : (
                          <Text color="gray.400" fontSize={{ base: "xs", md: "sm" }}>
                            -
                          </Text>
                         )}
                      </Td>
                      <Td 
                        borderColor="gray.100"
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                        fontSize={{ base: "xs", md: "sm" }}
                      >
                        {user.email ? (
                          <Tooltip label={user.email} placement="top">
                            <Text 
                              fontSize={{ base: "xs", md: "sm" }} 
                              color="gray.600"
                              cursor="help"
                              maxW={{ base: "120px", md: "200px" }}
                              isTruncated
                              _hover={{ color: 'blue.600' }}
                            >
                              {user.email}
                            </Text>
                          </Tooltip>
                        ) : (
                          <Text color="gray.400" fontSize={{ base: "xs", md: "sm" }}>
                            -
                          </Text>
                        )}
                      </Td>
                      <Td 
                        borderColor="gray.100"
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                        fontSize={{ base: "xs", md: "sm" }}
                      >
                        {user.mobile ? (
                          <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600" fontFamily="mono">
                            {user.mobile}
                          </Text>
                        ) : (
                          <Text color="gray.400" fontSize={{ base: "xs", md: "sm" }}>
                            -
                          </Text>
                        )}
                      </Td>
                      <Td 
                        borderColor="gray.100"
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                        fontSize={{ base: "xs", md: "sm" }}
                      >
                        {user.uuid ? (
                          <Tooltip label={user.uuid} placement="top">
                            <Text 
                              fontSize={{ base: "xs", md: "sm" }} 
                              color="gray.600"
                              fontFamily="mono"
                              cursor="help"
                              maxW={{ base: "80px", md: "120px" }}
                              isTruncated
                              _hover={{ color: 'blue.600' }}
                            >
                              {user.uuid}
                            </Text>
                          </Tooltip>
                        ) : (
                          <Text color="gray.400" fontSize={{ base: "xs", md: "sm" }}>
                            -
                          </Text>
                        )}
                      </Td>
                      <Td 
                        borderColor="gray.100"
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                        fontSize={{ base: "xs", md: "sm" }}
                      >
                        {user.admin_id ? (
                          <Text color="gray.600" fontFamily="mono" fontSize={{ base: "xs", md: "sm" }}>
                            {user.admin_id}
                          </Text>
                        ) : (
                          <Text color="gray.400" fontSize={{ base: "xs", md: "sm" }}>
                            -
                          </Text>
                        )}
                      </Td>
                      <Td 
                        borderColor="gray.100"
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                        fontSize={{ base: "xs", md: "sm" }}
                      >
                        <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">
                          {formatDate(user.created_at)}
                        </Text>
                      </Td>
                      <Td 
                        borderColor="gray.100"
                        py={{ base: 2, md: 3 }}
                        px={{ base: 2, md: 4 }}
                        fontSize={{ base: "xs", md: "sm" }}
                      >
                        <HStack spacing={{ base: 0.5, md: 1 }}>
                          <IconButton
                            aria-label="编辑用户"
                            icon={<Icon as={FiEdit2 as any} />}
                            size={{ base: "xs", md: "sm" }}
                            variant="ghost"
                            colorScheme="blue"
                            onClick={() => handleEditUser(user)}
                          />
                          {user.status === 'unauthenticated' && (
                            <IconButton
                              aria-label="验证登录"
                              icon={<Icon as={FiUserCheck as any} />}
                              size={{ base: "xs", md: "sm" }}
                              variant="ghost"
                              colorScheme="green"
                              onClick={() => handleVerifyLogin(user)}
                            />
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                    </Tbody>
                  </Table>
                </Box>
              )
            }

            {/* 分页导航 */}
            {totalPages > 1 && (
              <Flex 
                align="center" 
                justify="center" 
                mt={6} 
                gap={2}
                direction={{ base: "column", sm: "row" }}
                wrap="wrap"
              >
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => goToPage(currentPage - 1)}
                  isDisabled={currentPage === 1}
                  leftIcon={<Icon as={FiChevronLeft as React.ComponentType} />}
                  borderColor="gray.300"
                  _hover={{ bg: 'gray.50', borderColor: 'gray.400' }}
                >
                  上一页
                </Button>
                
                <HStack spacing={1}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        size="sm"
                        variant={currentPage === pageNum ? 'solid' : 'outline'}
                        colorScheme={currentPage === pageNum ? 'brand' : 'gray'}
                        onClick={() => goToPage(pageNum)}
                        minW="40px"
                        borderColor="gray.300"
                        _hover={{ 
                          bg: currentPage === pageNum ? 'brand.600' : 'gray.50',
                          borderColor: currentPage === pageNum ? 'brand.600' : 'gray.400'
                        }}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </HStack>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => goToPage(currentPage + 1)}
                  isDisabled={currentPage === totalPages}
                  rightIcon={<Icon as={FiChevronRight as React.ComponentType} />}
                  borderColor="gray.300"
                  _hover={{ bg: 'gray.50', borderColor: 'gray.400' }}
                >
                  下一页
                </Button>
              </Flex>
            )}
          </>
        )}
      </CardBody>

      {/* 用户表单对话框 */}
      <UserForm
        isOpen={isFormOpen}
        onClose={onFormClose}
        mode={formMode}
        user={selectedUser}
        onSuccess={async () => {
          onFormClose();
          // 刷新数据以获取最新的用户信息
          await refreshData();
        }}
      />


    </Card>
  );
};

export default React.memo(UsersTable);