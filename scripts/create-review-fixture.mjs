import { mkdirSync, writeFileSync } from 'node:fs'
if (!process.env.CI) throw new Error('Fixture disponível somente durante os testes de CI.')
mkdirSync('app/review-finance', { recursive: true })
writeFileSync('app/review-finance/page.tsx', "export { default } from '../../tests/ui/review-fixture'\n")
