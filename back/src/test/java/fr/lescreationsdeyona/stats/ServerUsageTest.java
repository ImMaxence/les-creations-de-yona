package fr.lescreationsdeyona.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ServerUsageTest {

	@Test
	void readsTheMemoryTheProcessHolds(@TempDir Path folder) throws IOException {
		Path status = folder.resolve("status");
		Files.writeString(status, "Name:\tjava\nVmPeak:\t 9000000 kB\nVmRSS:\t  412345 kB\nThreads:\t42\n");

		assertThat(ServerUsage.residentBytes(status)).isEqualTo(412_345L * 1024);
	}

	@Test
	void saysNothingWithoutLinux(@TempDir Path folder) {
		assertThat(ServerUsage.residentBytes(folder.resolve("absent"))).isNull();
	}

	@Test
	void countsTheDiskCacheAsAvailableOnTheWholeMachine(@TempDir Path folder) throws IOException {
		Path memInfo = folder.resolve("meminfo");
		Files.writeString(memInfo, "MemTotal:       16000000 kB\nMemFree:         4000000 kB\nMemAvailable:   12500000 kB\n");

		assertThat(ServerUsage.availableBytes(16_000_000L * 1024, 4_000_000L * 1024, memInfo, folder.resolve("absent")))
			.isEqualTo(12_500_000L * 1024);
	}

	@Test
	void addsTheInactiveDiskCacheInAContainerWithALimit(@TempDir Path folder) throws IOException {
		Path memInfo = folder.resolve("meminfo");
		Files.writeString(memInfo, "MemTotal:       16000000 kB\nMemAvailable:   12500000 kB\n");
		Path stat = folder.resolve("memory.stat");
		Files.writeString(stat, "anon 300\nfile 900\ninactive_file 700\nactive_file 200\n");

		assertThat(ServerUsage.availableBytes(2_000, 500, memInfo, stat)).isEqualTo(1_200);
	}

	@Test
	void keepsJavasFigureWithoutLinux(@TempDir Path folder) {
		assertThat(ServerUsage.availableBytes(2_000, 500, folder.resolve("absent"), folder.resolve("absent"))).isEqualTo(500);
	}

	@Test
	void measuresThisProcess() {
		ServerUsage usage = ServerUsage.now();

		assertThat(usage.processors()).isPositive();
		assertThat(usage.heapUsedBytes()).isPositive().isLessThanOrEqualTo(usage.heapMaxBytes());
		assertThat(usage.machineMemoryBytes()).isGreaterThanOrEqualTo(usage.machineFreeMemoryBytes());
	}

}
