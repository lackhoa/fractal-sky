// Loading the file after it has been loaded doesn't trigger this event again because it's hooked up to "change", and the filename hasn't changed!
function readSingleFile(evt) {
  let file = evt.target.files[0];
  let reader = new FileReader();
  reader.onload = loadComplete;
  reader.readAsText(file);
  // Clears the last filename(s) so loading the same file will work again.
  evt.target.value = "";}

// document.getElementById("fileInput").addEventListener('change', readSingleFile, false);

function loadComplete(evt) {
  let contents = JSON.parse(evt.target.result);
  clearSvg();
  contents.map((data) => {let sg = new Shape2D(data.model, data);
                          sg.register()})}

function removeChildren(node) {
  while (node.firstChild) {node.removeChild(node.firstChild)}
}

function clearSvg() {
  // @Question: Do I want to clean up all the objects manually? Or GC is enough?
  shapeGroups = [];
  removeChildren(shapes);
  removeChildren(boxes);
  removeChildren(controls);
}

function saveDiagram() {
  let json = shapeGroups.map((sg) => sg.serialize());
  let blob = new Blob([JSON.stringify(json)], { "type": "text/json" });
  saveAs(blob, "diagram.json")}
