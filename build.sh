#!/bin/bash
# Argument: the version number
VERSION=$1
# Build the container
sudo docker build -t lackhoa/fractal-sky:$VERSION .
# Try running the docker
sudo docker run --rm -p 80:80 lackhoa/fractal-sky:$VERSION
# Push to the docker registry
sudo docker push lackhoa/fractal-sky:$VERSION

# Deploying to Digital Ocean k8s (must change the version in "manifest.yaml" first)
CLUSTER="fractal-sky"
CONTEXT="do-lon1-${CLUSTER}"
kubectl --context ${CONTEXT} apply -f manifest.yaml
