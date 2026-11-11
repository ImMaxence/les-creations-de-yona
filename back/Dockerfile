# syntax=docker/dockerfile:1

# --- Build: compiles the jar, then splits it into layers ordered from least to most often changed.
FROM eclipse-temurin:25.0.4.1_1-jdk-resolute AS build
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
COPY src/ src/
# The Maven repository is cached between builds, outside the image.
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw --batch-mode --quiet -DskipTests package \
 && cp target/back-*.jar application.jar \
 && java -Djarmode=tools -jar application.jar extract --layers --destination extracted

# --- Runtime: JRE only, plus the PostgreSQL client used by the backup.
FROM eclipse-temurin:25.0.4.1_1-jre-resolute
# Ubuntu 26.04 ships postgresql-client-18, the server's major version, as pg_dump requires.
# curl serves the container health check.
RUN apt-get update \
 && apt-get install --yes --no-install-recommends postgresql-client-18 curl \
 && rm -rf /var/lib/apt/lists/*
ENV PG_DUMP_PATH=/usr/lib/postgresql/18/bin/pg_dump

RUN useradd --system --no-create-home --shell /usr/sbin/nologin yona
USER yona
WORKDIR /app
COPY --from=build /build/extracted/dependencies/ ./
COPY --from=build /build/extracted/spring-boot-loader/ ./
COPY --from=build /build/extracted/snapshot-dependencies/ ./
COPY --from=build /build/extracted/application/ ./

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=5 \
    CMD curl --fail --silent --output /dev/null http://127.0.0.1:8080/actuator/health || exit 1
# The JVM on its defaults (2.6.1), but for the heap: 512 MB at most, instead of a quarter of the
# machine's memory. Both compilers (C1 then C2), garbage collector and compiler threads for every
# core. The other limits of 1.12 and 1.13 (C1 only, 2 cores, periodic collections, trimming) are
# gone: see docs/developpement.md.
# libwebp is a native library: Java 24+ requires native access to be granted explicitly.
ENTRYPOINT ["java", "-Xmx512m", "--enable-native-access=ALL-UNNAMED", "-jar", "application.jar"]
