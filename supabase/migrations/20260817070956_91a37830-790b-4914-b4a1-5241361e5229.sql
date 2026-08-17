
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');
CREATE TYPE public.token_status AS ENUM ('waiting', 'serving', 'completed', 'skipped', 'cancelled');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.raw_user_meta_data ->> 'phone');

  _role := CASE WHEN COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer') = 'admin'
                THEN 'admin'::public.app_role ELSE 'customer'::public.app_role END;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  avg_duration_minutes integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read" ON public.services FOR SELECT USING (true);
CREATE POLICY "admins manage services" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_number integer NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT 'Guest',
  status public.token_status NOT NULL DEFAULT 'waiting',
  queue_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  served_at timestamptz,
  completed_at timestamptz,
  UNIQUE (service_id, queue_date, token_number)
);
GRANT SELECT ON public.tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tokens TO authenticated;
GRANT ALL ON public.tokens TO service_role;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue public read" ON public.tokens FOR SELECT USING (true);
CREATE POLICY "customers book own token" ON public.tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customers update own token" ON public.tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage tokens" ON public.tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.book_token(_service_id uuid, _customer_name text)
RETURNS public.tokens LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _next integer;
  _row public.tokens;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT COALESCE(MAX(token_number), 0) + 1 INTO _next
  FROM public.tokens WHERE service_id = _service_id AND queue_date = CURRENT_DATE;

  INSERT INTO public.tokens (token_number, service_id, user_id, customer_name)
  VALUES (_next, _service_id, auth.uid(), COALESCE(NULLIF(trim(_customer_name), ''), 'Guest'))
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.book_token(uuid, text) TO authenticated;

INSERT INTO public.services (name, description, avg_duration_minutes) VALUES
  ('Aadhaar Update', 'Address, mobile number and biometric updates', 12),
  ('Certificate Application', 'Income, caste and residence certificates', 8),
  ('Bill Payment', 'Electricity, water and telecom bill payments', 5),
  ('Haircut & Grooming', 'Salon services for walk-in customers', 25),
  ('Doctor Consultation', 'General physician consultation', 15);

INSERT INTO public.tokens (token_number, service_id, customer_name, status, served_at, completed_at)
SELECT 1, id, 'Anjali R', 'completed', now() - interval '70 minutes', now() - interval '58 minutes' FROM public.services WHERE name = 'Aadhaar Update';
INSERT INTO public.tokens (token_number, service_id, customer_name, status, served_at, completed_at)
SELECT 2, id, 'Rahul K', 'completed', now() - interval '55 minutes', now() - interval '44 minutes' FROM public.services WHERE name = 'Aadhaar Update';
INSERT INTO public.tokens (token_number, service_id, customer_name, status, served_at)
SELECT 3, id, 'Meera S', 'serving', now() - interval '6 minutes' FROM public.services WHERE name = 'Aadhaar Update';
INSERT INTO public.tokens (token_number, service_id, customer_name, status)
SELECT 4, id, 'Vishnu P', 'waiting' FROM public.services WHERE name = 'Aadhaar Update';
INSERT INTO public.tokens (token_number, service_id, customer_name, status)
SELECT 5, id, 'Fathima N', 'waiting' FROM public.services WHERE name = 'Aadhaar Update';
INSERT INTO public.tokens (token_number, service_id, customer_name, status, served_at, completed_at)
SELECT 1, id, 'Joseph T', 'completed', now() - interval '40 minutes', now() - interval '34 minutes' FROM public.services WHERE name = 'Certificate Application';
INSERT INTO public.tokens (token_number, service_id, customer_name, status)
SELECT 2, id, 'Divya M', 'waiting' FROM public.services WHERE name = 'Certificate Application';
INSERT INTO public.tokens (token_number, service_id, customer_name, status)
SELECT 1, id, 'Arun B', 'waiting' FROM public.services WHERE name = 'Bill Payment';
INSERT INTO public.tokens (token_number, service_id, customer_name, status, served_at)
SELECT 1, id, 'Sneha V', 'serving', now() - interval '10 minutes' FROM public.services WHERE name = 'Doctor Consultation';
INSERT INTO public.tokens (token_number, service_id, customer_name, status)
SELECT 2, id, 'Kiran D', 'waiting' FROM public.services WHERE name = 'Doctor Consultation';
