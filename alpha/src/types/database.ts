// 数据库表类型定义

// 用户表类型
export interface User {
  id: number;
  username: string;
  uuid: string | null;
  password_hash: string;
  admin_id: number | null;
  created_at: string;
  mobile: string | null;
  email: string | null;
  nickname: string | null;
  status: string;
  login_status: string;
  qr_code_status: string;
}

// 订单方向和状态枚举
export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum OrderStatus {
  PENDING_SUBMIT = 'PENDING_SUBMIT',
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED'
}

// 订单表类型
export interface Order {
  id: number;
  user_id: number;
  uuid: string;
  email: string;
  exchange_order_id: string | null;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  side: OrderSide;
  quantity_requested: string;
  price_requested: string;
  quantity_executed: string;
  price_executed: string | null;
  status: OrderStatus;
  api_response_code: string | null;
  api_response_message: string | null;
  created_at: string;
  updated_at: string;
  exchange_timestamp: string | null;
}

// 资产变更类型枚举
export enum AssetChangeType {
  TRADE = 'TRADE',
  SYNC = 'SYNC',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  FEE = 'FEE'
}

// 用户资产表类型
export interface UserAsset {
  id: number;
  uuid: string;
  email: string;
  asset: string;
  wallet_type: string;
  available: string;
  locked: string;
  frozen: string;
  withdrawing: string;
  valuation: string;
  last_updated_at: string;
}

// 资产历史记录表类型
export interface AssetHistory {
  id: number;
  user_asset_id: number;
  change_type: AssetChangeType;
  change_amount: string;
  balance_before: string;
  balance_after: string;
  related_order_id: string | null;
  notes: string | null;
  created_at: string;
}

// 策略表类型
export interface Strategy {
  id: number;
  name: string;
  symbol: string;
  status: string;
  funding_type: string;
  funding_value: string;
  profit_margin_percent: string;
  stop_loss_percent: string | null;
  start_time: string | null;
  end_time: string | null;
  max_total_volume_usdt: string | null;
  avg_price: string | null;
  fee_buffer_quantity: number;
  created_at: string;
  updated_at: string;
}

// 交易表类型
export interface Trade {
  id: number;
  strategy_id: number;
  symbol: string;
  status: string;
  buy_order_id: string | null;
  buy_price: string | null;
  buy_quantity: string | null;
  buy_quote_quantity: string;
  buy_timestamp: string | null;
  sell_order_id: string | null;
  sell_price: string | null;
  sell_quantity: string | null;
  sell_target_price: string | null;
  sell_timestamp: string | null;
  user_id: number;
  pnl: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// 用户策略跟踪表类型
export interface UserStrategyTracking {
  user_id: number;
  strategy_id: number;
  initial_balance: string;
  consumed_amount: string;
  current_balance: string;
  achieved_trade_volume: string;
  fee_buffer_quantity: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Alpha资产表类型
export interface AlphaAsset {
  id: number;
  user_uuid: string;
  token_id: string;
  symbol: string;
  name: string;
  chain_id: number;
  contract_address: string;
  cex_asset: boolean;
  available: string;
  frozen: string;
  locked: string;
  withdrawing: string;
  amount: string;
  valuation: string;
  created_at: string;
  updated_at: string;
}

// 数据库事件类型
export interface DatabaseEvent {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: string;
}