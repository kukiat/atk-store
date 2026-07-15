#!/usr/bin/env bash
set -euo pipefail

TAG="${1:?Usage: script/docker-img.sh <tag>}"
IMAGE="armdocker123/atk-store:${TAG}"

docker buildx build --platform linux/amd64 -t "${IMAGE}" .
docker push "${IMAGE}"



# bash script/docker-img.sh v1.0.4
# armdocker123/atk-store:v1.0.4