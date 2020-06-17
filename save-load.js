// https://w3c.github.io/FileAPI/
// https://stackoverflow.com/questions/3582671/how-to-open-a-local-disk-file-with-javascript
// Loading the file after it has been loaded doesn't trigger this event again because it's hooked up to "change", and the filename hasn't changed!
function readSingleFile(e) {
  var file = e.target.files[0];
  var reader = new FileReader();
  reader.onload = loadComplete;
  reader.readAsText(file);
  // Clears the last filename(s) so loading the same file will work again.
  document.getElementById(Constants.FILE_INPUT).value = "";}

function loadComplete(e) {
  var contents = e.target.result;
  // If we don't do this, it adds the elements, but they have to have unique ID's
  clearSvg();
  diagramModel.deserialize(contents);}

function clearSvg() {
  state.destroyAllButSurface();
  surfaceModel.setTranslation(0, 0);
  objectsModel.setTranslation(0, 0);
  diagramModel.clear();
  var node = Helpers.getElement(Constants.SVG_OBJECTS_ID);
  Helpers.removeChildren(node);}

// https://stackoverflow.com/questions/23582101/generating-viewing-and-saving-svg-client-side-in-browser
function saveSvg() {
  var json = diagramModel.serialize();
  var blob = new Blob([json], { 'type': "image/json" });

  // We're using https://github.com/eligrey/FileSaver.js/
  // but with the "export" (a require node.js thing) removed.
  // There are several forks of this, not sure if there's any improvements in the forks.
  saveAs(blob, Constants.FILENAME);}
