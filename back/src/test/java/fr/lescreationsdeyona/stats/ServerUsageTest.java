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
	void measuresThisProcess() {
		ServerUsage usage = ServerUsage.now();

		assertThat(usage.processors()).isPositive();
		assertThat(usage.heapUsedBytes()).isPositive().isLessThanOrEqualTo(usage.heapMaxBytes());
		assertThat(usage.machineMemoryBytes()).isGreaterThanOrEqualTo(usage.machineFreeMemoryBytes());
	}

}
