#!/bin/bash
# Argument: the version number
VERSION=$1
# Build the container
sudo docker build -t lackhoa/fractal-sky:$VERSION .
# Try running the docker
sudo docker run --rm -p 80:80 lackhoa/fractal-sky:$VERSION
# Push to the docker registry
sudo docker push lackhoa/fractal-sky:$VERSION
