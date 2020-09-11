// These models define shape and their associated controls
// Note: "tag" denotes the DOM element's tag, other attributes are consistent with my DOM model
let HL_COLOR = "#0000FF55"
let commonMold = {stroke:"white",
                  "vector-effect": "non-scaling-stroke"};
let shapeFill = "#dd87e0";
let rectMold = {...commonMold, tag:"rect",
                width:1, height:1, fill:shapeFill};
let circMold = {...commonMold, tag:"circle",
                cx:0.5, cy:0.5, r:0.5, fill:shapeFill};
let trigMold = {...commonMold, tag:"path",
                d:"M 0.5 0 L 0 1 H 1 Z", fill:shapeFill};
let lineMold = {...commonMold, tag: "line"};
let lineBoxMold = {...lineMold, class:"line-box-mold",
                   "stroke-width":20, stroke:"transparent"};

let boxMold = {...commonMold, class:"box-mold", tag:"rect",
               width:1, height:1, fill:"transparent", stroke:"transparent"};
let frameBoxMold = {...commonMold, class:"frame-box-mold", tag:"rect",
                    width:1, height:1, fill:"transparent", stroke:"transparent",
                    "pointer-events":"stroke", "stroke-width":20, };
let cornerWidth = 20;
let cornerMold = {...commonMold, tag:"circle", r:cornerWidth/2,
                  fill:"transparent", stroke:"red", cursor:"move"};
let frameMold = {tag:"use", href:"#frame"};

// @Question: Not sure if these should be here?
let paramMinZoom = 0.1;
let tileDimension = 100;
let tileDef = es("pattern", {id: "svg-tile",
                             width: tileDimension,
                             height:tileDimension,
                             patternUnits:"userSpaceOnUse"},
                 [es("rect", {width: tileDimension,
                              height:tileDimension,
                              fill:"none"}),
                  es("path", {d:`M ${tileDimension} 0 H 0 V ${tileDimension}`,
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
                                d:`M ${-arr} ${1-arr} L 0 1 L ${arr} ${1-arr}`}),]);
