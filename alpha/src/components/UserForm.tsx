import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  HStack,
  useToast,
  Alert,
  AlertIcon,
  FormErrorMessage,
  InputGroup,
  InputRightElement,
  IconButton
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { User } from '../types/database';
import { databaseService } from '../services/database';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  mode: 'create' | 'edit';
  onSuccess?: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ isOpen, onClose, user, mode, onSuccess }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    username: '',
    password_hash: '',
    admin_id: '',
    mobile: '',
    email: '',
    nickname: '',
    uuid: '',
    status: 'active'
  });

  // 当用户数据变化时更新表单
  useEffect(() => {
    if (mode === 'edit' && user) {
      setFormData({
        username: user.username || '',
        password_hash: '', // 编辑时不显示密码
        admin_id: user.admin_id?.toString() || '',
        mobile: user.mobile || '',
        email: user.email || '',
        nickname: user.nickname || '',
        uuid: user.uuid || '',
        status:  user.status ||'active'
      });
    } else {
      setFormData({
        username: '',
        password_hash: '',
        admin_id: '',
        mobile: '',
        email: '',
        nickname: '',
        uuid: '',
        status: 'active'
      });
    }
    setErrors({});
  }, [mode, user, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.username.trim()) {
      newErrors.username = '用户名不能为空';
    }
    
    if (mode === 'create' && !formData.password_hash.trim()) {
      newErrors.password_hash = '密码不能为空';
    }
    
    if (!formData.admin_id.trim()) {
      newErrors.admin_id = '管理员ID不能为空';
    }
    
    if (!formData.uuid.trim()) {
      newErrors.uuid = 'UUID不能为空';
    }
    
    if (!formData.nickname.trim()) {
      newErrors.nickname = '昵称不能为空';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = '邮箱不能为空';
    } else if (formData.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
      newErrors.email = '邮箱格式不正确';
    }
    
    if (!formData.mobile.trim()) {
      newErrors.mobile = '手机号不能为空';
    } else if (formData.mobile && !/^1[3-9]\d{9}$/.test(formData.mobile)) {
      newErrors.mobile = '手机号格式不正确（请输入11位有效手机号）';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const userData: any = {
        username: formData.username,
        admin_id: formData.admin_id ? parseInt(formData.admin_id) : null,
        mobile: formData.mobile || null,
        email: formData.email || null,
        nickname: formData.nickname || null,
        uuid: formData.uuid || null,
        status: formData.status
      };

      // 只在创建时或密码有值时包含密码
      if (mode === 'create' || formData.password_hash) {
        userData.password_hash = formData.password_hash;
      }

      if (mode === 'create') {
        await databaseService.createUser(userData);
        toast({
          title: '创建成功',
          description: '用户创建成功',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await databaseService.updateUser(user!.id, userData);
        toast({
          title: '更新成功',
          description: '用户信息更新成功',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      
      onClose();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: mode === 'create' ? '创建失败' : '更新失败',
        description: error.message || '操作失败',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {mode === 'create' ? '添加用户' : '编辑用户'}
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired isInvalid={!!errors.username}>
              <FormLabel>用户名</FormLabel>
              <Input
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="请输入用户名"
              />
              <FormErrorMessage>{errors.username}</FormErrorMessage>
            </FormControl>

            <FormControl isRequired={mode === 'create'} isInvalid={!!errors.password_hash}>
              <FormLabel>
                {mode === 'create' ? '密码' : '新密码（留空则不修改）'}
              </FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password_hash}
                  onChange={(e) => handleInputChange('password_hash', e.target.value)}
                  placeholder={mode === 'create' ? '请输入密码' : '留空则不修改密码'}
                />
                <InputRightElement>
                  <IconButton
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage>{errors.password_hash}</FormErrorMessage>
            </FormControl>

            <HStack spacing={4} width="100%">
              <FormControl isRequired isInvalid={!!errors.admin_id}>
                <FormLabel>管理员ID</FormLabel>
                <Input
                  type="number"
                  value={formData.admin_id}
                  onChange={(e) => handleInputChange('admin_id', e.target.value)}
                  placeholder="请输入管理员ID"
                />
                <FormErrorMessage>{errors.admin_id}</FormErrorMessage>
              </FormControl>

              <FormControl>
                <FormLabel>状态</FormLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  <option value="active">激活</option>
                  <option value="unauthenticated">未登录</option>
                  <option value="inactive">禁用</option>
                  
                </Select>
              </FormControl>
            </HStack>

            <FormControl isRequired isInvalid={!!errors.nickname}>
              <FormLabel>昵称</FormLabel>
              <Input
                value={formData.nickname}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                placeholder="请输入昵称"
              />
              <FormErrorMessage>{errors.nickname}</FormErrorMessage>
            </FormControl>

            <FormControl isRequired isInvalid={!!errors.email}>
              <FormLabel>邮箱</FormLabel>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="请输入邮箱地址"
              />
              <FormErrorMessage>{errors.email}</FormErrorMessage>
            </FormControl>

            <FormControl isRequired isInvalid={!!errors.mobile}>
              <FormLabel>手机号</FormLabel>
              <Input
                value={formData.mobile}
                onChange={(e) => handleInputChange('mobile', e.target.value)}
                placeholder="请输入11位手机号"
              />
              <FormErrorMessage>{errors.mobile}</FormErrorMessage>
            </FormControl>

            <FormControl isRequired isInvalid={!!errors.uuid}>
              <FormLabel>UUID</FormLabel>
              <Input
                value={formData.uuid}
                onChange={(e) => handleInputChange('uuid', e.target.value)}
                placeholder="请输入UUID"
              />
              <FormErrorMessage>{errors.uuid}</FormErrorMessage>
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            取消
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={loading}
            loadingText={mode === 'create' ? '创建中...' : '更新中...'}
          >
            {mode === 'create' ? '创建用户' : '更新用户'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default UserForm;