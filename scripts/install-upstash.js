import { execSync } from 'child_process'

try {
  console.log('[v0] Installing @upstash/redis...')
  const result = execSync('cd /vercel/share/v0-project && pnpm add @upstash/redis', {
    encoding: 'utf8',
    stdio: 'pipe',
  })
  console.log('[v0] Output:', result)
  console.log('[v0] @upstash/redis installed successfully.')
} catch (err) {
  console.error('[v0] Error installing package:', err.message)
  console.error('[v0] stderr:', err.stderr)
}
