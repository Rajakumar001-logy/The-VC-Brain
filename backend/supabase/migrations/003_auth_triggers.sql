-- Create trigger function to copy auth.users into public.investors
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_full_name TEXT;
  default_role public.investor_role;
BEGIN
  -- Extract values from user_metadata JSON
  default_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    'New Investor'
  );

  -- Cast metadata role to public.investor_role enum, fallback to 'analyst'
  BEGIN
    default_role := COALESCE(
      (new.raw_user_meta_data->>'role')::public.investor_role,
      'analyst'::public.investor_role
    );
  EXCEPTION WHEN OTHERS THEN
    default_role := 'analyst'::public.investor_role;
  END;

  INSERT INTO public.investors (
    auth_user_id,
    email,
    full_name,
    role,
    title,
    is_active
  )
  VALUES (
    new.id,
    new.email,
    default_full_name,
    default_role,
    INITCAP(default_role::text), -- title matches role name capitalized by default
    TRUE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function on user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
