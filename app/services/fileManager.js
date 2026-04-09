import fs from 'node:fs/promises'
import syncFs from 'node:fs'
import path from 'node:path'

function toPosixPath (value) {
  return value.split(path.sep).join('/')
}

function sanitizeRelativePath (value = '') {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  return trimmed
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.\.+/g, '')
}

class FileManager {
  constructor ({ baseDir }) {
    this.baseDir = path.resolve(baseDir)
    if (!syncFs.existsSync(this.baseDir)) {
      throw new Error(`SVGDIR does not exist: ${this.baseDir}`)
    }
  }

  resolveSafePath (relativePath = '') {
    const sanitized = sanitizeRelativePath(relativePath)
    const absolutePath = path.resolve(this.baseDir, sanitized)
    if (!absolutePath.startsWith(this.baseDir)) {
      throw new Error('Invalid path')
    }
    return absolutePath
  }

  toRelativePath (absolutePath) {
    const relative = path.relative(this.baseDir, absolutePath)
    return toPosixPath(relative === '.' ? '' : relative)
  }

  async list (relativeDir = '') {
    const safeDir = sanitizeRelativePath(relativeDir)
    const absoluteDir = this.resolveSafePath(safeDir)
    const stats = await fs.stat(absoluteDir)
    if (!stats.isDirectory()) throw new Error('Requested path is not a directory')

    const dirents = await fs.readdir(absoluteDir, { withFileTypes: true })
    const directories = []
    const files = []

    for (const dirent of dirents) {
      if (dirent.name.startsWith('.')) continue
      const absoluteItem = path.join(absoluteDir, dirent.name)
      const relativeItem = this.toRelativePath(absoluteItem)

      if (dirent.isDirectory()) {
        directories.push({
          name: dirent.name,
          relativePath: toPosixPath(relativeItem)
        })
        continue
      }

      if (!dirent.isFile()) continue
      if (!dirent.name.toLowerCase().endsWith('.svg')) continue

      const fileStats = await fs.stat(absoluteItem)
      files.push({
        name: dirent.name,
        relativePath: toPosixPath(relativeItem),
        size: fileStats.size,
        modifiedAt: fileStats.mtime.toISOString()
      })
    }

    directories.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))

    let parentDir = null
    if (safeDir) {
      const parent = path.dirname(safeDir)
      parentDir = parent === '.' ? '' : toPosixPath(parent)
    }

    return {
      currentDir: safeDir,
      parentDir,
      directories,
      files
    }
  }

  async saveUploadedFile ({ buffer, fileName, relativeDir = '' }) {
    const safeName = path.basename(fileName)
    const targetDir = this.resolveSafePath(relativeDir)
    await fs.mkdir(targetDir, { recursive: true })
    const destination = path.join(targetDir, safeName)
    await fs.writeFile(destination, buffer)
    return {
      name: safeName,
      relativePath: this.toRelativePath(destination)
    }
  }

  async deleteFile (relativePath) {
    const target = this.resolveSafePath(relativePath)
    await fs.rm(target)
  }

  async createDirectory ({ dir = '', name = '' }) {
    const safeName = path.basename(String(name).trim())
    if (!safeName) throw new Error('Directory name is required')
    const parentDir = this.resolveSafePath(dir)
    const fullPath = path.join(parentDir, safeName)
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Invalid directory path')
    }
    await fs.mkdir(fullPath, { recursive: false })
    return {
      name: safeName,
      relativePath: this.toRelativePath(fullPath)
    }
  }
}

export function createFileManager ({ baseDir }) {
  return new FileManager({ baseDir })
}
