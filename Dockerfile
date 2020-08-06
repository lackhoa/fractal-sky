# Start from a Node.js 10 (LTS) image
FROM node:10

# Specify the directory inside the image in which all commands will run
WORKDIR /usr/src/app

# Copy package files and install dependencies BEFORE copying the source code to optimize build time
COPY app/package*.json ./
RUN npm install

# Copy all app files into the image
COPY app/ .

# The default command to run when starting the container
CMD [ "npm", "start" ]