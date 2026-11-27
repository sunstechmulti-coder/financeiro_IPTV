import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = process.cwd()
const base = process.env.BASE_SHA
if (!base || !/^[0-9a-f]{40}$/.test(base)) throw new Error('BASE_SHA deve conter o commit base da revisão.')
const temporary = mkdtempSync(join(tmpdir(), 'cashflow-types-'))
const compiler = resolve('node_modules/typescript/bin/tsc')
function diagnostics(cwd) {
  const result = spawnSync(process.execPath, [compiler, '--noEmit', '--pretty', 'false', '--incremental', 'false'], { cwd, encoding: 'utf8' })
  if (result.error) throw result.error
  const output = (result.stdout || '') + (result.stderr || '')
  if (result.status && !output.includes('error TS')) throw new Error(output || 'Falha ao executar TypeScript')
  return output.split('\n').filter(line => line.includes('error TS')).map(line => line.replace(/\(\d+,\d+\)/g, ''))
}
try {
  const archive = join(temporary, 'baseline.tar')
  execFileSync('git', ['archive', '--output', archive, base])
  execFileSync('tar', ['-xf', archive, '-C', temporary])
  symlinkSync(resolve('node_modules'), join(temporary, 'node_modules'), 'dir')
  const before = diagnostics(temporary)
  const after = diagnostics(root)
  const remaining = [...before]
  const added = after.filter(line => {
    const index = remaining.indexOf(line)
    if (index < 0) return true
    remaining.splice(index, 1)
    return false
  })
  console.log('Diagnósticos existentes na base: ' + before.length)
  console.log('Diagnósticos na branch: ' + after.length)
  if (added.length) {
    console.error('Novos erros de TypeScript:\n' + added.join('\n'))
    process.exitCode = 1
  } else console.log('Nenhum novo erro de TypeScript.')
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
