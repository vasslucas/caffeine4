import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { copyFile, mkdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
for (const [packageName, folder, files] of [
  ['@mercuryworkshop/epoxy-transport', 'epoxy', ['index.mjs']],
  ['@mercuryworkshop/scramjet', 'scramjet', ['scramjet.js', 'scramjet.wasm']],
  ['@mercuryworkshop/scramjet-controller', 'controller', ['controller.api.js', 'controller.inject.js', 'controller.sw.js']],
]) {
  const source = dirname(require.resolve(packageName))
  const destination = resolve('public', folder)
  await mkdir(destination, { recursive: true })
  for (const file of files) await copyFile(resolve(source, file), resolve(destination, file))
}
