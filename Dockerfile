FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN groupadd -r jotang && useradd -r -g jotang jotang
COPY --from=build /build/target/JotangNote-0.0.1-SNAPSHOT.jar app.jar
USER jotang
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
