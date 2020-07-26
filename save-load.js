"use strict";
let fileInput = e("input", {type:"file",
                            accept:".json",
                            onChange:readSingleFile});
// Gotta do this due to HTML BS
function triggerUpload(evt) {fileInput.click()}

function serialize(shape) {
  if (shape.type == "frame") {
    let [a,b,c,d,e,f] = shape.model.get("transform");
    return {xform: [a/theD,b/theD, c/theD,d/theD, e,f],
            type:"frame"};}
  else {
    return {...shape.model.getAll(),
            type:"shape", tag:shape.tag};}}

// Load the saved contents to the DOM
function loadComplete(evt) {
  let contents = JSON.parse(evt.target.result);
  clearSvg();  // Clear the svg only after successfully parsing the result!
  contents.map(({type, ...mold}) => {newShape(type, mold)});
  // Don't allow undoing save/load for now (when'd you need that?)
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
  for (let s of shapeList.concat(frameList)) {
    s.deregister()}
  shapeList.length = 0;
  frameList.length = 0;}

function saveDiagram() {
  // only save active frames, shapes
  let activeShapes = shapeList.filter((s) => s.isActive());
  let activeFrames = frameList.filter((f) => f.isActive());
  let shapesJson = activeShapes.map(serialize);
  let framesJson = activeFrames.map(serialize);
  let json = shapesJson.concat(framesJson);
  let blob = new Blob([JSON.stringify(json)],
                      { "type":"text/json" });
  saveAs(blob, "diagram.json");}
