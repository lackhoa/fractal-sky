"use strict";
let log = console.log;
let assert = console.assert;
let entries = Object.entries;

// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's edit
var panZoom;  // A third-party svg pan-zoom thing
var svg_el;  // The main svg element of the app

let getMousePos, getPrevMousePos, recordMouse;
{// Keep track of mouse position (in svg coordinate).
  // The offset attribute can't be used, since movement can be handled by different elements
  var mousePos = null;
  getMousePos = () => mousePos;
  var prevMousePos = null;  // Previous mouse pos
  getPrevMousePos = () => prevMousePos;

  function svgCoor([x,y]) {
    // x,y is mouse location given in screen coordinate
    // Factor in the offset of the svg element
    let {e,f} = svg_el.getScreenCTM();
    // Undo further svg-pan-zoom's effect
    let z = panZoom.getZoom();
    let d = panZoom.getPan();
    return [(x - d.x - e)/z, (y - d.y - f)/z];}

  recordMouse = (evt) => {
    prevMousePos = mousePos;
    mousePos = svgCoor([evt.x, evt.y]);}}

function mouseOffset() {
  let [x1,y1] = getPrevMousePos();
  let [x2,y2] = getMousePos();
  return [x2-x1, y2-y1]}

function DLList(First, Last) {
  var first = First, last = Last;  // These can totally be null
  this.getFirst = () => first;
  this.getLast  = () => last;

  function insertBefore(item, next) {
    // "next" is desired "item.next"
    item.next = next;
    let prev;  // Desired "item.prev"
    if (next == first) {first = item;}
    if (next) {
      prev = next.prev;
      next.prev = item;}
    else {// next is null: item is last
      prev = last;
      last = item;}
    item.prev = prev;
    if (prev) {item.prev.next = item}}
  this.insertBefore = insertBefore;

  function remove(item) {
    if (item.prev) {item.prev.next = item.next;}
    else {first = item.next;}
    if (item.next) {item.next.prev = item.prev;}
    else {last = item.prev;}}
  this.remove = remove;

  function list() {
    let res = [];
    for (let it = first; it; it = it.next) {
      res.push(it)}
    return res;}
  this.list = list;}
let shapeList = new DLList();  // Active shapes only
let frameList = new DLList();  // Active frames only


// Store them, so they won't change
let [W, H] = [window.innerWidth, window.innerHeight];
let theD = Math.min(W,H) - (Math.min(W,H) % 100);  // theD is the dimension of "the-frame"

// Undo/Redo stuff
// "undoStack" and "redoStack" are lists of commands
// Commands are like {action: "remove"/"create"/"edit", shape: <shape ptr>, before: <keys-vals before>, after: <keys-vals after>}
// The latter half of the keys are only needed for edits
// Deleted shapes linger around, since they're needed for undo
let undoStack = [];
let redoStack = [];
function canUndo() {return (undoStack.length != 0)};
function canRedo() {return (redoStack.length != 0)};
function tryUndo() {if (canUndo()) {undo()} else {log("Cannot undo!")}}
function tryRedo() {if (canRedo()) {redo()} else {log("Cannot redo!")}}

let undoBtn = e("button", {onClick:tryUndo, disabled:true}, [et("Undo")]);
let redoBtn = e("button", {onClick:tryRedo, disabled:true}, [et("Redo")]);
function updateUndoUI() {
  undoBtn.disabled = !canUndo();
  redoBtn.disabled = !canRedo();}

// Save the command to the undo stack
var controlChanged = true;  // This flag tells the undo system to insert a "break"
function issueCmd(cmd) {
  let len = undoStack.length;
  // So the deal is this: if the edit continuously comes from the same source, then we view that as the same edit
  if (len != 0) {
    let last = undoStack[len-1];
    if (controlChanged) {
      undoStack.push(cmd);
      controlChanged = false;}
    else if (cmd.action == "edit") {last.after = cmd.after}
    else {undoStack.push(cmd)}}
  else {undoStack.push(cmd)}
  redoStack.length = 0;  // Empty out the redoStack
  updateUndoUI();}

function undo() {
  let cmd = undoStack.pop();
  redoStack.push(cmd);
  switch (cmd.action) {
  case "create":
    deregister(cmd.entity);
    break;
  case "remove":
    register(cmd.entity);
    break;
  case "edit":
    setEntity(cmd.entity, cmd.before);
    break;
  case "arrange":
    arrange(cmd.entity, cmd.oldNext);
    break;
  default: throw("Illegal action", cmd.action)}
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

function redo() {
  let cmd = redoStack.pop();
  undoStack.push(cmd);
  switch (cmd.action) {
  case "create":
    register(cmd.entity);
    break;
  case "remove":
    deregister(cmd.entity);
    break;
  case "edit":
    setEntity(cmd.entity, cmd.after);
    break;
  case "arrange":
    arrange(cmd.entity, cmd.newNext);
    break;
  default: throw("Illegal action", cmd.action)}
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

let getFocused, focus, unfocus;
{var focused = null;
 getFocused = (() => focused);

 focus = (entity) => {
   if (focused != entity) {
     if (focused) {unfocus(focused)}
     setAttr(entity.controls, {visibility: "visible"});
     focused = entity;}}

 unfocus = (entity) => {
   // Make sure an entity isn't focused
   if (focused == entity) {
     setAttr(entity.controls, {visibility: "hidden"});
     focused = null;}}}

function arrowMove([dx,dy]) {
  let focused = getFocused();
  if (focused) {moveEntity(focused, [dx,dy])}
  else {panZoom.panBy({x:-dx, y:-dy})}}

// Handling keyboard events
let keymap = {"ctrl-z": tryUndo,
              "ctrl-y": tryRedo,
              "ArrowRight": () => arrowMove([10,  0]),
              "ArrowUp":    () => arrowMove([0,   -10]),
              "ArrowDown":  () => arrowMove([0,   10]),
              "ArrowLeft":  () => arrowMove([-10, 0]),
              "Delete": () => {
                let focused = getFocused();
                if (focused) {
                  deregister(focused);
                  let list = (focused.type == "shape") ? shapeList : frameList;
                  list.remove(focused);  // Remove the shape
                  issueCmd({action:"remove", entity:focused})}},
              "ctrl-shift-{": sendToBack,
              "ctrl-[":       sendBackward,
              "ctrl-]":       sendForward,
              "ctrl-shift-}": sendToFront}
window.onkeydown = (evt) => {
  var keys = "";
  if (evt.ctrlKey) {keys = "ctrl-"}
  if (evt.shiftKey) {keys += "shift-"}
  keys += evt.key;
  let lookup = keymap[keys];
  if (lookup) {
    evt.preventDefault();// Arrow keys scroll the window, we don't want that
    lookup();}}

var DOMRoot, controlLayer, boxLayer, frameBoxLayer, axesLayer;

function Entity(type, data={}) {
  // Create a shape structure, or a frame structure depend on "type"
  // Note: everything is public
  // The data contains the DOM tag and initial attributes
  let self = this;
  assert(type == "shape" || type == "frame");
  this.type = type;
  if (type == "frame") {
    {// Even though frames all look the same, they still have xform data
      let keys = Object.keys(data);
      assert(keys.length <= 1);
      if (keys.length == 1) {assert(keys[0] == "xform")}}
    var tag = frameMold.tag;
    var attrs = {...data};}
  else {
    var {tag, ...attrs} = data;}
  this.tag = tag;  // "tag" is the DOM tag
  this.viewLayers = [];

  {// Calculating spawn location
    let [rx,ry] = [(Math.random())*20, (Math.random())*20];  // Randomize
    let {x,y} = panZoom.getPan();
    let [dx,dy] = [x,y];
    let z = panZoom.getZoom();
    if (type == "frame") {
      let xform = attrs.xform;
      if (xform) {
        let [a,b,c,d,e,f] = xform;
        attrs.transform = [a*theD,b*theD, c*theD,d*theD, e,f];
        delete attrs.xform;}
      else {
        let scale = 1/3;  // Scaling is applied by default
        attrs.transform = [theD*scale,0, 0,theD*scale,
                           (-dx+100+rx)/z, (-dy+100+ry)/z]}}

    else if (tag == "line") {
      if (!attrs.x1) {
        let X = (-dx+100+rx)/z;
        let Y = (-dy+100+ry)/z;
        [attrs.x1, attrs.y1, attrs.x2, attrs.y2] = [X,Y, X+100, Y+100]}}

    else if (!attrs.transform) {
      // panZoom's transform (svg → screen): V ➾ P(V) = zV+Δ (where Δ = [dx,dy])
      // Substituting (V - Δ/z + D/z) for V skews that result to zV+D (screen coord)
      let DEFAULT_DIM = 100;
      attrs.transform = [DEFAULT_DIM,0, 0,DEFAULT_DIM,
                         (-dx+100+rx)/z, (-dy+100+ry)/z]}}

  // "moveFn" is only ever called when a move command has been issued (such as drag, or arrow keys) on the focused shape
  this.moveFn = null;
  // All mousedown handlers must implement this
  function ctrOnMouseDown(fn) {
    // Returns an event handler
    return (evt) => {
      controlChanged = true;  // Switched to a new control
      evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
      recordMouse(evt);
      // One entity have many controls
      self.moveFn = fn;}}

  // "Bounding box" of the shape, responsible for highlighting and receiving hover
  let bMold = (type == "frame") ? frameBoxMold : (tag == "line") ? lineBoxMold : boxMold;
  let box = es(
    bMold.tag,
    {...bMold,
     onMouseEnter: (evt) => {highlight(this)},
     // The mouse can leave a shape and still be dragging it
     onMouseLeave: () => {unhighlight(this)},
     onMouseDown: (evt) => {focus(this);
                            // @Todo: it's kinda weird, as "entity" is always "this"
                            ctrOnMouseDown((entity) =>
                                           moveEntity(entity, mouseOffset()))(evt);}});
  this.box = box;

  let ctag = cornerMold.tag;
  let controls;
  if (tag == "line") {
    this.endpoint1 = es(ctag, {...cornerMold,
                               onMouseDown:ctrOnMouseDown(endpoint1Move)});
    this.endpoint2 = es(ctag, {...cornerMold,
                               onMouseDown:ctrOnMouseDown(endpoint2Move)});
    controls = es("g", {visibility: "hidden"},
                  [this.endpoint1, this.endpoint2]);}
  else {
    // Corners
    this.iCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(iMove)})
    this.jCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(jMove)});
    this.oCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(oMove)});
    this.ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(ijMove)});
    // Side controls
    this.i_ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(i_ijMove)});
    this.j_ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(j_ijMove)});
    this.oiCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(oiMove)});
    this.ojCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(ojMove)});
    // Rotator
    let hitbox = es("rect", {x:0,y:0, width:1,height:1,
                             fill:"transparent",
                             stroke:"transparent",
                             "vector-effect":"non-scaling-stroke"})
    this.rotCtr = es("g",
                     {onMouseDown:
                      (evt) => {
                        // Let the pivot be at the center of the shape
                        {recordMouse(evt);
                         controlChanged = true;
                         evt.cancelBubble = true;}
                        let tform = self.model.transform;
                        let [ox,oy] = transform(tform, [0.5,0.5]);
                        let [x,y] = getMousePos();
                        let pivot = [ox,oy];
                        let angle = Math.atan2(y-oy, x-ox);
                        // One entity have many controls
                        self.moveFn = makeRotator(pivot, tform, angle);},
                      // Note: "vector-effect" is not inherited from "<g>"
                      stroke:"red", cursor:"move"},
                     // Specified in 0-1 coord
                     [es("path", {d:"M .5 0 A .5 .5 0 1 1 0 .5",
                                  fill:"transparent",
                                  "vector-effect":"non-scaling-stroke"}),
                      es("line", {x1:0, y1:.5, x2:-.2, y2:.7,
                                  "vector-effect":"non-scaling-stroke"}),
                      es("line", {x1:0, y1:.5, x2:.2, y2:.7,
                                  "vector-effect":"non-scaling-stroke"}),
                      hitbox]);

    controls = es("g", {visibility:"hidden"},
                  [this.oCtr, this.iCtr, this.jCtr, this.ijCtr,  // Corners
                   this.oiCtr, this.ojCtr, this.i_ijCtr, this.j_ijCtr,  // Sides
                   this.rotCtr]);}
  this.controls = controls;

  if (type == "frame") {
    this.axes = es(tag, {...frameMold, ...attrs})}

  // "active" means the entity is shown / hasn't been deleted
  this.active = false;

  {this.model = {};
   if (type == "frame") {assertFrameModel(attrs);}
   // Initialize the model
   setEntity(this, attrs);}}

function assertFrameModel(model) {
  let keys = Object.keys(model);
  assert(keys.length == 1);
  assert(keys[0] == "transform");}

function updateTransform(entity, v) {
  // transform is applied directly to the box
  setAttr(entity.box, {transform: v});
  // Adjust controllers' positions
  let [a,b,c,d,e,f] = v;
  let tl = [e,f];
  let tr = [a+e,b+f];  // [a,b] + [e,f]
  let bl = [c+e,d+f];
  let br = [a+c+e,b+d+f];
  // The rotator location
  let w = cornerWidth / 2;
  let dist = distance(tl, br);
  setAttr(entity.rotCtr, {transform: [20,0, 0,20,
                                      // Rotator lines up with the tl and br corners
                                      e-4*w*(a+c)/dist, f-4*w*(b+d)/dist]});
  // The corners' locations
  setAttr(entity.oCtr,  {cx:tl[0], cy:tl[1]});
  setAttr(entity.iCtr,  {cx:tr[0], cy:tr[1]});
  setAttr(entity.jCtr,  {cx:bl[0], cy:bl[1]});
  setAttr(entity.ijCtr, {cx:br[0], cy:br[1]});
  // The side controls' locations
  setAttr(entity.oiCtr,   {cx:a/2+e, cy:b/2+f});
  setAttr(entity.ojCtr,   {cx:c/2+e, cy:d/2+f});
  setAttr(entity.i_ijCtr, {cx:a+c/2+e, cy:b+d/2+f});
  setAttr(entity.j_ijCtr, {cx:a/2+c+e, cy:b/2+d+f});}

function endpoint1Move(line) {
  let {x1,y1} = line.model;
  let [dx,dy] = mouseOffset();
  setUndoable(line, {x1:x1+dx, y1:y1+dy});}

function endpoint2Move(line) {
  let {x2,y2} = line.model;
  let [dx,dy] = mouseOffset();
  setUndoable(line, {x2:x2+dx, y2:y2+dy});}

function makeRotator([ox,oy], rotMatrix, rotAngle) {
  return (entity) => {
    let [x,y] = getMousePos();
    setUndoable(entity, {transform:
                         translate(rotate(translate(rotMatrix, [-ox,-oy]),
                                          (Math.atan2(y-oy,x-ox) - rotAngle)),
                                   [ox,oy])})}}

function oMove(entity, evt) {
  let [a,b,c,d,e,f] = entity.model.transform;
  let m;
  if (evt.shiftKey) {
    let [x,y] = factor([a,b,c,d,e,f], getMousePos());
    let s = 1 - Math.min(x,y);
    m = [a*s,b*s, c*s,d*s, a+c+e-a*s-c*s,b+d+f-b*s-d*s];}
  else {
    // The fixed point is the bottom-right: [a+c+e, b+d+f]
    let [dx,dy] = mouseOffset();
    let s = (+d*dx - c*dy)/(b*c - a*d) + 1
    let t = (-b*dx + a*dy)/(b*c - a*d) + 1;
    m = [s*a,s*b, t*c,t*d, a+c+e-s*a-t*c,b+d+f-s*b-t*d];}

  setUndoable(entity, {transform: m});}

function iMove(entity, evt) {
  let [a,b,c,d,e,f] = entity.model.transform;
  let m;
  // Control key: just set the i-vector to whatever that is
  if (evt.shiftKey) {
    let [x,y] = factor([a,b,c,d,e,f], getMousePos());
    m = [x*a,x*b, x*c,x*d, e+c-x*c,f+d-x*d];}
  else if (evt.ctrlKey) {
    let [dx,dy] = mouseOffset();
    m = [a+dx,b+dy, c,d, e,f];}
  else {
    let [dx,dy] = mouseOffset();
    let s = 1 + (-d*dx + c*dy)/(b*c - a*d);
    let t = 1 + (-b*dx + a*dy)/(b*c - a*d);
    m = [s*a,s*b, t*c,t*d, e+c-t*c,f+d-t*d];}

  setUndoable(entity, {transform: m});}

function jMove(entity, evt) {
  let [a,b,c,d,e,f] = entity.model.transform;
  let m;
  if (evt.shiftKey) {
    let [x,y] = factor([a,b,c,d,e,f], getMousePos());
    m = [y*a,y*b, y*c,y*d, e+a-y*a,f+b-y*b];}
  else if (evt.ctrlKey) {
    let [dx,dy] = mouseOffset();
    m = [a,b, c+dx,d+dy, e,f];}
  else {
    let [dx,dy] = mouseOffset();
    let s = 1 + (d*dx - c*dy)/(b*c - a*d);
    let t = 1 + (b*dx - a*dy)/(b*c - a*d);
    m = [s*a,s*b, t*c,t*d, e+a-s*a,f+b-s*b];}

  setUndoable(entity, {transform: m});}

function ijMove(entity, evt) {
  let [a,b,c,d,e,f] = entity.model.transform;
  let m;
  if (evt.shiftKey) {
    let [x,y] = factor([a,b,c,d,e,f], getMousePos());
    let s = Math.max(x,y);
    m = [a*s,b*s, c*s,d*s, e,f];}
  else {
    let [dx,dy] = mouseOffset();
    let s = -(d*dx - c*dy)/(b*c - a*d) + 1
    let t = +(b*dx - a*dy)/(b*c - a*d) + 1;
    // The fixed point is the top-left: [e,f]
    m = [s*a,s*b, t*c,t*d, e,f];}

  setUndoable(entity, {transform: m});}

function oiMove(entity) {
  let [a,b,c,d,e,f] = entity.model.transform;
  let [_s,t] = factor([a,b,c,d,e,f], getMousePos());
  let tt = 1-t;
  setUndoable(entity, {transform: [a,b, c*tt,d*tt, e+c*t,f+d*t]});}

function ojMove(entity) {
  let [a,b,c,d,e,f] = entity.model.transform;
  let [s,_t] = factor([a,b,c,d,e,f], getMousePos());
  let ss = 1-s;
  setUndoable(entity, {transform: [a*ss,b*ss, c,d, e+a*s,f+b*s]});}

function i_ijMove(entity) {
  let [a,b,c,d,e,f] = entity.model.transform;
  let [s,_t] = factor([a,b,c,d,e,f], getMousePos());
  setUndoable(entity, {transform: [a*s,b*s, c,d, e,f]});}

function j_ijMove(entity) {
  let [a,b,c,d,e,f] = entity.model.transform;
  let [_s,t] = factor([a,b,c,d,e,f], getMousePos());
  setUndoable(entity, {transform: [a,b, c*t,d*t, e,f]});}

function getViews(entity) {
  return [].concat(...entity.viewLayers)}

function deregister(entity) {
  // Remove from DOM, the shape's still around for undo/redo
  unfocus(entity);
  entity.active = false;
  for (let {el} of getViews(entity)) {
    el.remove()}
  entity.viewLayers.length = 0;  // views will be re-created when re-registered
  entity.controls.remove();
  entity.box.remove();
  if (entity.type == "frame") {
    entity.axes.remove();
    frameList.remove(entity);}
  else {
    shapeList.remove(entity);}}

function moveLine(line, [dx,dy]) {
  let {x1,y1,x2,y2} = line.model;
  setUndoable(line, {x1:x1+dx, y1:y1+dy,
                     x2:x2+dx, y2:y2+dy});}

function moveEntity2D(entity, offset) {
  let m = entity.model.transform;
  setUndoable(entity, {transform:translate(m, offset)});}

function moveEntity(entity, offset) {
  if (entity.tag == "line") {
    moveLine(entity, offset)}
  else {
    moveEntity2D(entity, offset)}}

function zip(arrays) {
  let res = [];
  if (!(arrays.length == 0)) {
    let [a, ...bs] = arrays;
    for (let i = 0; i < a.length; i++) {
      let layer = a[i];
      for (let b of bs) {layer.push(b[i]);}
      res.push(layer);}}
  return res;}

function getLayers() {
  // Get view layers of all frames
  let res = [[root]];
  let flist = frameList.list();
  let nestedLayers = (flist.length == 0) ?
      [] : zip(flist.map(f => f.viewLayers));
  res.concat(nestedLayers);
  return res;}

function register(entity) {
  if (entity.type == "shape") {registerShape(entity)}
  else {registerFrame(entity)}}

function registerShape(shape) {
  // "shape" should have its list context initialized already
  shapeList.insertBefore(shape, shape.next);
  controlLayer.appendChild(shape.controls);
  boxLayer.insertBefore(shape.box, (shape.next ? shape.next.box : null));
  if (shape.next) {
    for (let layer of shape.next.viewLayers) {
      for (let {el, parent, depth} of layer) {
        newShapeView(shape, parent, el, depth)}}}
  else {// We got no shape yet, can't do a free-ride here
    newShapeView(shape, frameShapes(DOMRoot), null, 0);
    for (let frame of frameList.list()) {
      for (let layer of frame.viewLayers) {
        for (let {el, depth} of layer) {
          newShapeView(shape, frameShapes(el), null, depth);}}}}
  shape.active = true;}

function registerFrame(frame) {
  // "frame" should have its list context initialized already
  frameList.insertBefore(frame, frame.next);
  controlLayer.appendChild(frame.controls);
  if (frame.next) {
    frameBoxLayer.insertBefore(frame.box, frame.next.box);}
  else {
    frameBoxLayer.appendChild(frame.box);}
  assert(getViews(frame).length == 0);
  axesLayer.appendChild(frame.axes);
  if ((!frame.prev) && (!frame.next)) {
    // If there were no nested frames before this then the DOM tree only had depth 0
    // Since it's pointless to have overlapping elements
    newFrameView(frame, frameNested(DOMRoot), null, 1, treeDepth-1)}
  else {
    if (frame.next) {
      var depth = 1;
      for (let layer of frame.next.viewLayers) {
        for (let view of layer) {
          newFrameView(frame, view.parent, view.el, depth, treeDepth-depth)}
        depth++;}}
    else {// Exact same thing, but anchored based on the previous frame
      var depth = 1;
      for (let layer of frame.prev.viewLayers) {
        for (let view of layer) {
          newFrameView(frame, view.parent, null, depth, treeDepth-depth)}
        depth++;}}}
  frame.active = true;}

function setEntity(entity, attrs) {
  if (entity.tag == "line") {
    let line = entity;
    for (let [k,v] of entries(attrs)) {
      for (let {el} of getViews(line)) {
        setAttr(el, {[k]: v})}
      if (["x1", "y1", "x2", "y2"].includes(k)) {
        setAttr(line.box, {[k]: v});
        switch (k) {
        case "x1": setAttr(line.endpoint1, {cx: v}); break;
        case "y1": setAttr(line.endpoint1, {cy: v}); break;
        case "x2": setAttr(line.endpoint2, {cx: v}); break;
        case "y2": setAttr(line.endpoint2, {cy: v}); break;}}}}

  else if (entity.type == "frame") {
    let keys = Object.keys(attrs);
    assert(keys.length <= 1);
    if (keys.length == 1) {
      let v = attrs.transform;
      assert(v);
      updateTransform(entity, v);
      setAttr(entity.axes, {transform:v})
      {let xform = toXform(v);
       for (let {el} of getViews(entity)) {
         setAttr(el, {transform:xform})}}}}
  else {
    for (let [k,v] of entries(attrs)) {
      for (let {el} of getViews(entity)) {
        setAttr(el, {[k]:v})}
      if (k == "transform") {
        updateTransform(entity, v)}}}

  entity.model = {...entity.model, ...attrs};}

function setUndoable(entity, attrs) {
  setEntity(entity, attrs);
  let model = entity.model;
  let before = {};
  for (let k in attrs) {before[k] = model[k]}
  issueCmd({entity, action:"edit", before, after:attrs});}

function highlight(entity) {
  if (entity.type == "frame") {
    setAttr(entity.box, {stroke: HL_COLOR})}
  else if (entity.tag == "line") {
    setAttr(entity.box, {stroke: HL_COLOR})}
  else {
    setAttr(entity.box, {fill: HL_COLOR})}}

function unhighlight(entity) {
  if (entity.type == "frame") {
    setAttr(entity.box, {stroke: "transparent"})}
  else if (entity.tag == "line") {
    setAttr(entity.box, {stroke: "transparent"})}
  else {
    setAttr(entity.box, {fill: "transparent"})}}

function addEntityView(entity, el, parent, depth) {
  // Add a view to the correct layer
  let layers = entity.viewLayers;
  let d = (entity.type == "frame") ? depth-1 : depth;
  if (layers.length < d+1) {
    // Pad the tree til "depth"
    for (let it = layers.length; it <= d; it++) {
      layers.push([])}}
  assert(layers.length > d);
  layers[d].push({el, parent, depth});}

// Make a DOM element whose attribute is linked to the model
// The index is the layer index, if it's null then append at the front
function newShapeView(shape, parent, nextView, depth) {
  let model = shape.model;
  assert(model, "Model is supposed to be initialized");
  let el = es(shape.tag, model);
  parent.insertBefore(el, nextView);
  addEntityView(shape, el, parent, depth);
  return el;}

function toXform([a,b,c,d,e,f]) {
  return [a/theD,b/theD, c/theD,d/theD, e,f]}

function newFrameView(frame, parent, nextView, depth, recurDepth) {
  // Returns a <g> element whose transform is synced with the given frame
  // "recurDepth" is how tall the tree is growing down, "depth" is the relative depth to the root
  assert(depth > 0);  // Frame views never have depth 0
  let tform = frame.model.transform;
  let echos = es("g", {class:"frame-shapes"});
  let el = es("g", {class:"frame", transform:toXform(tform)},
              [echos]);
  for (let shape of shapeList.list()) {
    newShapeView(shape, echos, null, depth)}
  parent.insertBefore(el, nextView);
  // This is a branch: make a forest of nodes of the depth level
  if (recurDepth > 0) {
    el.appendChild(makeLayer(depth+1, recurDepth-1, frameList.list()));}

  addEntityView(frame, el, parent, depth);
  return el;}

var treeDepth = 1;  // Depth of the deepest node
function frameShapes(frame) {return frame.children[0]}
function frameNested(frame) {return frame.children[1]}
function isLeaf(frame) {
  return (frame.getElementsByClassName("frame-nested").length == 0);}

function makeLayer(depth, recurDepth, frames) {
  /** Make group of frames of desired recurDepth. */
  let g = es("g", {class:"frame-nested"});
  for (let frame of frames) {
    newFrameView(frame, g, null, depth, recurDepth)}
  return g;}

function incDepth() {
  /** Increment the current frame count */
  let flist = frameList.list();
  for (let frame of flist) {
    let layers = frame.viewLayers;
    // Leaves before the computation, but they might be braches in the transit
    let leaves = layers[treeDepth - 1];
    for (let {el} of leaves) {
      assert(el.children.length == 1);
      assert(el.children[0].classList.contains("frame-shapes"))
      el.appendChild( makeLayer(treeDepth+1, 0, flist) )}}

  treeDepth++;}

function decDepth() {
  /** Decrement the current frame count */
  assert(treeDepth >= 2);
  let flist = frameList.list();
  // If there's no nested frame then no worries
  if (flist.length > 0) {
    for (let frame of flist) {
      let layers = frame.viewLayers;
      let len = layers.length;
      assert(len >= 2);
      for (let {el} of layers[len - 2]) {
        assert(el.classList.contains("frame"));
        frameNested(el).remove();}
      layers.length--;}
    for (let shape of shapeList.list()) {
      // We've already removed the shapes, but the reference persists
      shape.viewLayers.length--;}}

  treeDepth--;}

// What happens when the user clicks the "create button"
function addEntity(type, data) {
  let entity = new Entity(type, data);
  // New entities get rendered to the front, hence added to the back of the list
  if (type == "shape") {registerShape(entity);}
  else {registerFrame(entity);}
  issueCmd({action:"create", entity});}

function arrange(entity, next) {
  deregister(entity);
  entity.next = next;
  register(entity);}

function arrangeUndoable(entity, newNext) {
  let oldNext = entity.next;
  arrange(entity, newNext);
  issueCmd({action:"arrange", entity, oldNext, newNext})}

function sendToBack() {
  let focused = getFocused();
  if (focused) {
    if (focused.prev) {
      if (focused.type == "shape") {
        arrangeUndoable(focused, shapeList.getFirst());}
      else {
        arrangeUndoable(focused, frameList.getFirst());}
      focus(focused);}}}

function sendBackward() {
  let focused = getFocused();
  if (focused) {
    if (focused.prev) {
      arrangeUndoable(focused, focused.prev);
      focus(focused);}}}

function sendForward() {
  let focused = getFocused();
  if (focused) {
    if (focused.next) {
      arrangeUndoable(focused, focused.next.next);
      focus(focused);}}}

function sendToFront() {
  let focused = getFocused();
  if (focused) {
    if (focused.next) {
      arrangeUndoable(focused, null);
      focus(focused);}}}

{// The DOM
  let tile = es("pattern", {id:"svg-tile",
                            width:100, height:100, patternUnits:"userSpaceOnUse"},
                [es("rect", {width:100, height:100, fill:"none"}),
                 es("path", {d:"M 100 0 H 0 V 100",
                             fill:"none", stroke:"#777777", "stroke-width":2})]);
  let frameStroke = {"vector-effect":"non-scaling-stroke",
                     fill:"transparent", "stroke-width":3};
  // This is within 00-11 bound
  let arr = 0.03;
  let frameDef = es("g", {id:"frame", "vector-effect":"non-scaling-stroke"},
                    [// This is i
                      es("path", {...frameStroke, stroke:"red", d:`M 0 0 H 1`}),
                      es("path", {...frameStroke, stroke:"red",
                                  d:`M ${1-arr} ${-arr} L 1 0 L ${1-arr} ${arr}`,}),
                      // This is j
                      es("path", {...frameStroke, stroke:"green", d:`M 0 0 V 1`}),
                      es("path", {...frameStroke, stroke:"green",
                                  d:`M ${-arr} ${1-arr} L 0 1 L ${arr} ${1-arr}`}),
                    ]);

  let app = document.getElementById("app");
  // The SVG Layers: also the root frame, with depth of 1 at first
  DOMRoot = es("g", {id:"root", class:"frame"},
               [es("g", {class:"frame-shapes"}),
                es("g", {class:"frame-nested"})]);
  controlLayer = es("g", {id:"controls"});
  boxLayer = es("g", {id:"box-layer"});
  frameBoxLayer = es("g", {id:"frame-box-layer"});

  // This is the only "onMouseMove" event
  function surfaceOnMouseMove(evt) {
    if (evt.buttons == 1) {
      recordMouse(evt);
      let focused = getFocused();
      if (focused &&
          ((evt.movementX != 0) || (evt.movementY != 0))) {
        // If dragging & there's a listener, we checked for zero since there's a bug with "ctrl+click" that triggerse this event, even when there's no movement
        focused.moveFn(focused, evt);
        // Cancel bubble, so svg won't get pan/zoom event
        evt.cancelBubble = true;}}}

  // This layer holds all the axes, so we can turn them all on/off
  axesLayer = es("g", {id:"axes-layer"},
                 [// The identity frame (decoration)
                   es("use", {id:"the-frame", href:"#frame",
                              transform:[theD,0, 0,theD, 0,0]})])

  svg_el = es("svg", {id:"dom-svg"},
              // pan-zoom wrapper wrap around here
              [es("g", {id:"svg-surface",
                        onMouseMove: surfaceOnMouseMove,
                        onMouseUp: (evt) => {
                          controlChanged = true;
                          recordMouse(evt);},
                        onMouseDown: (evt) => {
                          {let focused = getFocused();
                           if (focused) {unfocus(focused)}}
                          recordMouse(evt);}},
                  [// Definitions
                    es("defs", {id:"svg-defs"}, [tile, frameDef]),
                    // The grid
                    es("rect", {id:"svg-grid",
                                width:2*W+1, height:2*H+1,
                                // Offset so that things will be in the middle
                                x:-W/2, y:-H/2,
                                fill:"url(#svg-tile)"}),
                    // Due to event propagation, events not handled by any shape will be handled by the surface
                    DOMRoot, axesLayer, boxLayer, frameBoxLayer, controlLayer])]);

  let UI = e("div", {id:"menu-bar"},
             [// Shape creation
               e("button", {onClick: (evt) => {addEntity("shape", rectMold)}},
                 [et("Rectangle")]),
               e("button", {onClick: (evt) => {addEntity("shape", circMold)}},
                 [et("Circle")]),
               e("button", {onClick: (evt) => {addEntity("shape", trigMold)}},
                 [et("Triangle")]),
               e("button", {onClick: (evt) => {addEntity("shape", lineMold)}},
                 [et("Line")]),
               e("button", {onClick: (evt) => {addEntity("frame")}},
                 [et("Frame")]),

               e("span", {}, [et(" | ")]),
               // Save to file
               e("button", {onClick:(evt) => saveDiagram()},
                 [et("Save")]),
               // Load from file
               e("button", {onClick:(evt) => triggerUpload()},
                 [et("Load")]),

               e("span", {}, [et(" | ")]),
               // Undo/Redo buttons
               undoBtn, redoBtn,

               e("span", {}, [et(" | ")]),
               // Changing depth
               e("input", {type:"number", name:"Depth", min:1, max:20,
                           value:treeDepth,
                           onchange:(evt) => {
                             let v = parseInt(evt.target.value);
                             if (v < treeDepth) {
                               while (treeDepth > v) {decDepth()}}
                             else if (v > treeDepth) {
                               while (treeDepth < v) {incDepth()}}}}),

               e("span", {}, [et(" | ")]),
               // Toggling grid
               e("button", {onclick: (evt) => {
                 let v = getComputedStyle(axesLayer).visibility;
                 let V = (v == "visible") ? "hidden" : "visible";
                 setAttr(axesLayer, {visibility: V})}},
                 [et("Axes")]),

               e("span", {}, [et(" | ")]),
               // Shape order
               e("button", {onclick: sendToBack},
                 [et("Send to back")]),
               e("button", {onclick: sendBackward},
                 [et("Send backward")]),
               e("button", {onclick: sendForward},
                 [et("Send forward")]),
               e("button", {onclick: sendToFront},
                 [et("Send to front")]),
             ]);
  app.appendChild(UI);
  app.appendChild(svg_el);
  // SVG panzoom only works with whole SVG elements
  panZoom = svgPanZoom("#dom-svg", {dblClickZoomEnabled: false,
                                    // Don't do any bullshit on startup
                                    fit:false, center:false});
  panZoom.pan({x:20, y:20});}