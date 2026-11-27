import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const screenshots = fileURLToPath(new URL('./screenshots', import.meta.url))
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-27T12:00:00Z') })
  await page.goto('/__review')
  await expect(page.getByText('Novembro 2026', { exact: true })).toBeVisible()
})

async function openForm(page, description = 'Peça de teste') {
  await page.getByRole('button', { name: 'Nova venda 3D', exact: true }).click()
  await page.getByLabel('Descrição', { exact: true }).fill(description)
  await page.getByLabel('Valor (R$)', { exact: true }).fill('42,50')
}

test('captura os componentes reais do Dashboard, formulário e Analytics com dados fictícios', async ({ page }) => {
  mkdirSync(screenshots, { recursive: true })
  await page.screenshot({ path: join(screenshots, 'dashboard-consolidado.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Impressão 3D', exact: true }).click()
  await openForm(page, 'Chaveiros personalizados')
  await page.getByLabel('Cliente (opcional)', { exact: true }).fill('Cliente exemplo')
  await page.getByLabel('Peça / produto (opcional)', { exact: true }).fill('Chaveiro Pilates')
  await page.getByLabel('Pagamento (opcional)', { exact: true }).fill('Pix')
  await page.screenshot({ path: join(screenshots, 'formulario-3d.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: 'Analytics', exact: true }).click()
  await expect(page.getByText('Peças com maior receita', { exact: true })).toBeVisible()
  await page.screenshot({ path: join(screenshots, 'analytics-3d.png'), fullPage: true, animations: 'disabled' })
})

test('salva uma única venda fictícia mesmo com clique duplo', async ({ page }) => {
  await openForm(page)
  await page.getByRole('button', { name: 'Salvar lançamento 3D', exact: true }).dblclick()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('save-count')).toHaveText('1')
  await expect(page.getByText('Peça de teste', { exact: true })).toBeVisible()
})

test('falha de envio mantém o formulário e os dados digitados', async ({ page }) => {
  await page.getByLabel('Simular falha de envio (somente teste)').check()
  await openForm(page, 'Descrição preservada')
  await page.getByRole('button', { name: 'Salvar lançamento 3D', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar')
  await expect(page.getByLabel('Descrição', { exact: true })).toHaveValue('Descrição preservada')
  await expect(page.getByLabel('Valor (R$)', { exact: true })).toHaveValue('42,50')
  await expect(page.getByTestId('save-count')).toHaveText('0')
})

test('exporta metadados 3D e respeita aspas e separadores no CSV', async ({ page }) => {
  await page.getByRole('button', { name: 'Impressão 3D', exact: true }).click()
  await openForm(page, 'Peça; "Especial"')
  await page.getByLabel('Cliente (opcional)', { exact: true }).fill('Cliente; "A"')
  await page.getByRole('button', { name: 'Salvar lançamento 3D', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Transações', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click()
  const file = await downloadPromise
  const csv = readFileSync(await file.path(), 'utf8')
  expect(csv).toContain('"Cliente; ""A"""')
  expect(csv).toContain('"Peça; ""Especial"""')
  expect(csv).toContain('"Impressão 3D"')
  expect(csv).not.toContain('Vendas IPTV de exemplo')
})

test('PDF da visão 3D é gerado separadamente', async ({ page }) => {
  await page.getByRole('button', { name: 'Impressão 3D', exact: true }).click()
  await page.getByRole('button', { name: 'Analytics', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Gerar Relatório PDF', exact: true }).click()
  const file = await downloadPromise
  expect(file.suggestedFilename()).toBe('analytics-printing_3d-2026-11.pdf')
})
