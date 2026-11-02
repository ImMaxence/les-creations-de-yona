package fr.lescreationsdeyona.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;

/** The visitor's address, for the limits of the public writes: kept in memory only, never written. */
public final class ClientAddress {

	private ClientAddress() {
	}

	/**
	 * Cloudflare gives it in CF-Connecting-IP, which it always overwrites; without it (locally), the
	 * address read from the proxies' headers (forward-headers-strategy).
	 */
	public static String of(HttpServletRequest request) {
		String cloudflare = request.getHeader("CF-Connecting-IP");
		return StringUtils.hasText(cloudflare) && cloudflare.length() <= 45 ? cloudflare.strip() : request.getRemoteAddr();
	}

}
