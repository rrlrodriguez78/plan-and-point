import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
  .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula')
  .regex(/[0-9]/, 'Debe incluir al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial (!@#$%^&*)');

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  try {
    passwordSchema.parse(password);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return { valid: false, errors: ['Error de validación desconocido'] };
  }
};

export const getPasswordRequirements = () => [
  { label: 'Mínimo 12 caracteres', regex: /.{12,}/ },
  { label: 'Al menos una mayúscula (A-Z)', regex: /[A-Z]/ },
  { label: 'Al menos una minúscula (a-z)', regex: /[a-z]/ },
  { label: 'Al menos un número (0-9)', regex: /[0-9]/ },
  { label: 'Al menos un carácter especial (!@#$%^&*)', regex: /[^A-Za-z0-9]/ },
];

export const checkPasswordStrength = (password: string): {
  requirement: string;
  met: boolean;
}[] => {
  const requirements = getPasswordRequirements();
  return requirements.map(req => ({
    requirement: req.label,
    met: req.regex.test(password)
  }));
};
