"use strict";
let fileInput = e("input", {type:"file",
                            accept:".json",
                            onChange:readSingleFile});
// Gotta do this due to HTML BS
function triggerUpload(evt) {fileInput.click()}

function serializeFrame(frame) {
  assertFrameModel(frame.model);
  return {xform: toXform(frame.model.transform)}}

function serializeShape(shape) {
  return {tag:shape.tag, ...shape.model}}

// Load the saved contents to the DOM
function loadComplete(evt) {
  let content = JSON.parse(evt.target.result);
  clearSvg();  // Clear the svg only after successfully parsing the result!
  if (Array.isArray(content)) {
    for (let entity of content) {
      let {type, ...data} = entity;
      addEntity(type, data);}}
  else if (content.version == "0.1") {
    for (let shape of content.shapes) {
      addEntity("shape", shape);}
    for (let frame of content.frames) {
      addEntity("frame", frame);}}
  else {
    log("Unsupported version");}
  // Don't allow undoing save/load for now (when'd you need that?)
  undoStack.length = 0; redoStack.length = 0; updateUndoUI();}

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
  for (let shape of shapeList.list()) {
    deregister(shape)}
  for (let frame of frameList.list()) {
    deregister(frame)}}

let CURRENT_VERSION = "0.1";
function saveDiagram() {
  // only save active frames, shapes
  let shapesJson = shapeList.list().map(serializeShape);
  let framesJson = frameList.list().map(serializeFrame);
  let json = {version:CURRENT_VERSION,
              shapes:shapesJson,
              frames:framesJson};
  let blob = new Blob([JSON.stringify(json)],
                      { "type":"text/json" });
  saveAs(blob, "diagram.json");}
