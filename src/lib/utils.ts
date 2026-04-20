import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(value: string) {
  let numbers = value.replace(/\D/g, '');
  
  if (numbers.startsWith('55') && numbers.length > 11) {
    numbers = numbers.substring(2);
  }

  // Regra do 9: se tiver 10 dígitos (DDD + 8 números), insere o 9
  if (numbers.length === 10) {
    numbers = numbers.substring(0, 2) + '9' + numbers.substring(2);
  }

  if (numbers.length > 11) numbers = numbers.substring(0, 11);

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.substring(0, 2)}) ${numbers.substring(2)}`;
  if (numbers.length <= 10) return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 6)}-${numbers.substring(6)}`;
  return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7)}`;
}

export function formatCPF(value: string) {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
