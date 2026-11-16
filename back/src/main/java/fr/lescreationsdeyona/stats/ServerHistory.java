package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.media.Schema;
import java.sql.ResultSet;
import java.sql.SQLException;
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
 * see how the backend behaves over time (its memory after a day, the busy hours). Since 2.21, also the
 * counters of the whole server (processor time, network card, gateway), which only ever grow: two
 * measures in a row give the load, the estimated draw and the traffic between them, even across a
 * stop of the backend (the counters of the server went on).
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
			long heapUsedBytes, long machineUsedBytes,
			@Schema(description = "Average share of the processors of the whole server, 0 to 1 (2.21)") @Nullable Double serverCpu,
			@Schema(description = "Average estimated draw of the server, in watts") @Nullable Double watts,
			@Schema(description = "Average bytes per second received by the network card of the server") @Nullable Double hostReceivedPerSecond,
			@Nullable Double hostSentPerSecond,
			@Schema(description = "Average bytes per second the site (its gateway) received from the visitors") @Nullable Double siteReceivedPerSecond,
			@Nullable Double siteSentPerSecond) {
	}

	/** The whole period, from its measures; {@code since}: the first of them, later than the period's start on a new server. */
	public record ServerTotals(@Schema(description = "Estimated energy, in kWh") @Nullable Double energyKwh,
			@Schema(description = "Estimated draw on average, in watts") @Nullable Double averageWatts,
			@Schema(description = "Estimated cost of that energy, in euros") @Nullable Double euros,
			@Nullable Long hostReceivedBytes, @Nullable Long hostSentBytes, @Nullable Long siteReceivedBytes, @Nullable Long siteSentBytes,
			@Nullable Instant since) {
	}

	public record ServerHistoryView(List<ServerPoint> points, ServerTotals totals) {
	}

	/**
	 * Each measure next to the one before (a day earlier at most): the time between them, the load of the
	 * server, its estimated draw, and what each counter added (a counter lower than before started again
	 * from 0, after a restart of the server or of the gateway).
	 */
	private static final String STEPS = """
			with raw as (
				select sampled_at, backend_cpu, machine_cpu, backend_memory_bytes, heap_used_bytes, machine_used_bytes,
					extract(epoch from sampled_at - lag(sampled_at) over w)::float8 as seconds,
					cpu_total_ticks - lag(cpu_total_ticks) over w as total_ticks,
					cpu_idle_ticks - lag(cpu_idle_ticks) over w as idle_ticks,
					%s, %s, %s, %s
				from server_sample where sampled_at > :from - interval '1 day'
				window w as (order by sampled_at)
			), loaded as (
				select *, case when total_ticks > 0 and idle_ticks between 0 and total_ticks then 1 - idle_ticks::float8 / total_ticks end as server_cpu
				from raw where sampled_at > :from
			), step as (
				select *, :idle + (:full - :idle) * server_cpu as watts, (:idle + (:full - :idle) * server_cpu) * seconds / 3600 as energy_wh
				from loaded
			)
			""".formatted(added("host_received_bytes"), added("host_sent_bytes"), added("site_received_bytes"), added("site_sent_bytes"));

	private final JdbcClient jdbc;

	private final MachineCounters counters;

	private final MachineProperties properties;

	ServerHistory(JdbcClient jdbc, MachineCounters counters, MachineProperties properties) {
		this.jdbc = jdbc;
		this.counters = counters;
		this.properties = properties;
	}

	@Scheduled(fixedRate = 600_000, initialDelay = 60_000)
	void sample() {
		MachineCounters.Measure measure = counters.measure();
		ServerUsage usage = ServerUsage.now(measure.rates());
		MachineCounters.Reading reading = measure.reading();
		jdbc.sql("""
				insert into server_sample (sampled_at, backend_cpu, machine_cpu, backend_memory_bytes, heap_used_bytes, machine_used_bytes,
					cpu_total_ticks, cpu_idle_ticks, host_received_bytes, host_sent_bytes, site_received_bytes, site_sent_bytes)
				values (:at, :backendCpu, :machineCpu, :backendMemory, :heap, :machine,
					:cpuTotal, :cpuIdle, :hostReceived, :hostSent, :siteReceived, :siteSent) on conflict do nothing""")
			.param("at", OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.SECONDS))
			.param("backendCpu", usage.backendCpuLoad())
			.param("machineCpu", usage.machineCpuLoad())
			.param("backendMemory", usage.backendMemoryBytes())
			.param("heap", usage.heapUsedBytes())
			.param("machine", Math.max(0, usage.machineMemoryBytes() - usage.machineFreeMemoryBytes()))
			.param("cpuTotal", reading.cpu() == null ? null : reading.cpu().total())
			.param("cpuIdle", reading.cpu() == null ? null : reading.cpu().idle())
			.param("hostReceived", reading.host() == null ? null : reading.host().received())
			.param("hostSent", reading.host() == null ? null : reading.host().sent())
			.param("siteReceived", reading.site() == null ? null : reading.site().received())
			.param("siteSent", reading.site() == null ? null : reading.site().sent())
			.update();
	}

	@Scheduled(cron = "0 55 4 * * *", zone = "Europe/Paris")
	void eraseExpired() {
		jdbc.sql("delete from server_sample where sampled_at < :before")
			.param("before", OffsetDateTime.now(ZoneOffset.UTC).minus(KEPT))
			.update();
	}

	/** The last {@code days} days, in {@link #POINTS} slices at most, the oldest first, and their totals. */
	ServerHistoryView view(int days) {
		return new ServerHistoryView(points(days), totals(days));
	}

	List<ServerPoint> points(int days) {
		long sliceSeconds = Math.max(EVERY.toSeconds(), Duration.ofDays(days).toSeconds() / POINTS);
		return jdbc.sql(STEPS + """
				select to_timestamp(floor(extract(epoch from sampled_at) / :slice) * :slice) as slice,
					avg(backend_cpu) as backend_cpu, avg(machine_cpu) as machine_cpu,
					max(backend_memory_bytes) as backend_memory, max(heap_used_bytes) as heap, max(machine_used_bytes) as machine,
					sum(server_cpu * seconds) / nullif(sum(seconds) filter (where server_cpu is not null), 0) as server_cpu,
					sum(energy_wh) * 3600 / nullif(sum(seconds) filter (where energy_wh is not null), 0) as watts,
					%s, %s, %s, %s
				from step group by slice order by slice""".formatted(rate("host_received_bytes"), rate("host_sent_bytes"),
						rate("site_received_bytes"), rate("site_sent_bytes")))
			.param("slice", sliceSeconds)
			.param("from", OffsetDateTime.now(ZoneOffset.UTC).minusDays(days))
			.param("idle", properties.idleWatts())
			.param("full", properties.fullWatts())
			.query((row, index) -> new ServerPoint(row.getObject("slice", OffsetDateTime.class).toInstant(),
					row.getObject("backend_cpu", Double.class), row.getObject("machine_cpu", Double.class),
					row.getObject("backend_memory", Long.class), row.getLong("heap"), row.getLong("machine"),
					row.getObject("server_cpu", Double.class), row.getObject("watts", Double.class),
					row.getObject("host_received_bytes", Double.class), row.getObject("host_sent_bytes", Double.class),
					row.getObject("site_received_bytes", Double.class), row.getObject("site_sent_bytes", Double.class)))
			.list();
	}

	ServerTotals totals(int days) {
		return jdbc.sql(STEPS + """
				select sum(energy_wh) as energy_wh, sum(seconds) filter (where energy_wh is not null) as energy_seconds,
					sum(host_received_bytes)::bigint as host_received_bytes, sum(host_sent_bytes)::bigint as host_sent_bytes,
					sum(site_received_bytes)::bigint as site_received_bytes, sum(site_sent_bytes)::bigint as site_sent_bytes,
					min(sampled_at - make_interval(secs => seconds))
						filter (where energy_wh is not null or host_received_bytes is not null or site_received_bytes is not null) as since
				from step""")
			.param("from", OffsetDateTime.now(ZoneOffset.UTC).minusDays(days))
			.param("idle", properties.idleWatts())
			.param("full", properties.fullWatts())
			.query((row, index) -> totals(row, properties.eurosPerKwh()))
			.single();
	}

	private static ServerTotals totals(ResultSet row, double eurosPerKwh) throws SQLException {
		Double energyWh = row.getObject("energy_wh", Double.class);
		Double seconds = row.getObject("energy_seconds", Double.class);
		OffsetDateTime since = row.getObject("since", OffsetDateTime.class);
		return new ServerTotals(energyWh == null ? null : energyWh / 1000,
				energyWh == null || seconds == null || seconds <= 0 ? null : energyWh * 3600 / seconds,
				energyWh == null ? null : energyWh / 1000 * eurosPerKwh,
				row.getObject("host_received_bytes", Long.class), row.getObject("host_sent_bytes", Long.class),
				row.getObject("site_received_bytes", Long.class), row.getObject("site_sent_bytes", Long.class),
				since == null ? null : since.toInstant());
	}

	/** What the counter {@code column} added since the measure before, under the same name. */
	private static String added(String column) {
		String before = "lag(" + column + ") over w";
		return "case when %1$s is null or %2$s is null then null when %1$s >= %2$s then %1$s - %2$s else %1$s end as %1$s".formatted(column, before);
	}

	/** Bytes per second over the measured part of the slice. */
	private static String rate(String column) {
		return "sum(%1$s)::float8 / nullif(sum(seconds) filter (where %1$s is not null), 0) as %1$s".formatted(column);
	}

}
