import React from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Icon,
  Text,
  Badge,
  VStack,
  HStack,
  Divider,
  useToast
} from '@chakra-ui/react';
import { FiDatabase, FiWifi, FiWifiOff, FiRefreshCw } from 'react-icons/fi';

import { useDatabase } from '../context/DatabaseContext';

const ConnectionStatus: React.FC = () => {
  const { isConnected, connect, disconnect, refreshData } = useDatabase();
  const toast = useToast();

  const handleConnect = async () => {
    try {
      await connect();
      toast({
        title: '连接成功',
        description: '已成功连接到数据库',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: '连接失败',
        description: '无法连接到数据库，请检查配置',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: '已断开连接',
      description: '数据库连接已断开',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleRefresh = async () => {
    try {
      await refreshData();
      toast({
        title: '刷新成功',
        description: '数据已更新',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: '刷新失败',
        description: '无法刷新数据',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <HStack spacing={3}>
      {/* 连接状态指示器 */}
      <HStack spacing={2}>
        <Icon 
          as={(isConnected ? FiWifi : FiWifiOff) as React.ComponentType} 
          color={isConnected ? 'green.500' : 'red.500'}
          boxSize={4}
        />
        <Badge 
          colorScheme={isConnected ? 'green' : 'red'} 
          variant="subtle"
          px={2}
          py={1}
          borderRadius="md"
          fontSize="xs"
        >
          {isConnected ? '已连接' : '未连接'}
        </Badge>
      </HStack>
      
      {/* 操作按钮 */}
      {!isConnected ? (
        <Button
          size="sm"
          colorScheme="brand"
          leftIcon={<Icon as={FiWifi as React.ComponentType} boxSize={3} />}
          onClick={handleConnect}
        >
          连接
        </Button>
      ) : (
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="ghost"
            colorScheme="brand"
            leftIcon={<Icon as={FiRefreshCw as React.ComponentType} boxSize={3} />}
            onClick={handleRefresh}
          >
            刷新
          </Button>
          <Button
            size="sm"
            variant="ghost"
            colorScheme="red"
            leftIcon={<Icon as={FiWifiOff as React.ComponentType} boxSize={3} />}
            onClick={handleDisconnect}
          >
            断开
          </Button>
        </HStack>
      )}
    </HStack>
   );
};

export default ConnectionStatus;