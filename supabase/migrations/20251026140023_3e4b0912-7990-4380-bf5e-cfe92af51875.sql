-- Fix search_path for share functions
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token TEXT;
  exists_token BOOLEAN;
BEGIN
  LOOP
    token := encode(gen_random_bytes(6), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := substring(token, 1, 8);
    
    SELECT EXISTS(SELECT 1 FROM tour_shares WHERE share_token = token) INTO exists_token;
    
    EXIT WHEN NOT exists_token;
  END LOOP;
  
  RETURN token;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_share_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tour_shares
  SET view_count = view_count + 1
  WHERE share_token = NEW.session_id
  AND EXISTS (SELECT 1 FROM tour_shares WHERE share_token = NEW.session_id);
  
  RETURN NEW;
END;
$$;