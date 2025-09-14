-- Add avg_price column to strategies table
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS avg_price DECIMAL;

-- Add comment for the new column
COMMENT ON COLUMN strategies.avg_price IS 'Average price for the strategy in USDT';