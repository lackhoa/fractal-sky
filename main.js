// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
var mouseDown = null;  // Previous mouse position (if it's down)
var focused = null;  // The focused shape-group
var moveFn = null;  // Movement listener
var panZoom = null;  // A third-party thing will be init later
var shapeGroups = [];  // Keep track of all added shape-groups

'use strict';
let log = console.log;
let [W, H] = [801, 481];

// Handling keyboard events
var pressedKeys = {};
window.onkeyup   = (e) => {pressedKeys[e.key] = false}
window.onkeydown = (e) => {pressedKeys[e.key] = true}

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g,
                                                      c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))}

let EVENT_LIST = ["onMouseMove", "onMouseEnter", "onMouseLeave", "onMouseUp", "onMouseDown", "onClick", "onChange"];
function setAttr(el, data) {
  for (let [k, v] of Object.entries(data)) {
    if (k == "transform") {
      console.assert(v.length == 6);  // `v` is a 6-array
      el.setAttribute("transform", `matrix(${v.join(" ")})`)}
    else if (k == "style") {
      for (let [sk, sv] of Object.entries(v)) {el.style[sk] = sv}}
    else if (EVENT_LIST.includes(k)) {
      // Don't include these as attributes, better performance and avoid ES5/6 bugs
      // The "substring" is to remove the "on", because... I don't fucking know?
      el.addEventListener(k.substring(2).toLowerCase(), v)}
    else {el.setAttribute(k, v)}}
  return el;}

// Element-creation functions
function e(tag, data, children=[]) {
  // "data.type" holds the type of the element
  let ns = data.xmlns || "http://www.w3.org/1999/xhtml";
  let el = document.createElementNS(ns, tag);
  setAttr(el, data);
  for (let c of children) {el.appendChild(c);};
  return el;}
let SVG_NS = "http://www.w3.org/2000/svg";
// Create svg element
function es(tag, data, children=[]) {
  return e(tag, {...data, xmlns:SVG_NS}, children);}
function et(text) {
  return document.createTextNode(text);}

function translate(model, tx, ty) {
  let [a,b,c,d,e,f] = model.transform || [1,0,0,1,0,0];
  // Note that translation is scaled along with the transformation matrix
  return {...model, transform: [a,b,c,d, e+tx, f+ty]};}
function tslate(model, tx, ty) {// The mutable version
  let [a,b,c,d,e,f] = model.transform || [1,0,0,1,0,0];
  model.transform = [a,b,c,d, e+tx, f+ty];}

// These models define shape and their associated controls
// Note: "tag" denotes the DOM element's tag
let commonShape = {fill:"transparent", stroke:"black",
                   "vector-effect": "non-scaling-stroke"};
let rectModel = {...commonShape,
                 tag:"rect", width:1, height:1};
let circModel = {...commonShape,
                 tag:"circle", cx:0.5, cy:0.5, r:0.5};
let lineModel = {...commonShape,
                 tag: "line", x1:0, y1:0, x2:1, y2:1};

let frameModel = {...commonShape, tag:"rect",
                  width:1, height:1, cursor:"move", fill:"#0000FF55",};
let cornerModel = {...commonShape, tag:"rect", width:0.1, height:0.1,
                   fill:"red"  // Experimental settings
                  };

// Adding a shape from a model
let DEFAULT_SCALE = 100;

class Shape2D {
  // Creates and adds a group containing the shape and its controls to the DOM
  // Optionally pass in `data` for serialization purpose
  constructor(model, data={}) {
    // Initialize state (fields which can be saved, so DON'T MUTATE them)
    this.id = data.id || uuidv4();

    // The "bounding box" of a the shape-group, responsible for receiving focus and highlighting from the user
    this.model = model;
    let {tag, ...attrs} = model;
    this.shape = es(tag, attrs);
    this.box = es(frameModel.tag,
                  {...frameModel, visibility: "hidden",
                   // Allways handle mouse event, visible or not
                   "pointer-events": "all",
                   onMouseEnter: (evt) => ctrOnMouseEnter(this),
                   onMouseLeave: (evt) => ctrOnMouseLeave(this),
                   onMouseDown: (evt) => ctrOnMouseDown(evt, this, this.move)});
    let ctag = cornerModel.tag;
    this.controls = es(
      "g", {visibility: "hidden",},
      [// Horizontal resizing (right-side)
        es(ctag, {...cornerModel, x:0.9, y:0.45,
                  cursor:"e-resize",
                  onMouseDown: (evt) => ctrOnMouseDown(evt, this, this.resizeR)}),
        // Vertical resizing (bottom-side)
        es(ctag, {...cornerModel, x:0.45, y:0.9,
                  cursor:"s-resize",
                  onMouseDown: (evt) => ctrOnMouseDown(evt, this, this.resizeB)}),
        // Bottom-right corner
        es(ctag, {...cornerModel, x:0.9, y:0.9,
                  cursor:"se-resize",
                  onMouseDown: (evt) => ctrOnMouseDown(evt, this, this.resizeBR2)})]);

    // Calculating spawn location
    if (data.xform) {this.setXform(data.xform)}
    else {
      let {x,y} = panZoom.getPan();
      let z = panZoom.getZoom();
      let [rx,ry] = [(Math.random())*20, (Math.random())*20];  // Randomize
      // panZoom's transform is: array V ➾ P(V) = zV+Δ (where Δ = [x,y])
      // Substituting (V - Δ/z) for V skews that result to just be zV
      this.setXform([DEFAULT_SCALE,0, 0,DEFAULT_SCALE,
                     (-x+rx)/z, (-y+ry)/z])}}

  register() {// The constructor does not have side-effect, this does
    // We add the view to the DOM
    shapes.appendChild(this.shape);
    controls.appendChild(this.controls)
    boxes.appendChild(this.box)
    // Register this shape-group to the app
    shapeGroups.push(this)}

  highlight() {
    setAttr(this.box, {visibility: "visible"})}
  unhighlight() {
    setAttr(this.box, {visibility: "hidden"})}
  focus() {
    this.highlight();
    setAttr(this.controls, {visibility: "visible"})}
  unfocus() {
    this.unhighlight();
    setAttr(this.controls, {visibility: "hidden"})}

  setXform(matrix) {
    this.xform = matrix;
    // Note: we update transform on the whole DOM group
    setAttr(this.shape, {transform: matrix})
    setAttr(this.box, {transform: matrix})
    setAttr(this.controls, {transform: matrix})}

  resizeBR(dx, dy) {
    // Moves the bottom-right corner
    // [dx, dy] will be offset given in screen coordinate
    let z = panZoom.getZoom();
    let [a,b,c,d,e,f] = this.xform;
    // We account for zoom
    this.setXform([a+dx/z,b, c,d+dy/z, e,f])}
  resizeBRPreserveRatio(dx, dy) {this.resizeBR(dx,dx)}
  resizeBR2(dx, dy) {// If "Shift" is pressed, preserve w/h ratio
    if (pressedKeys["Shift"]) {this.resizeBRPreserveRatio(dx,dy)}
    else {this.resizeBR(dx,dy)}}
  resizeR(dx, dy) {this.resizeBR(dx, 0)}
  resizeB(dx, dy) {this.resizeBR(0, dy)}

  move(dx, dy) {
    // Movement is calculated from offset, so panning doesn't matter, but zoom does
    let z = panZoom.getZoom();
    // panZoom's transform is: array V ➾ P(V) = zV+Δ (where Δ = [x,y])
    // Movement: V → U, and we want P(U) = zV + Δ + δ (where δ = [x-x0, y-y0])
    // So let U := V+δ/z
    let [a,b,c,d,e,f] = this.xform;
    this.setXform([a,b,c,d, e+dx/z, f+dy/z])}

  serialize() {return {id: this.id, xform: this.xform, model: this.model}}}

// "that" is the shape-group responsible for calling this
function ctrOnMouseEnter(that) {
  if (!mouseDown) {that.highlight()}}

// Note that the mouse can leave a shape being dragged, and still be dragging it (when it enters a shape on an upper layer)
function ctrOnMouseLeave(that) {if (that != focused) {that.unhighlight()}}

function ctrOnMouseDown(evt, that, msg) {
  // evt.preventDefault();
  evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
  // "that" is the shape-group sending the event
  mouseDown = [evt.clientX, evt.clientY];
  // User clicked, transfer focus to the receiving element
  if (focused) {focused.unfocus()}
  focused = that;
  focused.focus();
  moveFn = msg.bind(that);}

function surfaceOnMouseMove(evt) {
  if (mouseDown && moveFn) {// If dragging, and there's an active listener
    evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
    let [x0,y0] = mouseDown;
    // Update the mouse position for future dragging
    let [x,y] = [evt.clientX, evt.clientY];
    mouseDown = [x,y];
    // Our job is done let the active controller deal with the offset
    moveFn(x-x0, y-y0);}}

{// The DOM
  let lGrid = es("pattern", {id:"largeGrid",
                             width:80, height:80, patternUnits:"userSpaceOnUse"},
                 [es("rect", {width:80, height:80, fill:"none"}),
                  es("path", {d:"M 80 0 H 0 V 80",
                              fill:"none", stroke:"#777777", strokeWidth:2})]);

  let app = document.getElementById("app");
  // The three SVG Layers
  let shapes = es("g", {id:"shapes"});
  let controls = es("g", {id:"controls"});
  let boxes = es("g", {id:"boxes"});
  // The whole diagram
  let svg_el = es("svg", {id:"svg", width:W, height:H, fill:"black"},
                  // pan-zoom wrapper wrap around here
                  [es("g", {id:"surface",
                            onMouseMove: surfaceOnMouseMove,
                            onMouseUp: ((evt) => {mouseDown = null}),
                            onMouseDown: ((evt) => {if (this.focused) {
                              this.focused.unfocus()}})},
                      [es("defs", {id:"defs"}, [lGrid]),
                       es("rect", {id:"grid", width:W, height: H,
                                   fill: "url(#largeGrid)"}),
                       // Due to event propagation, events that aren't handled by any shape-group will be handled by the surface
                       shapes, boxes, controls])]);

  let UI = e("div", {id:"UI"},
             [// Shape creation
               e("button", {onClick: (evt) => {new Shape2D(rectModel).register()}},
                 [et("Rectangle")]),

               e("button", {onClick: (evt) => {new Shape2D(circModel).register()}},
                 [et("Circle")]),

               // Button
               e("button", {onClick: (evt) => saveDiagram()},
                 [et("Save")]),
               e("input", {type:"file", accept:".json",
                           onChange: readSingleFile})
             ]);
  app.appendChild(UI);
  app.appendChild(svg_el);
  // SVG panzoom only works with whole SVG elements
  panZoom = svgPanZoom("#svg", {dblClickZoomEnabled: false});}

// @TodoList
// @Bug: when dragging over another shape, the highlight is lost
// We definitely need the other resize controls
// Save & restore is of highest priority
// Add "send-to-front/back"
// Change viewport size depending on the device
