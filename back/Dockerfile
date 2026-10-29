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
# Memory kept low on a small server: about 420 MB at rest instead of 700 to 800 MB before 1.12 (75 % of
# the host's RAM was allowed to the heap, kept once grown). Measured with Native Memory Tracking:
# - heap capped at 320 MB, enough for the largest photo being converted (live data: about 70 MB);
# - G1 runs a collection every minute when idle and gives the free heap back (free ratios), e.g.
#   after a photo upload; its threads, and the compiler's, sized for 2 cores rather than all of the
#   host's (each one has its own memory);
# - the native memory freed by the compiler handed back to the system every minute (trim), and 2
#   malloc arenas instead of 8 per core;
# - compact object headers (Java 25): smaller objects.
ENV MALLOC_ARENA_MAX=2
# libwebp is a native library: Java 24+ requires native access to be granted explicitly.
ENTRYPOINT ["java", "-Xms32m", "-Xmx320m", "-XX:+UseG1GC", "-XX:G1PeriodicGCInterval=60000", \
    "-XX:MinHeapFreeRatio=10", "-XX:MaxHeapFreeRatio=30", "-XX:ParallelGCThreads=2", "-XX:ConcGCThreads=1", \
    "-XX:CICompilerCount=2", "-XX:TrimNativeHeapInterval=60000", "-XX:+UseCompactObjectHeaders", \
    "--enable-native-access=ALL-UNNAMED", "-jar", "application.jar"]
