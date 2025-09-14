import { extendTheme } from '@chakra-ui/react';

// 自定义主题配置 - 白色为主，绿色为辅
const theme = extendTheme({
  colors: {
    brand: {
      50: '#f0fff4',
      100: '#c6f6d5',
      200: '#9ae6b4',
      300: '#68d391',
      400: '#48bb78',
      500: '#38a169',
      600: '#2f855a',
      700: '#276749',
      800: '#22543d',
      900: '#1a202c',
    },
    gray: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
    },
  },
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
  },
  styles: {
    global: {
      body: {
        bg: 'white',
        color: 'gray.800',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
          _hover: {
            bg: 'brand.600',
          },
        },
        outline: {
          borderColor: 'brand.500',
          color: 'brand.500',
          _hover: {
            bg: 'brand.50',
          },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'white',
          boxShadow: 'sm',
          border: '1px',
          borderColor: 'gray.200',
          borderRadius: 'lg',
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            borderColor: 'gray.200',
            color: 'gray.600',
            fontSize: 'sm',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
          },
          td: {
            borderColor: 'gray.200',
          },
        },
      },
    },
    Badge: {
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
        },
        outline: {
          borderColor: 'brand.500',
          color: 'brand.500',
        },
      },
    },
  },
});

export default theme;