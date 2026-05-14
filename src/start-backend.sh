#!/bin/bash
set -e

SRC_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$SRC_ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
fi

if [ -d /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
  export PATH="$JAVA_HOME/bin:$PATH"
fi

cd BE/workshop
./mvnw spring-boot:run
