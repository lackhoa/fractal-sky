#!/bin/bash
VERSION=$1
# Build the container
sudo docker build -t lackhoa/fractal-sky:$VERSION .
# Try running the docker
sudo docker run --rm -p 80:80 lackhoa/fractal-sky:$VERSION
# Push to the docker registry
sudo docker push lackhoa/fractal-sky:$VERSION

# Deploying to Digital Ocean
CLUSTER="fractal-sky"
CONTEXT="do-lon1-${CLUSTER}"
# Deploy from the container
kubectl --context ${CONTEXT} apply -f manifest.yaml