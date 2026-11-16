package fr.lescreationsdeyona.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import fr.lescreationsdeyona.stats.MachineCounters.CpuTicks;
import fr.lescreationsdeyona.stats.MachineCounters.Reading;
import fr.lescreationsdeyona.stats.MachineCounters.ServerRates;
import fr.lescreationsdeyona.stats.MachineCounters.Traffic;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class MachineCountersTest {

	private static final MachineProperties PROPERTIES = new MachineProperties(7, 35, 0.2, Path.of("/absent"), "");

	private static final String NET_DEV = """
			Inter-|   Receive                                                |  Transmit
			 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
			    lo:  586290    6398    0    0    0     0          0         0   586290    6398    0    0    0     0       0          0
			enp1s0: 323406611  625182    0    0    0     0          0         0 324740037  533272    0    0    0     0       0          0
			docker0: 4778757   74439    0    0    0     0          0         0 265162508  193871    0    2    0     0       0          0
			veth9997597:     126       3    0    0    0     0          0         0     1698      17    0    0    0     0       0          0
			""";

	@Test
	void readsTheProcessorTimeOfTheWholeServer() {
		CpuTicks ticks = MachineCounters.cpuTicks("cpu  100 5 50 800 20 3 2 0 40 0\ncpu0 1 2 3 4 5 6 7 8 9 10\n");

		// user + nice + system + idle + iowait + irq + softirq + steal (guest already in user); idle + iowait
		assertThat(ticks).isEqualTo(new CpuTicks(980, 820));
		assertThat(MachineCounters.cpuTicks("not linux")).isNull();
		assertThat(MachineCounters.cpuTicks(null)).isNull();
	}

	@Test
	void givesTheLoadBetweenTwoReadings() {
		assertThat(MachineCounters.load(new CpuTicks(1000, 900), new CpuTicks(2000, 1650))).isCloseTo(0.25, within(1e-9));
		// The server restarted: its counters went back
		assertThat(MachineCounters.load(new CpuTicks(5000, 4000), new CpuTicks(100, 90))).isNull();
		assertThat(MachineCounters.load(null, new CpuTicks(100, 90))).isNull();
	}

	@Test
	void estimatesTheDrawInAStraightLine() {
		assertThat(PROPERTIES.watts(0)).isEqualTo(7);
		assertThat(PROPERTIES.watts(0.5)).isEqualTo(21);
		assertThat(PROPERTIES.watts(1)).isEqualTo(35);
		assertThat(PROPERTIES.watts(3)).isEqualTo(35);
	}

	@Test
	void countsTheCardOfTheDefaultRoute() {
		String route = """
				Iface	Destination	Gateway 	Flags	RefCnt	Use	Metric	Mask		MTU	Window	IRTT
				docker0	000011AC	00000000	0001	0	0	0	0000FFFF	0	0	0
				enp1s0	00000000	0101A8C0	0003	0	0	100	00000000	0	0	0
				""";

		assertThat(MachineCounters.defaultCard(route)).isEqualTo("enp1s0");
		assertThat(MachineCounters.cardTraffic(NET_DEV, route)).isEqualTo(new Traffic(323_406_611, 324_740_037));
	}

	@Test
	void leavesTheVirtualCardsOutWithoutARoute() {
		assertThat(MachineCounters.cardTraffic(NET_DEV, null)).isEqualTo(new Traffic(323_406_611, 324_740_037));
	}

	@Test
	void takesTheOutermostHandlerOfTheGateway() {
		String metrics = """
				# HELP caddy_http_response_size_bytes Size of the returned response.
				caddy_http_request_size_bytes_sum{code="200",handler="encode",method="GET",server="site"} 128
				caddy_http_request_size_bytes_count{code="200",handler="encode",method="GET",server="site"} 2
				caddy_http_request_size_bytes_sum{code="200",handler="subroute",method="GET",server="site"} 128
				caddy_http_request_size_bytes_count{code="200",handler="subroute",method="GET",server="site"} 2
				caddy_http_request_size_bytes_sum{code="404",handler="encode",method="GET",server="site"} 64
				caddy_http_request_size_bytes_count{code="404",handler="encode",method="GET",server="site"} 1
				caddy_http_response_size_bytes_sum{code="200",handler="encode",method="GET",server="site"} 186444
				caddy_http_response_size_bytes_count{code="200",handler="encode",method="GET",server="site"} 2
				caddy_http_response_size_bytes_sum{code="200",handler="subroute",method="GET",server="site"} 319344
				caddy_http_response_size_bytes_count{code="200",handler="subroute",method="GET",server="site"} 2
				caddy_http_response_size_bytes_sum{code="404",handler="encode",method="GET",server="site"} 1.5e+03
				caddy_http_response_size_bytes_count{code="404",handler="encode",method="GET",server="site"} 1
				caddy_http_response_size_bytes_sum{code="200",handler="metrics",method="GET",server="metrics"} 32353
				caddy_http_response_size_bytes_count{code="200",handler="metrics",method="GET",server="metrics"} 9
				""";

		// "encode" saw the 3 requests, compressed; the metrics of the metrics themselves are left out
		assertThat(MachineCounters.gatewayTraffic(metrics)).isEqualTo(new Traffic(192, 187_944));
		assertThat(MachineCounters.gatewayTraffic("caddy_http_requests_total 3")).isNull();
	}

	@Test
	void givesRatesPerSecondAndStartsAgainAfterARestart() {
		Reading before = new Reading(0, new CpuTicks(1000, 900), new Traffic(1_000, 2_000), new Traffic(10_000, 50_000));
		Reading after = new Reading(2_000_000_000L, new CpuTicks(1100, 950), new Traffic(3_000, 6_000), new Traffic(400, 1_000));

		ServerRates rates = MachineCounters.between(before, after, PROPERTIES);

		assertThat(rates.load()).isCloseTo(0.5, within(1e-9));
		assertThat(rates.watts()).isCloseTo(21, within(1e-9));
		assertThat(rates.hostReceived()).isEqualTo(1_000);
		assertThat(rates.hostSent()).isEqualTo(2_000);
		// The gateway restarted in between: what it holds came after
		assertThat(rates.siteReceived()).isEqualTo(200);
		assertThat(rates.siteSent()).isEqualTo(500);
	}

	@Test
	void saysNothingOfWhatCouldNotBeRead() {
		Reading before = new Reading(0, null, null, null);
		Reading after = new Reading(1_000_000_000L, new CpuTicks(1, 1), null, null);

		assertThat(MachineCounters.between(before, after, PROPERTIES)).isEqualTo(ServerRates.UNKNOWN);
	}

}
