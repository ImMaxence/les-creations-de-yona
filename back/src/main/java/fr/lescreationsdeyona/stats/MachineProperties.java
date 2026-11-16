package fr.lescreationsdeyona.stats;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * The server, as the statistics see it (2.21).
 *
 * @param idleWatts what the whole server draws at the wall with nothing to do: an estimate, the
 * server has no electricity meter the backend could read
 * @param fullWatts the same with every core busy; the estimate goes in a straight line between both
 * @param eurosPerKwh the price of electricity, for the cost of the period
 * @param hostNetwork the network counters of the server itself ({@code /proc/1/net} of the server,
 * mounted read-only by Compose): a container only sees its own traffic. Absent, no server traffic
 * @param gatewayMetrics the counters of the gateway (Caddy), what the site itself sent and received;
 * empty, none
 */
@Validated
@ConfigurationProperties("app.machine")
public record MachineProperties(@DecimalMin("0") double idleWatts, @DecimalMin("0") double fullWatts, @DecimalMin("0") double eurosPerKwh,
		@NotNull Path hostNetwork, String gatewayMetrics) {

	public MachineProperties {
		fullWatts = Math.max(idleWatts, fullWatts);
		gatewayMetrics = gatewayMetrics == null ? "" : gatewayMetrics.strip();
	}

	/** Estimated draw for a share of the processors in use, from 0 to 1. */
	double watts(double load) {
		return idleWatts + (fullWatts - idleWatts) * Math.clamp(load, 0, 1);
	}

}
