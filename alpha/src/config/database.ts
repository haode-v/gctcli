// 数据库配置文件
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// 默认数据库配置
const defaultConfig: DatabaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'alpha_monitor',
  user: 'postgres',
  password: 'password'
};

// 从环境变量获取数据库配置
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.REACT_APP_DB_HOST || defaultConfig.host,
    port: parseInt(process.env.REACT_APP_DB_PORT || defaultConfig.port.toString()),
    database: process.env.REACT_APP_DB_NAME || defaultConfig.database,
    user: process.env.REACT_APP_DB_USER || defaultConfig.user,
    password: process.env.REACT_APP_DB_PASSWORD || defaultConfig.password
  };
}