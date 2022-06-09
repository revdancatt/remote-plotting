const path = require('path')
const fs = require('fs')

exports.index = async (req, res) => {
  const startTime = new Date().getTime()

  //  Grab the downloads folder
  const downloadDir = process.env.DOWNLOADSDIR

  //  Grab all the files inside it too
  const svgFiles = fs.readdirSync(downloadDir).filter((file) => {
    return fs.statSync(path.join(downloadDir, file)).isFile()
  }).filter((file) => {
    return file[0] !== '.'
  }).filter((file) => {
    const extensionSplit = file.split('.')
    const extension = extensionSplit.pop()
    return extension === 'svg'
  })

  req.templateValues.svgFiles = svgFiles
  console.log(svgFiles)

  req.templateValues.elapsed = new Date().getTime() - startTime
  return res.render('downloadFolder/index', req.templateValues)
}
