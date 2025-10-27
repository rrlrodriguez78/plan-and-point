-- Fix: Restrict commands and golden_rules tables to super admins only

-- Commands table
DROP POLICY IF EXISTS "Authenticated users can insert commands" ON commands;
DROP POLICY IF EXISTS "Authenticated users can update commands" ON commands;
DROP POLICY IF EXISTS "Authenticated users can delete commands" ON commands;
DROP POLICY IF EXISTS "Authenticated users can view commands" ON commands;

CREATE POLICY "Super admins can manage commands"
ON commands FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "All users can view commands"
ON commands FOR SELECT
USING (true);

-- Golden rules table
DROP POLICY IF EXISTS "Authenticated users can insert golden rules" ON golden_rules;
DROP POLICY IF EXISTS "Authenticated users can update golden rules" ON golden_rules;
DROP POLICY IF EXISTS "Authenticated users can delete golden rules" ON golden_rules;
DROP POLICY IF EXISTS "Golden rules are viewable by everyone" ON golden_rules;

CREATE POLICY "Super admins can manage golden rules"
ON golden_rules FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "All users can view golden rules"
ON golden_rules FOR SELECT
USING (true);