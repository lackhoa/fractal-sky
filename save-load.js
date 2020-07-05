let fileInput = e("input", {type:"file", accept:".json", onChange:readSingleFile});
// Gotta do this due to HTML BS
function triggerUpload(evt) {fileInput.click()}

function serialize(shape) {
  if (shape.type == "frame") {
    let [a,b,c,d,e,f] = shape.model.get("transform");
    return {xform: [a/D,b/D, c/D,d/D, e,f],
            type:"frame"};}
  else {
    return {...shape.model.getAll(),
            type:"shape", tag:shape.tag};}}

// Load the saved contents
function loadComplete(evt) {
  let contents = JSON.parse(evt.target.result);
  clearSvg();
  log(contents);
  contents.map(({type, ...mold}) => {newShape(type, mold)});
  // We don't allow undoing save/load for now (when'd you need that?)
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
  while (node.firstChild) {
    node.removeChild(node.firstChild)}}

function clearSvg() {
  // Empty the DOM
  for (s of shapeList.concat(frameList)) {
    s.deregister()}

  // removeChildren(boxLayer);
  // removeChildren(controlLayer);
  // removeChildren(axesLayer);
  // // The root still needs its shapes and frames
  // removeChildren(frameShapes(root));
  // removeChildren(frameNested(root));
  // Empty the lists
  shapeList.length = 0;
  frameList.length = 0;}

function saveDiagram() {
  // Of course we only save active frames, shapes
  let activeShapes = shapeList.filter((s) => s.isActive());
  let activeFrames = frameList.filter((f) => f.isActive());
  let shapesJson = activeShapes.map((s) => serialize(s));
  let framesJson = activeFrames.map((s) => serialize(s));
  let json = shapesJson.concat(framesJson);
  let blob = new Blob([JSON.stringify(json)],
                      { "type":"text/json" });
  saveAs(blob, "diagram.json");}
