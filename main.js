'use strict';
let log = console.log;
let [W, H] = [801, 481];

// Handle keyDown events
// https://stackoverflow.com/a/1648854/2276361
// Read that regarding the difference between handling the event as a function vs in the HTML attribute definition.
function onKeyDown(evt) {}
document.onkeydown = onKeyDown;

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g,
                                                      c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))}

let EVENT_LIST = ["onMouseMove", "onMouseEnter", "onMouseLeave", "onMouseUp", "onMouseDown", "onClick"];
function setAttr(el, data) {
  for (let [k, v] of Object.entries(data)) {
    if (k == "transform") {
      console.assert(v.length == 6);  // `v` is a 6-array
      el.setAttribute("transform", `matrix(${v.join(" ")})`);}
    else if (k == "style") {
      for (let [sk, sv] of Object.entries(v)) {el.style[sk] = sv;}}
    else if (EVENT_LIST.includes(k)) {
      // Don't include these as attributes, better performance and avoid ES5/6 bugs
      // The "substring" is to remove the "on", because... I don't fucking know?
      el.addEventListener(k.substring(2).toLowerCase(), v);}
    else {el.setAttribute(k, v);}}
  return el;}

// Element-creation functions
function e(type, data, children=[]) {
  let ns = data.xmlns || "http://www.w3.org/1999/xhtml";
  let el = document.createElementNS(ns, type);
  setAttr(el, data);
  for (let c of children) {el.appendChild(c);};
  return el;}
let SVG_NS = "http://www.w3.org/2000/svg";
// Create svg element
function es(type, data, children=[]) {
  return e(type, {...data, xmlns:SVG_NS}, children);}
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
let commonShape = {fill:"transparent", stroke:"black",
                   style: {cursor:"move"}, "vector-effect": "non-scaling-stroke"};
let rectModel = {...commonShape,
                 type:"rect", width:1, height:1};
let frameModel = {...rectModel};
let circleModel = {...commonShape,
                   type:"circle", cx:0.5, cy:0.5, r:0.5};
let lineModel = {...commonShape,
                 type: "line", x1: 0, y1: 0, x2: 1, y2: 1};

// Translation is applied to both the surface and the shapes
// Shapes are under 2 translations: by the view and by user's arrangement
var shapes = [];  // List of shape-groups
var mouseDown = null;  // Previous mouse position (if it's down)
var xforms = {};  // Store the transformations, for fast modification
var focused = null;  // The focused shape-group
var moveFn = null;  // Movement listener
var panZoom = null;  // A third-party thing will be init later

// Adding a shape from a model
let DEFAULT_SCALE = 100;

class Rect {
  // Creates and adds a group containing the shape and its controls to the DOM
  constructor() {
    // Randomize spawn location
    let {x,y} = panZoom.getPan();
    let z = panZoom.getZoom();
    let [rx,ry] = [(Math.random())*20, (Math.random())*20];
    // Initialize state (fields which can be saved, so DON'T MUTATE them)
    this.id = uuidv4();
    // panZoom's transform is: array V ➾ P(V) = zV+Δ (where Δ = [x,y])
    // We want to skew that result to just be zV
    // So we substitute V for (V - Δ/z)
    this.xform = [DEFAULT_SCALE,0, 0,DEFAULT_SCALE,
                  (-x+rx)/z, (-y+ry)/z]

    // Rect-specific
    this.model = rectModel;

    // DOM element representing this shape
    let model = this.model;  // You want this overridden
    this.controlGroup = es("g", {visibility: "hidden",
                                 // Allways handle mouse event, visible or not
                                 "pointer-events": "all"},
                           [es(frameModel.type,
                               {...frameModel,
                                fill: "blue",  // Experimental
                                onMouseEnter: (evt) => shapeOnMouseEnter(this),
                                onMouseLeave: (evt) => shapeOnMouseLeave(this),
                                onMouseDown: (evt) => shapeOnMouseDown(evt, this, this.move)})]);
    this.el = es("g", {id:this.id, transform:this.xform},
                 [es(model.type, model), this.controlGroup,]);
    // Now we add the element to the DOM
    let objects = document.getElementById("objects");
    objects.appendChild(this.el);}

  showControls() {
    setAttr(this.controlGroup, {visibility: "visible"})}
  hideControls() {
    setAttr(this.controlGroup, {visibility: "hidden"})}

  move(dx, dy) {
    // Movement is calculated from offset, so panning doesn't matter, but zoom does
    let z = panZoom.getZoom();
    // panZoom's transform is: array V ➾ P(V) = zV+Δ (where Δ = [x,y])
    // Movement: V → U, and we want P(U) = zV + Δ + δ (where δ = [x-x0, y-y0])
    // So let U := V+δ/z
    let [a,b,c,d,e,f] = this.xform;
    this.xform = [a,b,c,d, e+dx/z, f+dy/z];
    // Note: we update transform on the whole DOM group
    setAttr(this.el, {transform: this.xform});}

  serialize() {return {id: this.id, xform: this.xform, model: this.model}}}

// "that" is the shape-group responsible for calling this
function shapeOnMouseEnter(that) {
  if (!mouseDown) {that.showControls()}}

// "that" is the shape-group responsible for calling this
function shapeOnMouseLeave(that) {
  // Unless the user clicked on the element, hide controls
  if (that != focused) {that.hideControls()}}

function shapeOnMouseDown(evt, that, msg) {
  // evt.preventDefault();
  evt.cancelBubble = true;  // Cancel bubble, so svg won't get pan/zoom event
  // "that" is the shape-group sending the event
  mouseDown = [evt.clientX, evt.clientY];
  if (focused) {focused.hideControls()}  // Transfer focused
  focused = that;
  focused.showControls();
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
  let lGrid = es("pattern",
                 {id:"largeGrid",
                  width:80, height:80, patternUnits:"userSpaceOnUse"},
                 [es("rect", {width:80, height:80, fill:"none"}),
                  es("path", {d:"M 80 0 H 0 V 80",
                              fill:"none", stroke:"#777777", strokeWidth:2})]);

  let app = document.getElementById("app");
  let svg_el = es("svg", {id:"svg", width:W, height:H, fill:"black"},
                  // pan-zoom wrapper wrap around here
                  [es("g", {id:"surface",
                            onMouseMove: surfaceOnMouseMove,
                            onMouseUp: ((evt) => {mouseDown = null})},
                      [es("defs", {id:"defs"}, [lGrid]),
                       es("rect",
                          {id:"grid", width:W, height: H,
                           fill: "url(#largeGrid)"}),
                       // Due to event propagation, events that aren't handled by any objects will be handled by the surface
                       es("g", {id:"objects"})])]);

  let controls = e("div", {id:"controls"},
                   [e("button", {onClick: (evt) => new Rect()},
                      [et("Rectangle")]),
                    // e("button", {onClick: (evt) => new Circle()},
                    //   [et("Circle")]),
                    // e("button", {onClick: (evt) => new Line()},
                    //   [et("Line")])
                   ]);
  app.appendChild(controls);
  app.appendChild(svg_el);
  // SVG panzoom only works with whole SVG elements
  panZoom = svgPanZoom("#svg");}

// @TodoList
// Save & restore is of highest priority
// Shape modification: ids for the control points are lists: the control is centralized, as usual
// Change viewport size depending on the device
// Sort it out with the mutation
