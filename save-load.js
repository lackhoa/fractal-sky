let fileInput = e("input", {type:"file", accept:".json", onChange:readSingleFile});
// Gotta do this due to HTML BS
function triggerUpload(evt) {fileInput.click()}

// Load the saved contents
function loadComplete(evt) {// Note: currently can only load 2D shapes
  let contents = JSON.parse(evt.target.result);
  clearSvg();
  log(contents);
  contents.map((mold) => {new Shape(mold).register()});
  // We will not allow undoing save-load for now (I mean when would you need that?)
  undoStack.length = 0;
  redoStack.length = 0;
  updateUndoUI();}

// Event listener for when the user uploaded a file
function readSingleFile(evt) {
  let file = evt.target.files[0];
  let reader = new FileReader();
  reader.onload = loadComplete;
  reader.readAsText(file);
  // Clears the last filename(s) so loading the same file will trigger the "changed" event again.
  evt.target.value = "";}

function removeChildren(node) {
  while (node.firstChild) {node.removeChild(node.firstChild)}}

function clearSvg() {
  removeChildren(shapes);
  removeChildren(boxes);
  removeChildren(controls);
  shapeList.length = 0;}

function saveDiagram() {
  let json = shapeList.filter((s) => s.getActive()).map((s) => serialize(s));
  let blob = new Blob([JSON.stringify(json)], { "type": "text/json" });
  saveAs(blob, "diagram.json");}
