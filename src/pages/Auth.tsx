import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { MapPin, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { passwordSchema } from '@/lib/passwordValidation';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();
  const { t } = useTranslation();
  const isLogin = location.pathname === '/login';

  const loginSchema = z.object({
    email: z.string().email({ message: t('auth.invalidEmail') }),
    password: z.string().min(1, { message: 'La contraseña es requerida' }),
  });

  const signupSchema = z.object({
    email: z.string().email({ message: t('auth.invalidEmail') }),
    password: passwordSchema,
    fullName: z.string().min(2, { message: t('auth.nameMinLength') }).max(100),
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const validated = loginSchema.parse(formData);
        const { error } = await signIn(validated.email, validated.password);
        
        if (error) {
          toast.error(error.message || t('auth.errorLogin'));
        } else {
          toast.success(t('auth.welcomeBack'));
          navigate('/app/tours');
        }
      } else {
        const validated = signupSchema.parse(formData);
        const { error } = await signUp(validated.email, validated.password, validated.fullName);
        
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error(t('auth.emailAlreadyRegistered'));
          } else {
            toast.error(error.message || t('auth.errorSignup'));
          }
        } else {
          toast.success('Cuenta creada exitosamente. Tu solicitud está pendiente de aprobación por el administrador. Te notificaremos cuando sea aprobada.', {
            duration: 6000,
          });
          navigate('/login');
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(t('auth.unexpectedError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <MapPin className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            {isLogin ? t('auth.login') : t('auth.signup')}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t('auth.fullName')}
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.email')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.password')}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? t('auth.loggingIn') : t('auth.creating')}
                </>
              ) : (
                isLogin ? t('auth.login') : t('auth.signup')
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {isLogin ? (
              <p>
                {t('auth.noAccount')}{' '}
                <Link to="/signup" className="text-primary hover:underline">
                  {t('auth.createOne')}
                </Link>
              </p>
            ) : (
              <p>
                {t('auth.haveAccount')}{' '}
                <Link to="/login" className="text-primary hover:underline">
                  {t('auth.loginLink')}
                </Link>
              </p>
            )}
          </div>

          <div className="mt-4 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              {t('auth.backToHome')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;