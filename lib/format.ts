export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function getMonthYear(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function parseCurrencyInput(value: string): number {
  // Remove currency symbol, spaces, and convert comma to dot
  const cleaned = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

export function formatCurrencyInput(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
