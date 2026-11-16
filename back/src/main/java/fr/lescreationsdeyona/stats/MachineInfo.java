package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.media.Schema;
import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * The server's hardware (2.21), as any program on it can read it without being root: its maker and model
 * (/sys/class/dmi), its processor (/proc/cpuinfo), its memory, its disks (/sys/block), its Linux. The
 * brand and speed of the memory are only written in tables kept for root: not given.
 */
public record MachineInfo(
		@Schema(description = "Maker of the computer (\"BMAX\"); absent when unknown or left blank by it") @Nullable String maker,
		@Schema(description = "Its model; absent when unknown") @Nullable String model,
		@Schema(description = "\"AMD Ryzen 7 5700U with Radeon Graphics\"") @Nullable String processor,
		@Schema(description = "Cores of the processor; absent when unknown") @Nullable Integer cores,
		@Schema(description = "Threads (logical processors) of the server") int threads,
		@Schema(description = "Memory of the server, in bytes; 0 when unknown") long memoryBytes,
		@Schema(description = "Disks, the largest first; USB keys, memory and virtual disks left out") List<Disk> disks,
		@Schema(description = "Version of Linux (\"6.8.0-49-generic\")") @Nullable String kernel,
		@Schema(description = "Since the server started, in seconds") @Nullable Long serverUptimeSeconds,
		Power power) {

	public enum DiskKind {
		NVME, SSD, HDD
	}

	public record Disk(String name, @Nullable String model, long sizeBytes, DiskKind kind) {
	}

	/** The figures of the estimate of the draw, shown with it. */
	public record Power(double idleWatts, double fullWatts, double eurosPerKwh) {
	}

	private static final Pattern MODEL_NAME = Pattern.compile("^model name\\s*:\\s*(.+)$", Pattern.MULTILINE);

	private static final Pattern CPU_CORES = Pattern.compile("^cpu cores\\s*:\\s*(\\d+)$", Pattern.MULTILINE);

	private static final Pattern PROCESSOR = Pattern.compile("^processor\\s*:", Pattern.MULTILINE);

	private static final Pattern MEM_TOTAL = Pattern.compile("^MemTotal:\\s+(\\d+)\\s+kB", Pattern.MULTILINE);

	private static final Pattern KERNEL = Pattern.compile("^Linux version (\\S+)");

	/** What makers write when they write nothing. */
	private static final Set<String> BLANK = Set.of("", "default string", "to be filled by o.e.m.", "system manufacturer", "system product name",
			"not applicable", "not specified", "o.e.m.", "oem", "none", "unknown", "type1productconfigid");

	/** Not disks: loops, memory, device mapper, RAID, CD, network blocks. */
	private static final Pattern NOT_A_DISK = Pattern.compile("^(loop|ram|zram|dm-|md|sr|nbd|fd).*");

	/** The parts that do not change while the backend runs: read once. */
	private static volatile @Nullable MachineInfo hardware;

	static MachineInfo now(MachineProperties properties) {
		MachineInfo fixed = hardware;
		if (fixed == null) {
			fixed = read(Path.of("/proc"), Path.of("/sys"));
			hardware = fixed;
		}
		return new MachineInfo(fixed.maker, fixed.model, fixed.processor, fixed.cores, fixed.threads, fixed.memoryBytes, fixed.disks, fixed.kernel,
				uptime(text(Path.of("/proc/uptime"))),
				new Power(properties.idleWatts(), properties.fullWatts(), properties.eurosPerKwh()));
	}

	static MachineInfo read(Path proc, Path sys) {
		Path dmi = sys.resolve("class/dmi/id");
		String maker = named(text(dmi.resolve("sys_vendor")));
		String model = named(text(dmi.resolve("product_name")));
		// Some mini PCs leave the product blank and name the board
		if (model == null) {
			maker = maker == null ? named(text(dmi.resolve("board_vendor"))) : maker;
			model = named(text(dmi.resolve("board_name")));
		}
		String cpuInfo = text(proc.resolve("cpuinfo"));
		String processor = cpuInfo == null ? null : first(MODEL_NAME, cpuInfo);
		String cores = cpuInfo == null ? null : first(CPU_CORES, cpuInfo);
		int threads = cpuInfo == null ? 0 : (int) PROCESSOR.matcher(cpuInfo).results().count();
		String memInfo = text(proc.resolve("meminfo"));
		String memory = memInfo == null ? null : first(MEM_TOTAL, memInfo);
		String version = text(proc.resolve("version"));
		return new MachineInfo(maker, model, processor == null ? null : processor.replaceAll("\\s+", " ").strip(),
				cores == null ? null : Integer.valueOf(cores), Math.max(threads, Runtime.getRuntime().availableProcessors()),
				memory == null ? 0 : Long.parseLong(memory) * 1024, disks(sys.resolve("block")),
				version == null ? null : first(KERNEL, version), null, new Power(0, 0, 0));
	}

	static List<Disk> disks(Path block) {
		List<Disk> disks = new ArrayList<>();
		try (DirectoryStream<Path> devices = Files.newDirectoryStream(block)) {
			for (Path device : devices) {
				String name = device.getFileName().toString();
				String sectors = text(device.resolve("size"));
				if (NOT_A_DISK.matcher(name).matches() || "1".equals(strip(text(device.resolve("removable")))) || sectors == null) {
					continue;
				}
				long size;
				try {
					// Always in 512-byte sectors, whatever the disk
					size = Long.parseLong(sectors.strip()) * 512;
				}
				catch (NumberFormatException ex) {
					continue;
				}
				if (size == 0) {
					continue;
				}
				DiskKind kind = name.startsWith("nvme") ? DiskKind.NVME
						: "0".equals(strip(text(device.resolve("queue/rotational")))) ? DiskKind.SSD : DiskKind.HDD;
				disks.add(new Disk(name, diskModel(device), size, kind));
			}
		}
		catch (IOException | RuntimeException ex) {
			// No /sys/block (not Linux): no disk named
		}
		disks.sort(Comparator.comparingLong(Disk::sizeBytes).reversed().thenComparing(Disk::name));
		return List.copyOf(disks);
	}

	/** "Samsung SSD 980 500GB"; the vendor of SATA disks is often just "ATA": left out then. */
	private static @Nullable String diskModel(Path device) {
		String model = named(text(device.resolve("device/model")));
		String vendor = named(text(device.resolve("device/vendor")));
		if (model == null) {
			return null;
		}
		return vendor == null || "ata".equalsIgnoreCase(vendor) || model.toLowerCase(Locale.ROOT).startsWith(vendor.toLowerCase(Locale.ROOT))
				? model : vendor + " " + model;
	}

	static @Nullable Long uptime(@Nullable String procUptime) {
		if (procUptime == null || procUptime.isBlank()) {
			return null;
		}
		try {
			return (long) Double.parseDouble(procUptime.strip().split("\\s+")[0]);
		}
		catch (NumberFormatException ex) {
			return null;
		}
	}

	/** Trimmed, null when blank or one of the makers' placeholders. */
	static @Nullable String named(@Nullable String value) {
		String stripped = strip(value);
		return stripped == null || BLANK.contains(stripped.toLowerCase(Locale.ROOT)) ? null : stripped.replaceAll("\\s+", " ");
	}

	private static @Nullable String strip(@Nullable String value) {
		return value == null ? null : value.strip();
	}

	private static @Nullable String first(Pattern pattern, String text) {
		Matcher matcher = pattern.matcher(text);
		return matcher.find() ? matcher.group(1).strip() : null;
	}

	private static @Nullable String text(Path file) {
		try {
			return Files.readString(file);
		}
		catch (IOException | RuntimeException ex) {
			return null;
		}
	}

}
