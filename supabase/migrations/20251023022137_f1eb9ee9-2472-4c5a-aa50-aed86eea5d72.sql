-- Add capture_date field to floor_plans table
ALTER TABLE floor_plans 
ADD COLUMN capture_date DATE DEFAULT CURRENT_DATE;

-- Add index for efficient date-based queries
CREATE INDEX idx_floor_plans_date ON floor_plans(capture_date DESC);