import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import netlify from '@netlify/vite-plugin'
import { execFileSync } from 'node:child_process'

// Netlify supplies COMMIT_REF and CONTEXT during deploys. Local builds use git.
function localCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const commit = process.env.COMMIT_REF || localCommit()
const deployment = process.env.CONTEXT || 'local'
const builtAt = new Date().toISOString()

export default defineConfig({
  plugins: [react(), netlify()],
  define: {
    'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(commit.slice(0, 8)),
    'import.meta.env.VITE_BUILD_CONTEXT': JSON.stringify(deployment),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(builtAt),
  },
})
