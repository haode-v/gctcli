import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Heading,
  Alert,
  AlertIcon,
  Spinner,
  Image,
  useToast,
  Card,
  CardBody,
  Divider,
  Badge,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Icon,
  Flex
} from '@chakra-ui/react';
import { InfoIcon, DownloadIcon } from '@chakra-ui/icons';
import { useAuth } from '../context/AuthContext';

interface QRCodeStatus {
  id: number;
  user_id: number;
  status: string;
  qr_code_image: string;
  qr_code_status: string;
  qr_code_expires_at: string;
  last_login_time: string;
  next_login_time: string;
}

const QRCodeLogin: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [qrStatus, setQrStatus] = useState<QRCodeStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [expiresIn, setExpiresIn] = useState('');
  const [waiting, setWaiting] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // 判断二维码是否过期
  const isQRCodeExpired = () => {
    if (!qrStatus?.qr_code_expires_at) return false;
    const now = new Date().getTime();
    const expiresAt = new Date(qrStatus.qr_code_expires_at).getTime();
    return now >= expiresAt;
  };

  // 获取用户登录状态
  const fetchQRStatus = async () => {
    try {
      const response = await fetch(`/api/user-login-status/${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setQrStatus(data);
      }
    } catch (error) {
      console.error('获取登录状态失败:', error);
    }
  };

  // 保存二维码图片到本地
  const handleSaveQRCode = () => {
    if (!qrStatus?.qr_code_image) {
      toast({
        title: '保存失败',
        description: '没有可保存的二维码图片',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      // 将base64转换为blob
      const base64Data = qrStatus.qr_code_image;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qrcode-${user?.id || 'user'}-${new Date().getTime()}.png`;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      URL.revokeObjectURL(url);

      toast({
        title: '保存成功',
        description: '二维码图片已保存到本地',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('保存二维码失败:', error);
      toast({
        title: '保存失败',
        description: '保存二维码时发生错误，请重试',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 开始等待登录
  const handleStartWaiting = async () => {
    setWaiting(true);
    try {
      // 调用API设置qr_code_status为Waitting
      const response = await fetch(`/api/user-login-status/${user?.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_code_status: 'Waitting'
        }),
      });

      if (response.ok) {
        toast({
          title: '开始等待登录',
          description: '已设置为等待状态，15秒后检查登录结果...',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });

        // 立即更新状态
        await fetchQRStatus();

        // 15秒后检查状态
        setTimeout(async () => {
          try {
            const checkResponse = await fetch(`/api/user-login-status/${user?.id}`);
            if (checkResponse.ok) {
              const latestData = await checkResponse.json();
              
              // 直接设置最新数据，触发重新渲染
              setQrStatus({ ...latestData });
              
              if (latestData.qr_code_status === 'generated') {
                toast({
                  title: '等待登录',
                  description: '用户还未登录成功，请继续等待或重新尝试',
                  status: 'warning',
                  duration: 5000,
                  isClosable: true,
                });
              } else if (latestData.qr_code_status === 'scanned') {
                toast({
                  title: '登录成功！',
                  description: '用户已成功登录',
                  status: 'success',
                  duration: 5000,
                  isClosable: true,
                });
              }
            }
          } catch (error) {
            console.error('检查登录状态失败:', error);
            toast({
              title: '检查失败',
              description: '无法检查登录状态，请手动刷新',
              status: 'error',
              duration: 3000,
              isClosable: true,
            });
          } finally {
            setWaiting(false);
          }
        }, 15000);
      } else {
        throw new Error('设置等待状态失败');
      }
    } catch (error) {
      toast({
        title: '错误',
        description: '设置等待状态失败，请重试',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setWaiting(false);
    }
  };


  // 新增：二维码过期倒计时
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (qrStatus?.qr_code_expires_at) {
      const updateCountdown = () => {
        const now = new Date().getTime();
        const expiresAt = new Date(qrStatus.qr_code_expires_at).getTime();
        const timeLeft = expiresAt - now;

        if (timeLeft > 0) {
          const minutes = Math.floor(timeLeft / (1000 * 60));
          const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
          setExpiresIn(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        } else {
          setExpiresIn('已过期');
          clearInterval(interval);
        }
      };

      // 立即执行一次
      updateCountdown();
      interval = setInterval(updateCountdown, 1000);
    } else {
      setExpiresIn('');
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [qrStatus?.qr_code_expires_at, qrStatus?.id]); // 添加qrStatus.id作为依赖确保状态更新时重新计算

  // 初始加载 
  useEffect(() => {
    if (user?.id) {
      fetchQRStatus();
      // 页面加载时显示提示框
      onOpen();
    }
  }, [user?.id, onOpen]);

  // 获取状态显示文本
  const getStatusText = () => {
    if (!qrStatus) return '未生成';
    
    switch (qrStatus.qr_code_status) {
      case 'generated':
        return '已生成';
      case 'scanned':
        return '已扫描';
      case 'expired':
        return '已过期';
      default:
        return '未知状态';
    }
  };

  // 获取状态颜色
  const getStatusColor = () => {
    if (!qrStatus) return 'gray';
    
    switch (qrStatus.qr_code_status) {
      case 'generated':
        return 'blue';
      case 'scanned':
        return 'green';
      case 'expired':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Box p={6} maxW="600px" mx="auto">
      <VStack spacing={6} align="stretch">
        <Heading size="lg" textAlign="center" color="gray.800">
          用户登录二维码
        </Heading>
        
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <Text color="gray.600" textAlign="center">
                使用移动设备扫描二维码进行登录验证
              </Text>
              
              <Divider />
              
              {qrStatus && (
                <VStack spacing={3}>
                  
                  {qrStatus.qr_code_expires_at && (
                    <Text fontSize="sm" color={expiresIn === '已过期' ? 'red.500' : 'green.500'}>
                      过期倒计时: {expiresIn}
                    </Text>
                  )}
                </VStack>
              )}
              
              {qrStatus?.qr_code_image && (
                <Box textAlign="center">
                  <Box position="relative" display="inline-block">
                    <Image 
                      src={`data:image/png;base64,${qrStatus.qr_code_image}`}
                      alt="登录二维码" 
                      width="200px"
                      height="200px"
                      borderRadius="md"
                      opacity={isQRCodeExpired() ? 0.4 : 1}
                      objectFit="cover"
                      style={{
                         imageRendering: 'pixelated',
                         filter: isQRCodeExpired() ? 'blur(3px)' : 'none',
                         transition: 'filter 0.3s ease',
                         padding: '8px',
                         backgroundColor: 'white'
                       }}
                    />
                    {isQRCodeExpired() && (
                      <Box position="absolute" top="0" left="0" right="0" bottom="0" bg="rgba(255, 255, 255, 0.8)" display="flex" alignItems="center" justifyContent="center" borderRadius="md" zIndex={2}>
                        <VStack spacing={3}>
                          <Text fontSize="lg" color="red.700" fontWeight="bold">二维码已过期</Text>
                        </VStack>
                      </Box>
                    )}
                    {waiting && (
                      <Box
                        position="absolute"
                        top="0"
                        left="0"
                        right="0"
                        bottom="0"
                        bg="rgba(0, 0, 0, 0.7)"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        borderRadius="md"
                        zIndex={10}
                      >
                        <VStack spacing={2}>
                          <Spinner size="lg" color="white" />
                          <Text color="white" fontSize="sm">等待登录中...</Text>
                        </VStack>
                      </Box>
                    )}
                  </Box>
                  <VStack spacing={2} mt={2}>
                    <Text fontSize="sm" color="gray.600">
                      二维码状态: <Badge colorScheme={getStatusColor()}>{getStatusText()}</Badge>
                    </Text>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="outline"
                      onClick={handleSaveQRCode}
                      leftIcon={<DownloadIcon />}
                    >
                      保存二维码
                    </Button>
                  </VStack>
                </Box>
              )}
              
              {qrStatus?.qr_code_status === 'scanned' && (
                <Alert status="success">
                  <AlertIcon />
                  登录验证成功！
                </Alert>
              )}
              
              <HStack spacing={4} justify="center" w="full">
                <Button
                  colorScheme="blue"
                  onClick={handleStartWaiting}
                  isLoading={waiting}
                  loadingText="等待中..."
                  disabled={waiting}
                >
                  验证登录
                </Button>
              </HStack>
              
              {waiting && (
                <Alert status="info">
                  <AlertIcon />
                  <VStack spacing={1} align="start">
                    <Text>正在等待用户登录...</Text>
                    <Text fontSize="sm" color="gray.600">15秒后自动检查登录状态</Text>
                  </VStack>
                </Alert>
              )}
              
              {/* 自动更新状态提示已移除 */}
            </VStack>
          </CardBody>
        </Card>
        

      </VStack>
      
      {/* 提示框 */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size={{ base: "sm", md: "md" }}>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(10px)" />
        <ModalContent 
          mx={4}
          borderRadius="xl"
          boxShadow="xl"
          bg="white"
          border="1px solid"
          borderColor="blue.100"
        >
          <ModalHeader 
            pb={2}
            borderBottom="1px solid"
            borderColor="gray.100"
            borderTopRadius="xl"
            bg="gradient(to-r, blue.50, purple.50)"
          >
            <Flex align="center" gap={3}>
              <Icon as={InfoIcon} color="blue.500" boxSize={5} />
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="600" color="gray.700">
                使用提示
              </Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton 
            size="lg"
            color="gray.500"
            _hover={{ bg: "gray.100", color: "gray.700" }}
          />
          <ModalBody py={6} px={6}>
            <VStack spacing={4} align="start">
              <Box 
                p={4} 
                bg="blue.50" 
                borderRadius="lg" 
                border="1px solid" 
                borderColor="blue.200"
                w="full"
              >
                <Text 
                  fontSize={{ base: "md", md: "lg" }}
                  lineHeight="1.6"
                  color="gray.700"
                  textAlign="center"
                >
                  点击
                  <Text as="span" fontWeight="bold" color="blue.600" mx={1}>
                    验证登录
                  </Text>
                  获取登录二维码，扫码成功之后需要再次点击
                  <Text as="span" fontWeight="bold" color="blue.600" mx={1}>
                    验证登录
                  </Text>
                  来确认登录是否成功。
                </Text>
              </Box>
              <Box w="full" textAlign="center">
                <Text fontSize="sm" color="gray.500">
                  💡 提示：此对话框可随时关闭
                </Text>
              </Box>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default QRCodeLogin;