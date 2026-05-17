FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Copy Maven Wrapper nếu có
COPY mvnw pom.xml ./
COPY .mvn .mvn/
RUN chmod +x ./mvnw || true

# Pre-fetch dependencies to leverage Docker caching
RUN mvn dependency:go-offline -B

# Copy source
COPY src ./src

# Build
RUN mvn package -Dmaven.test.skip=true

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]