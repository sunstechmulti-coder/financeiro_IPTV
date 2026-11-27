import { mkdirSync, writeFileSync } from 'node:fs'
if (!process.env.CI) throw new Error('Fixture disponível somente durante os testes de CI.')
mkdirSync('app/__review', { recursive: true })
writeFileSync('app/__review/page.tsx', "export { default } from '../../tests/ui/review-fixture'\n")
