# fractal-sky
A diagram application with the ability to draw fractals
Hosted at https://fractalsky.xyz

# Detailed description
So there are two main parts to this web app:
- The frontend : Container hosted at lackhoa/fractal-sky
-- Pretty much the entire JavaScript application
-- Current release: v0.2b
- The backend: Container hosted at lackhoa/fractal-sky-backend
-- Connects to database to store diagrams for logged-in users
-- Current release: (Not done yet)

# The folder structure
/
- Script and config files
+ frontend/
+ backend/

# Todo
- Make sure we have both container builds running
- Create a file server, to store user diagrams
- Add glow tech
- Change the grid size when window resizes
- Design a logo for my app: for favicon, and Google login page
- I need hotkeys
- I need to see x, y and zoom
- Add copy/paste
- We can add the option to draw only the leaves
- Make move cursor smaller
- Draw the y-axis to point up
- Draw the frame boundary
- We need menu
- Add a "center" menu button, so that user will go back to land after zooming or drawing too much
- Add UI for zoom
- Add a background area, so users know what's going on
- Change properties like "stroke", "stroke-width" and "fill": go for the side-panel first, before drop-down context menu
- Try the compositional transform again
- Axes somehow must have a consistent relation to shapes
- Set up a simple help/shortcut menu
- Default rectangle should be equilateral
- Support these OAuth servers: Google, Facebook, GitHub
