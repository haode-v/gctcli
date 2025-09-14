import React, { useMemo } from 'react';
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
  Icon,
  Flex,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  SimpleGrid,
  useBreakpointValue
} from '@chakra-ui/react';
import { FiAlertTriangle } from 'react-icons/fi';

import { useDatabase } from '../context/DatabaseContext';

const EventsMonitor: React.FC = () => {
  const { userStrategyTracking, users, strategies } = useDatabase();
  const isMobile = useBreakpointValue({ base: true, md: false });

  // 筛选出有问题的user_strategy_tracking数据
  const problematicTracking = useMemo(() => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    return userStrategyTracking.filter(tracking => {
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
    });
  }, [userStrategyTracking, strategies]);
  


  return (
    <Card bg="white" boxShadow="xl" borderRadius="xl" border="none">
      <CardHeader pb={3}>
        <Flex 
          align="center" 
          gap={{ base: 2, md: 3 }}
          direction={{ base: "column", sm: "row" }}
          textAlign={{ base: "center", sm: "left" }}
        >
          <Flex align="center" gap={{ base: 2, md: 3 }}>
            <Icon as={FiAlertTriangle as any} boxSize={{ base: 5, md: 6 }} color="red.500" />
            <Heading size={{ base: "md", md: "lg" }} color="gray.800">
              问题策略跟踪监控
            </Heading>
          </Flex>
          <Badge 
            colorScheme={problematicTracking.length > 0 ? "red" : "green"} 
            variant="subtle" 
            ml={{ base: 0, sm: "auto" }}
            fontSize={{ base: "xs", md: "sm" }}
          >
            {problematicTracking.length} 个问题
          </Badge>
        </Flex>
      </CardHeader>
      
      <CardBody pt={0}>
        {problematicTracking.length === 0 ? (
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            <AlertTitle>系统正常！</AlertTitle>
            <AlertDescription>
              当前没有发现问题的策略跟踪记录。
            </AlertDescription>
          </Alert>
        ) : (
          <VStack spacing={4} align="stretch">
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <AlertTitle>发现 {problematicTracking.length} 个问题策略！</AlertTitle>
              <AlertDescription>
                以下策略状态为活跃但超过10分钟未更新，可能已停止交易。
              </AlertDescription>
            </Alert>
            
            <SimpleGrid columns={{ base: 1, lg: 2, xl: 3 }} spacing={{ base: 3, md: 4 }}>
              {problematicTracking.map((tracking, index) => {
                const updatedAt = new Date(tracking.updated_at);
                const createdAt = new Date(tracking.created_at);
                const minutesAgo = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60));
                const user = users.find(u => u.id === tracking.user_id);
                
                return (
                  <Box
                    key={`${tracking.user_id}-${tracking.strategy_id}-${index}`}
                    p={{ base: 4, md: 5 }}
                    bg="gradient-to-br from-red.50 to-red.100"
                    borderRadius={{ base: "lg", md: "xl" }}
                    boxShadow="lg"
                    _hover={{
                      boxShadow: 'xl',
                      transform: isMobile ? 'none' : 'translateY(-4px)',
                      bg: 'gradient-to-br from-red.100 to-red.150'
                    }}
                    transition="all 0.3s ease"
                  >
                    <VStack align="stretch" spacing={{ base: 2, md: 3 }}>
                      <Flex 
                          justify="space-between" 
                          align="center"
                          direction={{ base: "column", sm: "row" }}
                          gap={{ base: 1, sm: 0 }}
                        >
                          <Badge 
                            colorScheme="red" 
                            variant="solid" 
                            size={{ base: "xs", md: "sm" }} 
                            px={{ base: 2, md: 3 }} 
                            py={1}
                          >
                            问题策略
                          </Badge>
                          <Text 
                            fontSize={{ base: "2xs", md: "xs" }} 
                            color="red.600" 
                            fontWeight="bold" 
                            fontFamily="mono"
                          >
                            {minutesAgo} 分钟前
                          </Text>
                        </Flex>
                      
                      <Divider borderColor="red.200" opacity={0.6} />
                      
                      <VStack align="stretch" spacing={{ base: 1.5, md: 2 }}>
                        <Box>
                          <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.500" mb={1}>用户信息</Text>
                          <VStack align="stretch" spacing={1} pl={{ base: 1, md: 2 }}>
                            <Flex justify="space-between" align="center">
                              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">昵称:</Text>
                              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" color="gray.800">
                                {user?.nickname || 'N/A'}
                              </Text>
                            </Flex>
                            <Flex justify="space-between" align="center">
                              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">UUID:</Text>
                              <Text 
                                fontSize={{ base: "2xs", md: "xs" }} 
                                fontFamily="mono" 
                                color="blue.600" 
                                fontWeight="medium"
                                maxW={{ base: "120px", md: "auto" }}
                                isTruncated
                              >
                                {user?.uuid || 'N/A'}
                              </Text>
                            </Flex>
                            <Flex justify="space-between" align="center">
                              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">用户ID:</Text>
                              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium">{tracking.user_id}</Text>
                            </Flex>
                          </VStack>
                        </Box>
                        
                        <Box>
                          <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.500" mb={1}>策略信息</Text>
                          <VStack align="stretch" spacing={1} pl={{ base: 1, md: 2 }}>
                            <Flex justify="space-between" align="center">
                              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">策略ID:</Text>
                              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" color="purple.600">{tracking.strategy_id}</Text>
                            </Flex>
                            <Flex justify="space-between" align="center">
                              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">状态:</Text>
                              <Badge colorScheme="green" size={{ base: "xs", md: "sm" }}>{tracking.status}</Badge>
                            </Flex>
                          </VStack>
                        </Box>
                        
                        <Box>
                          <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.500" mb={1}>时间信息</Text>
                          <VStack align="stretch" spacing={1} pl={{ base: 1, md: 2 }}>
                            <Flex justify="space-between" align="center">
                              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">创建时间:</Text>
                              <Text fontSize={{ base: "2xs", md: "xs" }} fontFamily="mono" color="gray.700">
                                {createdAt.toLocaleTimeString('zh-CN')}
                              </Text>
                            </Flex>
                            <Flex justify="space-between" align="center">
                              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">最后更新:</Text>
                              <Text fontSize={{ base: "2xs", md: "xs" }} fontFamily="mono" color="red.600" fontWeight="bold">
                                {updatedAt.toLocaleTimeString('zh-CN')}
                              </Text>
                            </Flex>
                          </VStack>
                        </Box>
                      </VStack>
                    </VStack>
                  </Box>
                );
              })}
            </SimpleGrid>
          </VStack>
        )}
      </CardBody>
    </Card>
  );
};

export default React.memo(EventsMonitor);