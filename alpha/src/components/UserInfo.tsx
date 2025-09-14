import React from 'react';
import {
  Box,
  Text,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Avatar,
  Badge,
  VStack,
  HStack,
  useColorModeValue
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { useAuth } from '../context/AuthContext';

const UserInfo: React.FC = () => {
  const { user, logout, isSuperAdmin, isAdmin } = useAuth();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  if (!user) return null;

  const getUserRole = () => {
    if (isSuperAdmin) return { text: '超级管理员', color: 'purple' };
    if (isAdmin) return { text: '管理员', color: 'blue' };
    return { text: '普通用户', color: 'gray' };
  };

  const role = getUserRole();

  return (
    <Menu>
      <MenuButton
        as={Button}
        variant="ghost"
        size="sm"
        rightIcon={<ChevronDownIcon />}
        _hover={{ bg: 'gray.100' }}
        _active={{ bg: 'gray.200' }}
      >
        <HStack spacing={2}>
          <Avatar size="xs" name={user.nickname || user.username} />
          <VStack spacing={0} align="start" display={{ base: 'none', md: 'flex' }}>
            <Text fontSize="sm" fontWeight="medium" color="gray.700">
              {user.nickname || user.username}
            </Text>
            <Badge size="xs" colorScheme={role.color} variant="subtle">
              {role.text}
            </Badge>
          </VStack>
        </HStack>
      </MenuButton>
      
      <MenuList
        bg={bgColor}
        borderColor={borderColor}
        boxShadow="xl"
        minW="250px"
      >
        {/* 用户信息 */}
        <Box px={4} py={3} borderBottom="1px" borderColor={borderColor}>
          <VStack spacing={2} align="start">
            <HStack spacing={3}>
              <Avatar size="sm" name={user.nickname || user.username} />
              <VStack spacing={0} align="start">
                <Text fontWeight="semibold" color="gray.700">
                  {user.nickname || user.username}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  @{user.username}
                </Text>
              </VStack>
            </HStack>
            
            <HStack spacing={2}>
              <Badge colorScheme={role.color} variant="subtle" size="sm">
                  <Text>{role.text}</Text>
                </Badge>
            </HStack>
            
            {user.email && (
              <Text fontSize="xs" color="gray.500">
                📧 {user.email}
              </Text>
            )}
            
            {user.mobile && (
              <Text fontSize="xs" color="gray.500">
                📱 {user.mobile}
              </Text>
            )}
          </VStack>
        </Box>
        
        {/* 权限信息 */}
        <Box px={4} py={3} borderBottom="1px" borderColor={borderColor}>
          <Text fontSize="xs" color="gray.500" mb={2} fontWeight="medium">
            权限范围
          </Text>
          <VStack spacing={1} align="start">
            {isSuperAdmin && (
              <Text fontSize="xs" color="purple.600">
                ✓ 查看所有用户数据
              </Text>
            )}
            {(isSuperAdmin || isAdmin) && (
              <>
                <Text fontSize="xs" color="blue.600">
                  ✓ 管理用户和策略
                </Text>
                <Text fontSize="xs" color="blue.600">
                  ✓ 新增修改策略
                </Text>
              </>
            )}
            <Text fontSize="xs" color="green.600">
              ✓ 查看个人进度信息
            </Text>
          </VStack>
        </Box>
        
        <MenuDivider />
        
        {/* 操作按钮 */}
        <MenuItem
          onClick={logout}
          color="red.600"
          _hover={{ bg: 'red.50' }}
        >
          退出登录
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default UserInfo;