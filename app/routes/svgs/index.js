const path = require('path')
exports.index = async (req, res) => {
  // We want to serve the SVG from the folder to the client
  // First make the path
  let svgPath = path.join(process.env.SVGDIR, req.params.svgfile)
  if (req.params.newDir) {
    svgPath = path.join(process.env.SVGDIR, req.params.newDir, req.params.svgfile)
  }
  return res.sendFile(svgPath)
}
