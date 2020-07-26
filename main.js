"use strict";
let log = console.log;
let assert = console.assert;
let abs = Math.abs;
let entries = Object.entries;
function distance([x,y], [X,Y]) {
  let dx = X - x;
  let dy = Y - y;
  return Math.sqrt(dx*dx + dy*dy);}
function factor([a,b, c,d, e,f], [u,v]) {
  assert((b*c - a*d) != 0);
  let x = (-c*f + c*v + d*(-u) + e*d)/(b*c - a*d)
  let y = (a*f - a*v + b*u - e*b)/(b*c - a*d)
  return [x,y];}
let idMatrix = [1,0, 0,1, 0,0];

// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
var panZoom;  // A third-party svg pan-zoom thing
var svg_el;  // The main svg element of the app
// There's only ever one mouse manager: it keeps track of mouse position, that's it
function MouseManager() {
  // Keep track of mouse position (in svg coordinate).
  // The offset attribute can't be used, since movement can be handled by different elements
  var mousePos = null;
  this.getMousePos = () => mousePos;
  var prevMousePos = null;  // Previous mouse pos
  this.getPrevMousePos = () => prevMousePos;

  function svgCoor([x,y]) {
    // x,y is mouse location given in screen coordinate
    // Factor in the offset of the svg element
    let {e,f} = svg_el.getScreenCTM();
    // Undo further svg-pan-zoom's effect
    let z = panZoom.getZoom();
    let d = panZoom.getPan();
    return [(x - d.x - e)/z, (y - d.y - f)/z];}

  function handle(evt) {
    prevMousePos = mousePos;
    // Urgh, this is not it! evt.x refers to screen coordinate
    mousePos = svgCoor([evt.x,evt.y]);}
  this.handle = handle;}
let mouseManager = new MouseManager();

function mouseOffset() {
  let [x1,y1] = mouseManager.getPrevMousePos();
  let [x2,y2] = mouseManager.getMousePos();
  return [x2-x1, y2-y1]}

function DLList(First, Last) {
  var first = First, last = Last;  // These can totally be null
  this.getFirst = () => first;
  this.getLast  = () => last;

  function insertAfter(item, previous) {
    item.prev = previous;
    if (previous == last) {// previous is last, so item is last
      last = item;}
    if (previous) {
      item.next = previous.next;
      previous.next = item;}
    else {// previous is null, then it's the first
      item.next = first;
      if (first) {
        first.prev = item;
        first = item;}}}
  this.insertAfter = insertAfter;

  function remove(item) {
    if (item.prev) {prev.next = item.next;}
    else {first = item.next;}
    if (item.next) {next.prev = item.prev;}
    else {last = item.prev;}}
  this.remove = remove;

  function list() {
    let res = [];
    if (first) {
      var it = first;
      while(it) {
        res.push(it);
        it = it.next;}}
    return res;}
  this.list = list;}
let shapeList = new DLList();
let frameList = new DLList();

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
    deregister(cmd.shape);  // The shape is still there, just register it
    break;
  case "remove":
    register(cmd.shape);
    break;
  case "edit":
    cmd.shape.model.set(cmd.before);
    break;
  default: throw("Illegal action", cmd.action)}
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

function redo() {
  let cmd = redoStack.pop();
  undoStack.push(cmd);
  switch (cmd.action) {
  case "create":
    register(cmd.shape);  // The shape is still there, just register it
    break;
  case "remove":
    deregister(cmd.shape);
    break;
  case "edit":
    setEntity(cmd.shape, cmd.after);
    break;
  default: throw("Illegal action", cmd.action)}
  log({undo: undoStack, redo: redoStack});
  updateUndoUI();}

// There's only one of these
function State() {
  let that = this;
  var focused = null;
  that.getFocused = () => focused;

  function focus(shape) {
    // Shape can be null
    if (focused != shape) {
      if (focused) focused.unfocus()
      focused = shape;
      if (shape) shape.focus();}}
  that.focus = focus;

  // Make sure a shape isn't focused
  function unfocus(shape) {if (focused == shape) focus(null)}
  that.unfocus = unfocus;}
let state = new State();

function arrowMove([dx,dy]) {
  let focused = state.getFocused();
  if (focused) focused.move([dx,dy])
  else {panZoom.panBy({x:-dx, y:-dy})}}

// Handling keyboard events
let keymap = {"ctrl-z": tryUndo,
              "ctrl-y": tryRedo,
              "ArrowRight": (evt) => arrowMove([10,  0]),
              "ArrowUp": (evt)    => arrowMove([0,   -10]),
              "ArrowDown": (evt)  => arrowMove([0,   10]),
              "ArrowLeft": (evt)  => arrowMove([-10, 0]),
              "Delete": () => {
                let focused = state.getFocused();
                if (focused) {
                  deregister(focused);
                  let list = (focused.type == "shape") ? shapeList : frameList;
                  list.remove(focused);  // Remove the shape
                  issueCmd({action:"remove", entity:focused})}},}
window.onkeydown = (evt) => {
  let keys = [];
  if (evt.ctrlKey) {keys.push("ctrl")}
  if (evt.shiftKey) {keys.push("shift")}
  keys.push(evt.key);
  let lookup = keymap[keys.join("-")];
  if (lookup) {
    evt.preventDefault();// Arrow keys scroll the window, we don't want that
    lookup()};}

// Some pure transformation functions
function translate([a,b, c,d, e,f], [tx,ty]) {
  return [a,b, c,d, e+tx, f+ty];}
function extend([a,b, c,d, e,f], [dx,dy]) {
  return [a+dx,b, c,d+dy, e,f]}
function transform([a,b, c,d, e,f], [x,y]) {
  return [a*x+c*y+e, b*x+d*y+f]}
function compose([A,B, C,D, E,F], [a,b, c,d, e,f]) {
  return [(a*A + b*C), (a*B + b*D),
          (c*A + d*C), (c*B + d*D),
          (e*A + f*C + E), (e*B + f*D + F),]}
function rotate(m, angle) {
  let S = Math.sin(angle);
  let C = Math.cos(angle);
  let M = [C,S, -S,C, 0,0];
  return compose(M, m);}

// These models define shape and their associated controls
// Note: "tag" denotes the DOM element's tag, other attributes are consistent with my DOM model
let HL_COLOR = "#0000FF55"
let commonMold = {stroke:"black",
                  "vector-effect": "non-scaling-stroke"};
let shapeFill = "#dd87e0";
let rectMold = {...commonMold, tag:"rect",
                width:1, height:1, fill:shapeFill};
let circMold = {...commonMold, tag:"circle",
                cx:0.5, cy:0.5, r:0.5, fill:shapeFill};
let trigMold = {...commonMold, tag:"path",
                d:"M 0.5 0 L 0 1 H 1 Z", fill:shapeFill};
let lineMold = {...commonMold, tag: "line"};
let lineBoxMold = {...lineMold, "stroke-width":20, stroke:HL_COLOR};

let boxMold = {...commonMold, tag:"rect",
               width:1, height:1, fill:HL_COLOR, stroke:"transparent"};
let cornerWidth = 20;
let cornerMold = {...commonMold, tag:"circle", r:cornerWidth/2,
                  fill:"transparent", stroke:"red", cursor:"move"};
let frameMold = {tag:"use", href:"#frame"};

var DOMRoot, controlLayer, boxLayer, axesLayer;

function Entity(type, mold={}) {
  // Create a shape structure, or a frame structure depend on "type"
  // Note: everything is public
  // The mold contains the DOM tag and initial attributes
  assert(type == "shape" || type == "frame");
  this.type = type;
  var model;
  if (type == "frame") {
    var {tag, ...attrs} = {...frameMold, ...mold};}
  else {
    var {tag, ...attrs} = mold;}
  this.tag = tag;  // "tag" is the DOM tag
  let viewLayers = [];
  this.viewLayers = viewLayers;

  // Calculating spawn location
  let [rx,ry] = [(Math.random())*20, (Math.random())*20];  // Randomize
  let {x,y} = panZoom.getPan();
  let [dx,dy] = [x,y];
  let z = panZoom.getZoom();
  if (type == "frame") {
    let xform = attrs.xform;
    if (xform) {
      let [a,b,c,d,e,f] = attrs.xform;
      attrs.transform = [a*theD,b*theD, c*theD,d*theD, e,f];}
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
                       (-dx+100+rx)/z, (-dy+100+ry)/z]}

  // All mousedown handlers must implement this
  function ctrOnMouseDown(fn) {
    // Returns an event handler
    return (evt) => {
      controlChanged = true;  // Switched to a new control
      evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
      mouseManager.handle(evt);
      // One entity have many controls
      this.moveFn = fn;}}

  // "Bounding box" of the shape, responsible for highlighting and receiving hover
  let bMold = (tag == "line") ? lineBoxMold : boxMold;
  let box = es(
    bMold.tag,
    {...bMold, visibility: "hidden",
     // Allways handle mouse event, visible or not
     "pointer-events": "all",
     onMouseEnter: (evt) => {if (evt.buttons == 0) highlight()},
     // The mouse can leave a shape and still be dragging it
     onMouseLeave: () => {if (that != state.getFocused()) {unhighlight()}},
     onMouseDown: (evt) => {state.focus(that);
                            ctrOnMouseDown(move)(evt);}});
  this.box = box;

  let ctag = cornerMold.tag;
  var controls;
  if (tag == "line") {
    // Creating controls for line
    let endpoint1Md = ([dx,dy]) => {
      let {x1,y1} = model.getAll();
      setUndoable({x1: x1+dx, y1: y1+dy});}
    let endpoint2Md = ([dx,dy]) => {
      let {x2,y2} = model.getAll();
      setUndoable({x2:x2+dx, y2:y2+dy});}
    var endpoint1 = es(ctag, {...cornerMold,
                              onMouseDown:ctrOnMouseDown(endpoint1Md)});
    var endpoint2 = es(ctag, {...cornerMold,
                              onMouseDown:ctrOnMouseDown(endpoint2Md)});
    controls = es("g", {visibility: "hidden"},
                  [endpoint1, endpoint2]);}
  else {
    // Creating controls for 2D shapes and frames
    function rotator(updateFn, rotPivot) {
      let [x,y] = mouseManager.getMousePos();  // mouse position in svg coordinate
      let [ox,oy] = rotPivot;
      setUndoable({transform: translate(rotate(translate(rotMatrix, [-ox,-oy]),
                                               (Math.atan2(y-oy,x-ox) - rotAngle)),
                                        [ox,oy])})}

    function rotCtr(tform) {
      es("g", {onMouseDown:
               (evt) => {
                 ctrOnMouseDown(rotator)(evt)
                 // Let the pivot be at the center of the shape
                 let [ox,oy] = transform(tform, [0.5,0.5]);
                 let [x,y] = mouseManager.getMousePos();
                 rotPivot = [ox,oy];
                 rotMatrix = tform;
                 rotAngle = Math.atan2(y-oy, x-ox);},
               // "vector-effect" is not inherited for some reason???
               stroke:"red", cursor:"move"},
         // Specified in 0-1 coord
         [es("path", {d:"M .5 0 A .5 .5 0 1 1 0 .5",
                      fill:"transparent", "vector-effect":"non-scaling-stroke"}),
          es("line", {x1:0, y1:.5, x2:-.2, y2:.7,"vector-effect":"non-scaling-stroke"}),
          es("line", {x1:0, y1:.5, x2:.2, y2:.7,"vector-effect":"non-scaling-stroke"}),
          hitbox])
    }

    function oMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.transform;
      var m;
      if (evt.shiftKey) {
        let [x,y] = factor([a,b,c,d,e,f], mouseManager.getMousePos());
        let s = 1 - Math.min(x,y);
        m = [a*s,b*s, c*s,d*s, a+c+e-a*s-c*s,b+d+f-b*s-d*s];}
      else {
        // The fixed point is the bottom-right: [a+c+e, b+d+f]
        let s = (+d*dx - c*dy)/(b*c - a*d) + 1
        let t = (-b*dx + a*dy)/(b*c - a*d) + 1;
        m = [s*a,s*b, t*c,t*d, a+c+e-s*a-t*c,b+d+f-s*b-t*d];}

      setUndoable({transform: m});}

    function iMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.transform;
      var m;
      // Control key: just set the i-vector to whatever that is
      if (evt.shiftKey) {
        let [x,y] = factor([a,b,c,d,e,f], mouseManager.getMousePos());
        m = [x*a,x*b, x*c,x*d, e+c-x*c,f+d-x*d];}
      else if (evt.ctrlKey) {
        m = [a+dx,b+dy, c,d, e,f];}
      else {
        let s = 1 + (-d*dx + c*dy)/(b*c - a*d);
        let t = 1 + (-b*dx + a*dy)/(b*c - a*d);
        m = [s*a,s*b, t*c,t*d, e+c-t*c,f+d-t*d];}

      setUndoable({transform: m});}

    function jMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.transform;
      var m;
      if (evt.shiftKey) {
        let [x,y] = factor([a,b,c,d,e,f], mouseManager.getMousePos());
        m = [y*a,y*b, y*c,y*d, e+a-y*a,f+b-y*b];}
      else if (evt.ctrlKey) {
        m = [a,b, c+dx,d+dy, e,f];}
      else {
        let s = 1 + (d*dx - c*dy)/(b*c - a*d);
        let t = 1 + (b*dx - a*dy)/(b*c - a*d);
        m = [s*a,s*b, t*c,t*d, e+a-s*a,f+b-s*b];}

      setUndoable({transform: m});}

    function ijMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.transform;
      var m;
      if (evt.shiftKey) {
        let [x,y] = factor([a,b,c,d,e,f], mouseManager.getMousePos());
        let s = Math.max(x,y);
        m = [a*s,b*s, c*s,d*s, e,f];}
      else {
        let s = -(d*dx - c*dy)/(b*c - a*d) + 1
        let t = +(b*dx - a*dy)/(b*c - a*d) + 1;
        // The fixed point is the top-left: [e,f]
        m = [s*a,s*b, t*c,t*d, e,f];}

      setUndoable({transform: m});}

    function oiMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.transform;
      let [_s,t] = factor([a,b,c,d,e,f], mouseManager.getMousePos());
      let tt = 1-t;
      setUndoable({transform: [a,b, c*tt,d*tt, e+c*t,f+d*t]});}

    function ojMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.transform;
      let [s,_t] = factor([a,b,c,d,e,f], mouseManager.getMousePos());
      let ss = 1-s;
      setUndoable({transform: [a*ss,b*ss, c,d, e+a*s,f+b*s]});}

    function i_ijMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.transform;
      let [s,_t] = factor([a,b,c,d,e,f], mouseManager.getMousePos());
      setUndoable({transform: [a*s,b*s, c,d, e,f]});}

    function j_ijMove([dx,dy], evt) {
      let [a,b,c,d,e,f] = model.transform;
      let [_s,t] = factor([a,b,c,d,e,f], mouseManager.getMousePos());
      setUndoable({transform: [a,b, c*t,d*t, e,f]});}

    var rotPivot, rotMatrix, rotAngle;  // set whenever the rotator is pressed

    // Corners
    var iCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(iMove)})
    var jCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(jMove)});
    var oCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(oMove)});
    var ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(ijMove)});
    // Side controls
    var i_ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(i_ijMove)});
    var j_ijCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(j_ijMove)});
    var oiCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(oiMove)});
    var ojCtr = es(ctag, {...cornerMold, onMouseDown:ctrOnMouseDown(ojMove)});
    // Rotator
    let hitbox = es("rect", {x:0,y:0, width:1,height:1,
                             fill:"transparent",
                             stroke:"transparent",
                             "vector-effect":"non-scaling-stroke"})

    controls = es("g", {visibility:"hidden"},
                  // [oCtr, iCtr, jCtr, ijCtr,  // Corners
                  //  oiCtr, ojCtr, i_ijCtr, j_ijCtr,  // Sides
                  //  rotCtr]
                 );}
  this.controls = controls;

  if (type == "frame") {
    var axes = es(tag, attrs);}
  this.axes = axes;

  // Come about to making the model
  var updateFn;

  // "moveFn" is only ever called when a move command has been issued (such as drag, or arrow keys) on the focused shape
  this.moveFn = null;

  // "active" means the entity is shown / hasn't been deleted
  this.active = false;

  var updateKV;
  if (tag == "line") {
    updateKV = (k, v) => {
      for (let {el} of getViews(this)) {
        setAttr(el, {[k]:v})}
      if (["x1", "y1", "x2", "y2"].includes(k)) {
        // Changing the endpoints of the model also changes box
        setAttr(box, {[k]: v});
        switch (k) {
        case "x1": setAttr(endpoint1, {cx: v}); break;
        case "y1": setAttr(endpoint1, {cy: v}); break;
        case "x2": setAttr(endpoint2, {cx: v}); break;
        case "y2": setAttr(endpoint2, {cy: v}); break;}}}}
  else if (type == "shape") {
    function updateTransform(v) {
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
      setAttr(rotCtr, {transform: [20,0, 0,20,
                                   // Rotator lines up with the tl and br corners
                                   e-4*w*(a+c)/dist, f-4*w*(b+d)/dist]});
      // The corners' locations
      setAttr(oCtr,  {cx:tl[0], cy:tl[1]});
      setAttr(iCtr,  {cx:tr[0], cy:tr[1]});
      setAttr(jCtr,  {cx:bl[0], cy:bl[1]});
      setAttr(ijCtr, {cx:br[0], cy:br[1]});
      // The side controls' locations
      setAttr(oiCtr,   {cx:a/2+e, cy:b/2+f});
      setAttr(ojCtr,   {cx:c/2+e, cy:d/2+f});
      setAttr(i_ijCtr, {cx:a+c/2+e, cy:b+d/2+f});
      setAttr(j_ijCtr, {cx:a/2+c+e, cy:b/2+d+f});}

    if (type == "shape") {
      updateKV = (k,v) => {
        for (let {el} of getViews(this)) {
          setAttr(el, {[k]:v})}
        if (k == "transform") {updateTransform(v)}}}
    else {
      updateKV = (k, v) => {
        if (k == "transform") {
          updateTransform(v);
          // Transform of axes
          setAttr(axes, {transform:v})
          // Nested stuff
          let xform = [a/theD,b/theD, c/theD,d/theD, e,f];
          this.xform = xform;
          for (let {el} of getViews(this)) {
            setAttr(el, {transform:xform})}}}}}

  // Model holds changing data which to be synced with the view
  // In shapes, the model holds attributes
  // In frames, the model molds session-specific transform and xform
  if (type == "frame") {
    model = {transform: attrs.transform};}
  else {
    model = attrs;}
  this.model = model;
}

function focus(entity) {
  highlight(entity);
  setAttr(entity.controls, {visibility: "visible"});}

function getViews(entity) {
  return [].concat(...entity.viewLayers)}

function deregister(entity) {
  // Remove from DOM, the shape's still around for undo/redo
  state.unfocus(entity);
  entity.active = false;
  for (let {el} of entity.views) { el.remove() }
  entity.views.length = 0;  // The views will be re-created anew when registered
  entity.controls.remove();
  entity.box.remove();
  if (entity.type == "frame") { entity.axes.remove() }}

function moveEntity(entity, [dx,dy]) {
  let model = entity.model;
  if (model.tag == "line") {
    let {x1,y1,x2,y2} = model;
    setUndoable(entity, {x1:x1+dx, y1:y1+dy,
                         x2:x2+dx, y2:y2+dy});}
  else {
    let m = entity.model.transform;
    setUndoable(entity, {transform:translate(m, [dx,dy])});}}

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

function registerShape(shape) {
  // "shape" should have its index value initialized already
  controlLayer.appendChild(shape.controls);
  boxLayer.insertBefore(shape.box, (shape.next ? shape.next.box : null));
  assert(shape.viewLayers.length == 0);
  let layers = getLayers();
  var depth = 0;
  for (let layer of layers) {
    for (let frame of layer) {
      newShapeView(shape, frameShapes(frame), depth);}
    depth++;}
  shape.active = true;}

function registerFrame(frame) {
  // "frame" should have its index value initialized already
  controlLayer.appendChild(frame.controls);
  insertAt(boxLayer, frame.box, index);
  assert(getViews(frame).length == 0);
  axesLayer.appendChild(frame.axes);
  if (!frame.prev && !frame.next) {
    // If there were no nested frames before this
    // then the DOM tree only had zero-depth.
    // Since it's pointless to have overlapping elements
    newFrameView(frame, frameNested(DOMRoot), null, treeDepth-1)}
  else {
    if (frame.next) {
      var depth = 0;
      for (let layer of frame.next.viewLayers) {
        for (let view of layer) {
          newFrameView(frame, view.parent, view.el, depth)}
        depth++;}}
    else {// Exact same thing, but anchored based on the previous frame
      var depth = 0;
      for (let layer of frame.prev.viewLayers) {
        for (let view of layer) {
          newFrameView(frame, view.parent, null, depth)}
        depth++;}}}
  frame.active = true;}

function setEntity(entity, attrs) {
  let model = entity.model;
  model.merge(model, attrs);
  for (let {el} of entity.views) {
    setAttr(el, {[k]: v})}

  if (entity.tag == "line") {
    for (let [k,v] of Object.entries(entity)) {
      linePropagate(entity, k, v)}}
  else {
    for (let [k,v] of Object.entries(entity)) {
      propagate2D(entity, k, v)}}}

function setUndoable(entity, attrs) {
  setEntity(entity, attrs)
  let model = entity.model;
  let before = {};
  for (let k in attrs) {before[k] = model[k]}
  issueCmd({entity, action:"edit", before, after:attrs});}

function highlight(shape)   {setAttr(shape.box, {visibility: "visible"})}
function unhighlight(shape) {setAttr(shape.box, {visibility: "hidden"})}

function unfocus(shape) {
  unhighlight(shape);
  setAttr(controls, {visibility: "hidden"});}

function addEntityView(entity, el, parent, depth) {
  // Add a view to the correct layer
  let layers = entity.viewLayers;
  // Padding to fill the depth
  if (layers.length < depth+1) {
    for (let it = layers.length; it <= depth; it++) {
      layers.push([])}}
  layers[depth].push({el, parent});}

// Make a DOM element whose attribute is linked to the model
// The index is the layer index, if it's null then append at the front
function newShapeView(shape, parent, depth) {
  let model = shape.model;
  assert(model, "Model is supposed to be initialized");
  let el = es(shape.tag, model);
  parent.insertBefore(el, shape.next);
  addEntityView(shape, el, parent, depth);
  return el;}

// Make a DOM element whose attribute is linked to the model
function newFrameView(frame, parent, nextView, depth) {
  // Returns a <g> element whose transform is synced with the given frame
  // If depth > 0, recurse down
  let [a,b,c,d,e,f] = frame.transform;
  let xform = frame.xform;
  let echos = es("g", {class:"frame-shapes"});
  let el = es("g", {class:"frame", transform:xform},
              [echos]);
  parent.insertBefore(el, nextView);
  for (let shape of shapeList.list()) {
    newShapeView(shape, echos)}
  // If this should be a branch: make a forest of nodes of the depth level
  if (depth > 0) {
    el.appendChild(makeLayer(depth-1));}

  addEntityView(el, parent, depth);
  return el;}

var treeDepth = 1;  // Depth of the deepest node
function frameShapes(frame) {return frame.children[0]}
function frameNested(frame) {return frame.children[1]}
function isLeaf(frame) {
  return (frame.getElementsByClassName("frame-nested").length == 0);}

/** Make frames of "depth", then put them to a group. */
function makeLayer(depth, frames, index) {
  let g = es("g", {class:"frame-nested"});
  for (let frame of frames) {
    frame.newView(g, depth, frames, index)}
  return g;}

/** Increment the current frame count */
function incDepth() {
  let flist = frameList.list();
  for (let frame of flist) {
    let layers = frame.viewLayers;
    let leaves = layers[layers.length - 1];
    for (let leaf of leaves) {
      leaf.appendChild( makeLayer(0, flist) )}
    treeDepth++;}}

/** Decrement the current frame count */
function decDepth() {
  assert(treeDepth > 0);
  // Again, there's a space case when there's no nested frame
  if (layers.length > 1) {
    for (let frame of layers[layers.length-2])
      frameNested(frame).remove();
    for (let frame of frameList.list()) {
      for (let {el} of frame.viewLayers[treeDepth-2]) {
        el.remove();}}}
  frame.viewLayers.length = treeDepth-1;
  treeDepth--;}

// What happens when the user clicks the "create button"
function addEntity(type, mold) {
  let entity = new Entity(type, mold);
  if (type == "shape") {
    shapeList.insertAfter(entity, shapeList.getLast());
    registerShape(entity);}
  else {
    frameList.insertAfter(entity, frameList.getLast());
    registerFrame(entity);}
  // new shapes get rendered to the front, so added to the back of the list
  issueCmd({action:"create", entity});}

{// The DOM
  let tile = es("pattern", {id:"tile",
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
  boxLayer = es("g", {id:"boxes"});
  // This is the only "onMouseMove" event
  function surfaceOnMouseMove(evt) {
    if (evt.buttons == 1) {
      mouseManager.handle(evt);
      let focused = state.getFocused();
      if (focused &&
          ((evt.movementX != 0) || (evt.movementY != 0))) {
        // If dragging & there's a listener, we checked for zero since there's a bug with "ctrl+click" that triggerse this event, even when there's no movement
        focused.moveFn(mouseOffset(), evt);
        // Cancel bubble, so svg won't get pan/zoom event
        evt.cancelBubble = true;}}}

  // This layer holds all the axes, so we can turn them all on/off
  axesLayer = es("g", {id:"axes"},
                 [// The identity frame (decoration)
                   es("use", {id:"the-frame", href:"#frame",
                              transform:[theD,0, 0,theD, 0,0]})])

  svg_el = es("svg", {id:"svg", width:W+1, height:H+1, fill:"black"},
              // "W+1" and "H+1" is to show the grid at the border
              // pan-zoom wrapper wrap around here
              [es("g", {id:"surface",
                        onMouseMove: surfaceOnMouseMove,
                        onMouseUp: (evt) => {
                          controlChanged = true;
                          mouseManager.handle(evt);},
                        onMouseDown: (evt) => {state.focus(null);
                                               mouseManager.handle(evt);}},
                  [// Definitions
                    es("defs", {id:"defs"}, [tile, frameDef]),
                    // The grid
                    es("rect", {id:"grid",
                                width:2*W+1, height:2*H+1,
                                // Offset so that things will be in the middle
                                x:-W/2, y:-H/2,
                                fill:"url(#tile)"}),
                    // Due to event propagation, events not handled by any shape will be handled by the surface
                    DOMRoot, axesLayer, boxLayer, controlLayer])]);

  let UI = e("div", {id:"UI"},
             [// Shape creation
               e("button", {onClick: (evt) => {addEntity("shape", rectMold)}},
                 [et("Rectangle")]),
               e("button", {onClick: (evt) => {addEntity("shape", circMold)}},
                 [et("Circle")]),
               e("button", {onClick: (evt) => {addEntity("shape", lineMold)}},
                 [et("Line")]),
               e("button", {onClick: (evt) => {addEntity("shape", trigMold)}},
                 [et("Triangle")]),
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
               e("button", {onclick: (evt) => {
                 let focused = state.getFocused();
                 if (focused) {
                   deregister(focused);
                   let list =
                       (focused.type == "frame") ? activeFrames() : activeShapes();
                   list.splice(focused.index, 1)
                   list.unshift(focused);
                   focused.index = 0;
                   register(focused);}}},
                 [et("Send to back")]),
               e("button", {onclick: (evt) => {}},
                 [et("Send backward")]),
               e("button", {onclick: (evt) => {}},
                 [et("Send forward")]),
               e("button", {onclick: (evt) => {}},
                 [et("Send to front")]),
             ]);
  app.appendChild(UI);
  app.appendChild(svg_el);
  // SVG panzoom only works with whole SVG elements
  panZoom = svgPanZoom("#svg", {dblClickZoomEnabled: false,
                                // Don't do any bullshit on startup
                                fit:false, center:false});
  panZoom.pan({x:20, y:20});}
