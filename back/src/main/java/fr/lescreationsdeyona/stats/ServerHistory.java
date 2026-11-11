package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Memory and processor every 10 minutes, kept 90 days: the curves of the last 7, 30 or 90 days, to
 * see how the backend behaves over time (its memory after a day, the busy hours).
 */
@Service
class ServerHistory {

	static final Duration EVERY = Duration.ofMinutes(10);

	static final Duration KEPT = Duration.ofDays(90);

	/** Points of a curve, whatever the period: averages (processor) and peaks (memory) of their slice. */
	static final int POINTS = 180;

	/** A slice of the period. */
	public record ServerPoint(Instant at,
			@Schema(description = "Average share of the processors, 0 to 1") @Nullable Double backendCpu,
			@Nullable Double machineCpu,
			@Schema(description = "Peak of the slice, in bytes") @Nullable Long backendMemoryBytes,
			long heapUsedBytes, long machineUsedBytes) {
	}

	private final JdbcClient jdbc;

	ServerHistory(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	@Scheduled(fixedRate = 600_000, initialDelay = 60_000)
	void sample() {
		ServerUsage usage = ServerUsage.now();
		jdbc.sql("""
				insert into server_sample (sampled_at, backend_cpu, machine_cpu, backend_memory_bytes, heap_used_bytes, machine_used_bytes)
				values (:at, :backendCpu, :machineCpu, :backendMemory, :heap, :machine) on conflict do nothing""")
			.param("at", OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.SECONDS))
			.param("backendCpu", usage.backendCpuLoad())
			.param("machineCpu", usage.machineCpuLoad())
			.param("backendMemory", usage.backendMemoryBytes())
			.param("heap", usage.heapUsedBytes())
			.param("machine", Math.max(0, usage.machineMemoryBytes() - usage.machineFreeMemoryBytes()))
			.update();
	}

	@Scheduled(cron = "0 55 4 * * *", zone = "Europe/Paris")
	void eraseExpired() {
		jdbc.sql("delete from server_sample where sampled_at < :before")
			.param("before", OffsetDateTime.now(ZoneOffset.UTC).minus(KEPT))
			.update();
	}

	/** The last {@code days} days, in {@link #POINTS} slices at most, the oldest first. */
	List<ServerPoint> points(int days) {
		long sliceSeconds = Math.max(EVERY.toSeconds(), Duration.ofDays(days).toSeconds() / POINTS);
		return jdbc.sql("""
				select to_timestamp(floor(extract(epoch from sampled_at) / :slice) * :slice) as slice,
					avg(backend_cpu) as backend_cpu, avg(machine_cpu) as machine_cpu,
					max(backend_memory_bytes) as backend_memory, max(heap_used_bytes) as heap, max(machine_used_bytes) as machine
				from server_sample where sampled_at > :from
				group by slice order by slice""")
			.param("slice", sliceSeconds)
			.param("from", OffsetDateTime.now(ZoneOffset.UTC).minusDays(days))
			.query((row, index) -> new ServerPoint(row.getObject("slice", OffsetDateTime.class).toInstant(),
					row.getObject("backend_cpu", Double.class), row.getObject("machine_cpu", Double.class),
					row.getObject("backend_memory", Long.class), row.getLong("heap"), row.getLong("machine")))
			.list();
	}

}
