import { toastError, toastSuccess, toastWarning } from './toast.js'

function escapeHtml (value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderDirectoryList (data) {
  const rows = []
  if (data.parentDir !== null && data.parentDir !== undefined) {
    rows.push('<li><button class="button-link" type="button" data-dir-path="' + escapeHtml(data.parentDir) + '">..</button></li>')
  }
  for (const dir of data.directories) {
    rows.push(
      '<li><button class="button-link" type="button" data-dir-path="' + escapeHtml(dir.relativePath) + '">&#128193; ' + escapeHtml(dir.name) + '</button></li>'
    )
  }
  return rows.join('')
}

function renderSvgList (data) {
  if (!data.files.length) return ''
  return data.files.map((file) => {
    return '<li><button class="button-link file-select-button" type="button" data-file-path="' + escapeHtml(file.relativePath) + '">' + escapeHtml(file.name) + '</button>' +
      '<button class="button-icon danger" type="button" title="Delete file" data-delete-path="' + escapeHtml(file.relativePath) + '">&times;</button></li>'
  }).join('')
}

function buildBreadcrumb (currentDir) {
  let html = '<button class="button-link" type="button" data-dir-path="">Home</button>'
  if (currentDir) {
    const parts = currentDir.split('/')
    let accumulated = ''
    for (const part of parts) {
      accumulated += (accumulated ? '/' : '') + part
      html += '<span class="breadcrumb-separator">/</span>'
      html += '<button class="button-link" type="button" data-dir-path="' + escapeHtml(accumulated) + '">' + escapeHtml(part) + '</button>'
    }
  }
  return html
}

export function initFileBrowser ({
  getHighlightPath,
  onFilePicked,
  onFileDeleted,
  onListUpdate
}) {
  const directoryList = document.getElementById('directory-list')
  const svgList = document.getElementById('svg-list')
  const svgEmpty = document.getElementById('svg-empty')
  const dirsEmpty = document.getElementById('dirs-empty')
  const breadcrumb = document.getElementById('file-breadcrumb')
  const uploadForm = document.getElementById('upload-form')
  const uploadZone = document.getElementById('upload-zone')
  const mkdirForm = document.getElementById('mkdir-form')
  const sidebarPanel = document.getElementById('file-browser-panel')

  let currentDir = breadcrumb?.dataset.currentDir || ''
  const fileInput = uploadForm?.querySelector('input[type="file"]')

  async function extractErrorMessage (response, fallback) {
    const contentType = response.headers.get('content-type') || ''
    try {
      if (contentType.includes('application/json')) {
        const data = await response.json()
        return data.errorMessage || data.message || data.error || fallback
      }
      const text = (await response.text()).trim()
      return text || response.statusText || fallback
    } catch (_err) {
      return response.statusText || fallback
    }
  }

  async function uploadFile (file) {
    if (!file) return
    if (!/\.svg$/i.test(file.name)) {
      toastWarning('Only SVG files are supported')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('dir', currentDir)
    try {
      const response = await fetch('/api/files/upload', { method: 'POST', body: formData })
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Upload failed'))
      }
      toastSuccess(`Uploaded ${file.name}`)
      uploadForm?.reset()
      await refresh(currentDir)
    } catch (error) {
      toastError(error.message || 'Upload failed')
    }
  }

  function highlightSelected () {
    const path = typeof getHighlightPath === 'function' ? getHighlightPath() : null
    svgList.querySelectorAll('li').forEach((li) => {
      const btn = li.querySelector('[data-file-path]')
      li.classList.toggle('is-selected', btn?.dataset.filePath === path)
    })
  }

  async function refresh (dir = currentDir) {
    const response = await fetch(`/api/files?dir=${encodeURIComponent(dir)}`)
    const data = await response.json()
    currentDir = data.currentDir || ''
    breadcrumb.dataset.currentDir = currentDir
    breadcrumb.innerHTML = buildBreadcrumb(currentDir)
    directoryList.innerHTML = renderDirectoryList(data)

    const svgHtml = renderSvgList(data)
    svgList.innerHTML = svgHtml
    svgEmpty?.classList.toggle('hidden', data.files.length > 0)

    const dirCount = data.directories?.length || 0
    const hasParent = data.parentDir !== null && data.parentDir !== undefined
    const showDirEmpty = dirCount === 0 && !hasParent
    dirsEmpty?.classList.toggle('hidden', !showDirEmpty)

    highlightSelected()
    if (typeof onListUpdate === 'function') onListUpdate(data)
  }

  function syncHighlight () {
    highlightSelected()
  }

  /* ─── Drag-and-drop on upload zone ─── */
  if (uploadZone) {
    for (const evt of ['dragenter', 'dragover']) {
      uploadZone.addEventListener(evt, (e) => {
        e.preventDefault()
        uploadZone.classList.add('is-dragover')
      })
    }
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('is-dragover')
    })
    uploadZone.addEventListener('drop', async (e) => {
      e.preventDefault()
      uploadZone.classList.remove('is-dragover')
      const file = e.dataTransfer?.files?.[0]
      if (!file) return
      await uploadFile(file)
    })
  }

  /* ─── Click-to-pick: native file input auto-submits on change ─── */
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    await uploadFile(file)
  })

  /* ─── Sidebar collapse (panel + grid column — see .dashboard-layout--sidebar-collapsed) ─── */
  const dashboardLayout = sidebarPanel?.closest('.dashboard-layout')
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="toggle-sidebar"]')) {
      sidebarPanel?.classList.toggle('is-collapsed')
      dashboardLayout?.classList.toggle('dashboard-layout--sidebar-collapsed')
    }
  })

  /* ─── Global click delegation ─── */
  document.addEventListener('click', async (event) => {
    const dirButton = event.target.closest('[data-dir-path]')
    if (dirButton && sidebarPanel?.contains(dirButton)) {
      event.preventDefault()
      await refresh(dirButton.dataset.dirPath || '')
      return
    }

    const fileButton = event.target.closest('[data-file-path]')
    if (fileButton && sidebarPanel?.contains(fileButton)) {
      event.preventDefault()
      const path = fileButton.dataset.filePath
      if (typeof onFilePicked === 'function') onFilePicked(path)
      highlightSelected()
      return
    }

    const deleteButton = event.target.closest('[data-delete-path]')
    if (deleteButton && sidebarPanel?.contains(deleteButton)) {
      event.preventDefault()
      const relativePath = deleteButton.dataset.deletePath
      const fileName = relativePath.split('/').pop()
      toastWarning(`Deleting ${fileName}…`)
      try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(relativePath)}`, { method: 'DELETE' })
        if (!response.ok) {
          throw new Error(await extractErrorMessage(response, 'Delete failed'))
        }
        if (typeof onFileDeleted === 'function') onFileDeleted(relativePath)
        await refresh(currentDir)
        toastSuccess(`Deleted ${fileName}`)
      } catch (error) {
        toastError(error.message || 'Delete failed')
      }
      return
    }

    if (event.target?.dataset?.action === 'refresh-files') {
      event.preventDefault()
      await refresh(currentDir)
    }
  })

  /* ─── Upload via form (Enter-key fallback when input has a file) ─── */
  uploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const file = fileInput?.files?.[0]
    if (!file) return
    await uploadFile(file)
  })

  /* ─── Mkdir ─── */
  mkdirForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = new FormData(mkdirForm)
    const name = String(form.get('name') || '').trim()
    if (!name) return
    try {
      const response = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: currentDir, name })
      })
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, 'Could not create folder'))
      }
      toastSuccess(`Created folder "${name}"`)
      mkdirForm.reset()
      await refresh(currentDir)
    } catch (error) {
      toastError(error.message || 'Could not create folder')
    }
  })

  return {
    refresh,
    syncHighlight,
    getCurrentDir: () => currentDir
  }
}
