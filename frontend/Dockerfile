# This image is hosted on lackhoa/fractal-sky
# Start from a Node.js 10 (LTS) image
FROM node:10

# Copy package files and install dependencies BEFORE copying the source code to optimize build time
COPY package*.json ./
RUN npm install

# Copy all app files into the image
COPY . .

EXPOSE 80
# The default command to run when starting the container
CMD [ "npm", "start" ]
