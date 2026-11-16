package fr.lescreationsdeyona.stats;

import static org.assertj.core.api.Assertions.assertThat;

import fr.lescreationsdeyona.stats.MachineInfo.Disk;
import fr.lescreationsdeyona.stats.MachineInfo.DiskKind;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MachineInfoTest {

	@Test
	void readsTheHardwareOfTheServer(@TempDir Path root) throws IOException {
		Path proc = root.resolve("proc");
		Path sys = root.resolve("sys");
		write(proc.resolve("cpuinfo"), """
				processor	: 0
				model name	: AMD Ryzen 7 5700U with Radeon Graphics
				cpu cores	: 8

				processor	: 1
				model name	: AMD Ryzen 7 5700U with Radeon Graphics
				cpu cores	: 8
				""");
		write(proc.resolve("meminfo"), "MemTotal:       16000000 kB\nMemFree:         4000000 kB\n");
		write(proc.resolve("version"), "Linux version 6.8.0-49-generic (buildd@lcy02) (gcc 13.2.0) #49-Ubuntu SMP\n");
		write(sys.resolve("class/dmi/id/sys_vendor"), "BMAX\n");
		write(sys.resolve("class/dmi/id/product_name"), "B7 Power\n");
		disk(sys, "nvme0n1", "1000215216", "0", "0", "Samsung SSD 980 500GB  ", null);
		disk(sys, "sda", "3907029168", "1", "0", "WDC WD20EZAZ-00G", "ATA     ");
		disk(sys, "sdb", "60088320", "0", "1", "Cruzer Blade", "SanDisk");
		disk(sys, "loop0", "1587456", "0", "0", null, null);

		MachineInfo machine = MachineInfo.read(proc, sys);

		assertThat(machine.maker()).isEqualTo("BMAX");
		assertThat(machine.model()).isEqualTo("B7 Power");
		assertThat(machine.processor()).isEqualTo("AMD Ryzen 7 5700U with Radeon Graphics");
		assertThat(machine.cores()).isEqualTo(8);
		assertThat(machine.threads()).isGreaterThanOrEqualTo(2);
		assertThat(machine.memoryBytes()).isEqualTo(16_000_000L * 1024);
		assertThat(machine.kernel()).isEqualTo("6.8.0-49-generic");
		// The largest first; the USB key and the loop left out; "ATA" is no maker
		assertThat(machine.disks()).containsExactly(new Disk("sda", "WDC WD20EZAZ-00G", 3_907_029_168L * 512, DiskKind.HDD),
				new Disk("nvme0n1", "Samsung SSD 980 500GB", 1_000_215_216L * 512, DiskKind.NVME));
	}

	@Test
	void namesTheBoardWhenTheMakerLeftTheProductBlank(@TempDir Path root) throws IOException {
		Path sys = root.resolve("sys");
		write(sys.resolve("class/dmi/id/sys_vendor"), "Default string\n");
		write(sys.resolve("class/dmi/id/product_name"), "Default string\n");
		write(sys.resolve("class/dmi/id/board_vendor"), "AZW\n");
		write(sys.resolve("class/dmi/id/board_name"), "SER\n");

		MachineInfo machine = MachineInfo.read(root.resolve("proc"), sys);

		assertThat(machine.maker()).isEqualTo("AZW");
		assertThat(machine.model()).isEqualTo("SER");
		assertThat(machine.processor()).isNull();
		assertThat(machine.disks()).isEmpty();
	}

	@Test
	void readsTheTimeSinceTheServerStarted() {
		assertThat(MachineInfo.uptime("123456.78 987654.32\n")).isEqualTo(123_456L);
		assertThat(MachineInfo.uptime(null)).isNull();
	}

	private static void disk(Path sys, String name, String sectors, String rotational, String removable, String model, String vendor)
			throws IOException {
		Path device = sys.resolve("block").resolve(name);
		write(device.resolve("size"), sectors + "\n");
		write(device.resolve("queue/rotational"), rotational + "\n");
		write(device.resolve("removable"), removable + "\n");
		if (model != null) {
			write(device.resolve("device/model"), model + "\n");
		}
		if (vendor != null) {
			write(device.resolve("device/vendor"), vendor + "\n");
		}
	}

	private static void write(Path file, String text) throws IOException {
		Files.createDirectories(file.getParent());
		Files.writeString(file, text);
	}

}
