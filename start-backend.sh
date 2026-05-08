#!/bin/bash
set -e

cd /Volumes/Thang/UNIHUB
source .env

export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
export DB_URL="${DB_URL}"
export DB_USER="${DB_USER}"
export DB_PASS="${DB_PASS}"

cd src/BE/workshop
./mvnw spring-boot:run
