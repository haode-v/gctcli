import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  InputGroup,
  InputRightElement,
  useToast,
  Flex,
  Image,
  Icon
} from '@chakra-ui/react';
import { MdDashboard } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        toast({
          title: '登录成功',
          description: '欢迎回来！',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        setError('用户名或密码错误');
      }
    } catch (error) {
      setError('登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bg="gray.50"
      px={4}
    >
      <Box maxW="md" w="full">
        <VStack spacing={8} align="stretch">
          {/* Logo和标题 */}
          <VStack spacing={4}>
            <Box
              p={4}
              borderRadius="full"
              bg="blue.500"
              color="white"
              fontSize="3xl"
            >
              <Icon as={MdDashboard as any} boxSize={8} />
            </Box>
            <VStack spacing={2}>
              <Heading size="lg" color="gray.800" textAlign="center">
                Alpha Monitor
              </Heading>
              <Text color="gray.600" textAlign="center" fontSize="sm">
                PostgreSQL 数据库实时监控面板
              </Text>
            </VStack>
          </VStack>

          {/* 登录表单 */}
          <Card
            bg="white"
            boxShadow="xl"
            borderRadius="xl"
            border="1px solid"
            borderColor="gray.100"
          >
            <CardBody p={8}>
              <form onSubmit={handleSubmit}>
                <VStack spacing={6}>
                  <Heading size="md" color="gray.800" textAlign="center">
                    登录到您的账户
                  </Heading>

                  {error && (
                    <Alert status="error" borderRadius="md">
                      <AlertIcon />
                      {error}
                    </Alert>
                  )}

                  <FormControl isRequired>
                    <FormLabel color="gray.700" fontWeight="medium">
                      用户名
                    </FormLabel>
                    <InputGroup>

                      <Input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        bg="white"
                        border="2px solid"
                        borderColor="gray.200"
                        _hover={{ borderColor: "blue.300" }}
                        _focus={{
                          borderColor: "blue.500",
                          boxShadow: "0 0 0 1px #3182ce"
                        }}
                        size="lg"
                      />
                    </InputGroup>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel color="gray.700" fontWeight="medium">
                      密码
                    </FormLabel>
                    <InputGroup>

                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码"
                        bg="white"
                        border="2px solid"
                        borderColor="gray.200"
                        _hover={{ borderColor: "blue.300" }}
                        _focus={{
                          borderColor: "blue.500",
                          boxShadow: "0 0 0 1px #3182ce"
                        }}
                        size="lg"
                      />
                      <InputRightElement>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? '隐藏' : '显示'}
                        </Button>
                      </InputRightElement>
                    </InputGroup>
                  </FormControl>

                  <Button
                    type="submit"
                    colorScheme="blue"
                    size="lg"
                    w="full"
                    isLoading={isLoading}
                    loadingText="登录中..."
                    _hover={{
                      transform: 'translateY(-1px)',
                      boxShadow: 'lg'
                    }}
                    transition="all 0.2s"
                  >
                    登录
                  </Button>
                </VStack>
              </form>
            </CardBody>
          </Card>
        </VStack>
      </Box>
    </Flex>
  );
};

export default LoginForm;