package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.media.Schema;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * Memory and processor in use, read when the statistics are asked for. The backend measures itself
 * (its Java process) and the machine as its container sees it: the memory limit given to the
 * container, or the server's memory without limit. The other containers (pages of the site,
 * database, photos) have their own process, not counted in "backend".
 */
public record ServerUsage(
		@Schema(description = "Processors the backend may use") int processors,
		@Schema(description = "Share of those processors used by the backend lately, from 0 to 1; absent when unknown")
		@Nullable Double backendCpuLoad,
		@Schema(description = "Share used by the whole machine (or container) lately, from 0 to 1; absent when unknown")
		@Nullable Double machineCpuLoad,
		@Schema(description = "Memory of the backend process (resident), in bytes; absent outside Linux")
		@Nullable Long backendMemoryBytes,
		@Schema(description = "Java objects in memory now, in bytes") long heapUsedBytes,
		@Schema(description = "Most the Java objects may take, in bytes") long heapMaxBytes,
		@Schema(description = "Memory of the machine, or limit of the container, in bytes") long machineMemoryBytes,
		@Schema(description = "Of which available, disk cache the system gives back included, in bytes") long machineFreeMemoryBytes,
		@Schema(description = "Since the backend started, in seconds") long uptimeSeconds) {

	private static final Pattern RESIDENT = Pattern.compile("^VmRSS:\\s+(\\d+)\\s+kB", Pattern.MULTILINE);

	private static final Pattern MEM_TOTAL = Pattern.compile("^MemTotal:\\s+(\\d+)\\s+kB", Pattern.MULTILINE);

	private static final Pattern MEM_AVAILABLE = Pattern.compile("^MemAvailable:\\s+(\\d+)\\s+kB", Pattern.MULTILINE);

	private static final Pattern INACTIVE_FILE = Pattern.compile("^inactive_file\\s+(\\d+)$", Pattern.MULTILINE);

	static ServerUsage now() {
		MemoryUsage heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
		Runtime runtime = Runtime.getRuntime();
		long heapMax = heap.getMax() > 0 ? heap.getMax() : runtime.maxMemory();
		long machineMemory = 0;
		long machineFree = 0;
		Double backendCpu = null;
		Double machineCpu = null;
		if (ManagementFactory.getOperatingSystemMXBean() instanceof com.sun.management.OperatingSystemMXBean os) {
			machineMemory = os.getTotalMemorySize();
			machineFree = availableBytes(machineMemory, os.getFreeMemorySize(), Path.of("/proc/meminfo"), Path.of("/sys/fs/cgroup/memory.stat"));
			backendCpu = load(os.getProcessCpuLoad());
			machineCpu = load(os.getCpuLoad());
		}
		return new ServerUsage(runtime.availableProcessors(), backendCpu, machineCpu, residentBytes(Path.of("/proc/self/status")),
				heap.getUsed(), heapMax, machineMemory, machineFree,
				ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
	}

	/** Negative when the system cannot tell. */
	private static @Nullable Double load(double load) {
		return load < 0 || Double.isNaN(load) ? null : Math.min(load, 1);
	}

	/** "VmRSS: 123456 kB" of /proc/self/status: the memory the process really holds. */
	static @Nullable Long residentBytes(Path status) {
		Long kilobytes = number(RESIDENT, status);
		return kilobytes == null ? null : kilobytes * 1024;
	}

	/**
	 * Memory really at hand. Java's "free" leaves out the disk cache, which Linux fills as it reads
	 * files and gives back on demand: a server up for a while would look full. So: MemAvailable for
	 * the whole machine; for a container with a limit, its free memory plus its inactive disk cache.
	 * Java's figure stays when these files cannot be read (not Linux).
	 */
	static long availableBytes(long total, long free, Path memInfo, Path containerStat) {
		Long machineKilobytes = number(MEM_TOTAL, memInfo);
		if (machineKilobytes != null && total >= machineKilobytes * 1024) {
			Long available = number(MEM_AVAILABLE, memInfo);
			return available == null ? free : Math.min(total, available * 1024);
		}
		Long inactive = number(INACTIVE_FILE, containerStat);
		return inactive == null ? free : Math.min(total, free + inactive);
	}

	private static @Nullable Long number(Pattern pattern, Path file) {
		try {
			Matcher matcher = pattern.matcher(Files.readString(file));
			return matcher.find() ? Long.valueOf(matcher.group(1)) : null;
		}
		catch (IOException | RuntimeException ex) {
			// Not Linux, or not readable: the other figures are still given
			return null;
		}
	}

}
